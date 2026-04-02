import crypto from "crypto"
import { NextResponse } from "next/server"
import { z } from "zod"

import { getReplayStore } from "@/lib/server/replay-store"
import { runChatTurn } from "@/lib/server/runtime/agent-runtime"
import { createEventStream } from "@/lib/server/runtime/events"
import { getSessionStore } from "@/lib/server/session-store"
import { getProviderSettings, getSettingsStore } from "@/lib/server/settings-store"
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
  responseSchema: z.record(z.string(), z.unknown()).nullable().optional(),
  attachments: z.array(z.string()).optional(),
  history: z.array(messageSchema).optional(),
})

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
    history = [],
  } = parsed.data
  const replayStore = getReplayStore()
  const sessionStore = getSessionStore()
  const settings = await getSettingsStore().load()
  const providerSettings = await getProviderSettings()
  const resolvedMode = agentMode ?? agentType

  const userMessage: ChatMessage =
    history[history.length - 1] && history[history.length - 1].role === "user"
      ? ({
          ...history[history.length - 1],
          sessionId,
        } as ChatMessage)
      : {
          id: crypto.randomUUID(),
          role: "user",
          content: message,
          attachments,
          sessionId,
          timestamp: new Date().toISOString(),
        }

  await sessionStore.saveMessage(sessionId, userMessage)
  await replayStore.record(sessionId, "user_message", { message: userMessage })

  const streamingMessageId = crypto.randomUUID()
  const stream = createEventStream(async (send) => {
    send({ version: 2, type: "ack", message: userMessage })
    send({ version: 2, type: "status", phase: "received" })
    send({ version: 2, type: "status", phase: "thinking" })
    await replayStore.record(sessionId, "assistant_thinking", { value: true })

    try {
      const contextMessages = history.length > 0 ? (history as ChatMessage[]) : [userMessage]
      const agentResult = await runChatTurn({
        contextMessages,
        providerSettings,
        cloudinaryCloudName: settings.cloudinaryCloudName,
        cloudinaryApiKey: settings.cloudinaryApiKey,
        cloudinaryApiSecret: settings.cloudinaryApiSecret,
        origin: req.headers.get("origin") ?? undefined,
        requestedMode: resolvedMode,
        requestedToolPolicy: toolPolicy,
        responseSchema: parsed.data.responseSchema ?? null,
        onWarning: async (warning) => {
          await replayStore.record(sessionId, "assistant_message", { warning })
          send({ version: 2, type: "warning", warning })
        },
        onToolStart: async (toolCall) => {
          send({ version: 2, type: "status", phase: "running_tools" })
          await replayStore.record(sessionId, "tool_call", { toolCall })
          send({ version: 2, type: "tool_started", toolCall })
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
          model: agentResult.model,
        },
        sessionId,
        timestamp: new Date().toISOString(),
      }

      await sessionStore.saveMessage(sessionId, assistantMessage)
      await replayStore.record(sessionId, "assistant_message", { message: assistantMessage })
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
