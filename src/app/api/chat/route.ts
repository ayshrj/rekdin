import crypto from "crypto"
import { NextResponse } from "next/server"
import { z } from "zod"

import { getProviderModel, normalizeLlmProvider } from "@/lib/llm-providers"
import { getReplayStore } from "@/lib/server/replay-store"
import { runChatTurn } from "@/lib/server/runtime/agent-runtime"
import { createEventStream } from "@/lib/server/runtime/events"
import { createToolApprovalRequest } from "@/lib/server/runtime/tool-approval-broker"
import { getSessionStore } from "@/lib/server/session-store"
import { getProviderSettings, getSettingsStore } from "@/lib/server/settings-store"
import { getTraceStore } from "@/lib/server/trace-store"
import { ChatMessage, ToolCall } from "@/types/chat"

export const runtime = "nodejs"

const messageSchema = z.object({
  id: z.string(),
  sessionId: z.string().optional(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  attachments: z.array(z.string()).optional(),
  toolCalls: z.array(z.any()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  timestamp: z.string().optional(),
})

const requestSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1).max(10_000),
  agentType: z.string().optional(),
  agentMode: z.string().optional(),
  toolPolicy: z.string().optional(),
  workflowId: z.string().optional(),
  responseSchema: z.record(z.string(), z.unknown()).nullable().optional(),
  attachments: z.array(z.string()).optional(),
  history: z.array(messageSchema).optional(),
})

/**
 * Handles the foreground chat path.
 *
 * This route is the main server boundary for Rekdin: it validates the browser request, persists the
 * user message before model work begins, streams `ServerEventV2` updates over SSE, records replay
 * events for UI inspection, and writes a trace for later debugging.
 */
export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const {
    sessionId,
    message,
    attachments = [],
    agentType,
    agentMode,
    toolPolicy,
    workflowId,
    history = [],
  } = parsed.data
  const replayStore = getReplayStore()
  const sessionStore = getSessionStore()
  const settings = await getSettingsStore().load()
  const providerSettings = await getProviderSettings(settings)
  const resolvedMode = agentMode ?? agentType

  const lastHistoryMessage = history[history.length - 1]
  const userMessage: ChatMessage =
    lastHistoryMessage && lastHistoryMessage.role === "user"
      ? {
          ...(lastHistoryMessage as ChatMessage),
          sessionId,
        }
      : {
          id: crypto.randomUUID(),
          role: "user",
          content: message,
          attachments,
          sessionId,
          timestamp: new Date().toISOString(),
          metadata:
            workflowId || resolvedMode || toolPolicy
              ? { agentType: resolvedMode, toolPolicy, workflowId }
              : undefined,
        }

  await sessionStore.saveMessage(sessionId, userMessage)
  await replayStore.record(sessionId, "user_message", { message: userMessage })

  const streamingMessageId = crypto.randomUUID()
  const turnStartedAt = new Date().toISOString()
  const warnings: string[] = []
  const stream = createEventStream(async (send) => {
    send({ version: 2, type: "ack", message: userMessage })
    send({ version: 2, type: "status", phase: "received" })
    send({ version: 2, type: "status", phase: "thinking" })
    await replayStore.record(sessionId, "assistant_thinking", { value: true })

    try {
      const contextMessages = history.length > 0 ? (history as ChatMessage[]) : [userMessage]
      const agentResult = await runChatTurn({
        sessionId,
        contextMessages,
        providerSettings,
        workspaceRoot: settings.workspaceRoot,
        cloudinaryCloudName: settings.cloudinaryCloudName,
        cloudinaryApiKey: settings.cloudinaryApiKey,
        cloudinaryApiSecret: settings.cloudinaryApiSecret,
        origin: req.headers.get("origin") ?? undefined,
        requestedMode: resolvedMode,
        requestedToolPolicy: toolPolicy,
        workflowId,
        responseSchema: parsed.data.responseSchema ?? null,
        onWarning: async (warning) => {
          warnings.push(warning)
          await replayStore.record(sessionId, "assistant_message", { warning })
          send({ version: 2, type: "warning", warning })
        },
        onToolStart: async (toolCall) => {
          send({ version: 2, type: "status", phase: "running_tools" })
          await replayStore.record(sessionId, "tool_call", { toolCall })
          send({ version: 2, type: "tool_started", toolCall })
        },
        onApprovalRequired: async (approvalInput) => {
          const { request, decision } = createToolApprovalRequest(approvalInput)
          await replayStore.record(sessionId, "tool_call", {
            approval: request,
            status: "approval_required",
          })
          send({ version: 2, type: "approval_required", approval: request })
          const approved = await decision
          const warning = approved
            ? `Approved tool execution: ${request.toolName}`
            : `Rejected or expired tool execution: ${request.toolName}`
          warnings.push(warning)
          await replayStore.record(sessionId, "assistant_message", { warning })
          send({ version: 2, type: "warning", warning })
          return approved
        },
        onToolResult: async (toolCall) => {
          const serialized = JSON.parse(JSON.stringify(toolCall)) as Record<string, unknown>
          await replayStore.record(sessionId, "tool_result", { toolCall: serialized })
          send({
            version: 2,
            type: "tool_finished",
            toolCall: serialized as unknown as ToolCall,
          })
        },
        onChunk: async (chunk) => {
          await replayStore.record(sessionId, "message_chunk", {
            messageId: streamingMessageId,
            content: chunk,
          })
          send({
            version: 2,
            type: "assistant_delta",
            messageId: streamingMessageId,
            content: chunk,
          })
        },
      })

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: agentResult.reply,
        toolCalls: agentResult.toolCalls,
        metadata: {
          tokens: agentResult.usageTokens,
          agentType: agentResult.mode,
          toolPolicy: agentResult.toolPolicy,
          model: agentResult.model,
          workflowId: workflowId ?? undefined,
        },
        sessionId,
        timestamp: new Date().toISOString(),
      }

      await sessionStore.saveMessage(sessionId, assistantMessage)
      await replayStore.record(sessionId, "assistant_message", { message: assistantMessage })
      await getTraceStore().append(sessionId, {
        startedAt: turnStartedAt,
        completedAt: new Date().toISOString(),
        mode: agentResult.mode,
        toolPolicy: agentResult.toolPolicy,
        provider: providerSettings.provider,
        model: agentResult.model,
        warnings,
        toolCount: agentResult.toolCalls.length,
        totalToolDurationMs: agentResult.toolCalls.reduce(
          (total, toolCall) => total + (toolCall.duration ?? 0),
          0
        ),
        responseSchemaApplied: Boolean(parsed.data.responseSchema),
        retryCount: agentResult.retryCount,
        success: true,
        workflowId: workflowId ?? undefined,
      })
      send({
        version: 2,
        type: "assistant_final",
        message: assistantMessage,
        tempId: streamingMessageId,
      })
      send({ version: 2, type: "status", phase: "completed" })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate response"
      await replayStore.record(sessionId, "assistant_message", { error: message })
      await getTraceStore().append(sessionId, {
        startedAt: turnStartedAt,
        completedAt: new Date().toISOString(),
        mode:
          resolvedMode === "research" ||
          resolvedMode === "browser" ||
          resolvedMode === "workspace" ||
          resolvedMode === "document"
            ? resolvedMode
            : "general",
        toolPolicy:
          toolPolicy === "read_only" || toolPolicy === "full_auto" ? toolPolicy : "balanced",
        provider: providerSettings.provider,
        model: getProviderModel(normalizeLlmProvider(providerSettings.provider), providerSettings),
        warnings,
        toolCount: 0,
        totalToolDurationMs: 0,
        responseSchemaApplied: Boolean(parsed.data.responseSchema),
        retryCount: 0,
        success: false,
        workflowId: workflowId ?? undefined,
        error: message,
      })
      send({ version: 2, type: "error", error: message })
    } finally {
      await replayStore.record(sessionId, "assistant_thinking", { value: false })
    }
  })

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
