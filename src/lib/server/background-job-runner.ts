import crypto from "crypto"

import { ChatMessage } from "@/types/chat"

import { getBackgroundJobStore } from "./background-job-store"
import { getReplayStore } from "./replay-store"
import { runChatTurn } from "./runtime/agent-runtime"
import { getSessionStore } from "./session-store"
import { getProviderSettings, getSettingsStore } from "./settings-store"
import { getTraceStore } from "./trace-store"

type RunBackgroundJobInput = {
  sessionId: string
  message: string
  attachments?: string[]
  requestedMode?: string | null
  requestedToolPolicy?: string | null
  workflowId?: string | null
  responseSchema?: Record<string, unknown> | null
}

export async function enqueueBackgroundJob(input: RunBackgroundJobInput) {
  const job = await getBackgroundJobStore().create({
    sessionId: input.sessionId,
    prompt: input.message,
    mode:
      input.requestedMode === "research" ||
      input.requestedMode === "browser" ||
      input.requestedMode === "workspace" ||
      input.requestedMode === "document"
        ? input.requestedMode
        : "general",
    toolPolicy:
      input.requestedToolPolicy === "read_only" || input.requestedToolPolicy === "full_auto"
        ? input.requestedToolPolicy
        : "balanced",
    workflowId: input.workflowId ?? undefined,
    responseSchema: input.responseSchema ?? null,
  })

  setTimeout(() => {
    void runBackgroundJob(job.id, input)
  }, 0)

  return job
}

async function runBackgroundJob(jobId: string, input: RunBackgroundJobInput) {
  const jobStore = getBackgroundJobStore()
  const replayStore = getReplayStore()
  const sessionStore = getSessionStore()
  const traceStore = getTraceStore()
  const providerSettings = await getProviderSettings()
  const settings = await getSettingsStore().load()
  const startedAt = new Date().toISOString()

  await jobStore.update(jobId, { status: "running", startedAt })

  const userMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: input.message,
    attachments: input.attachments ?? [],
    sessionId: input.sessionId,
    timestamp: startedAt,
    metadata: {
      workflowId: input.workflowId ?? undefined,
      backgroundJobId: jobId,
    },
  }

  await sessionStore.saveMessage(input.sessionId, userMessage)
  await replayStore.record(input.sessionId, "user_message", {
    message: userMessage,
    backgroundJobId: jobId,
  })

  const warnings: string[] = []

  try {
    const turn = await runChatTurn({
      sessionId: input.sessionId,
      contextMessages: [userMessage],
      providerSettings,
      cloudinaryCloudName: settings.cloudinaryCloudName,
      cloudinaryApiKey: settings.cloudinaryApiKey,
      cloudinaryApiSecret: settings.cloudinaryApiSecret,
      requestedMode: input.requestedMode,
      requestedToolPolicy: input.requestedToolPolicy,
      workflowId: input.workflowId,
      responseSchema: input.responseSchema ?? null,
      onWarning: async (warning) => {
        warnings.push(warning)
        await replayStore.record(input.sessionId, "assistant_message", {
          warning,
          backgroundJobId: jobId,
        })
      },
      onToolStart: async (toolCall) => {
        await replayStore.record(input.sessionId, "tool_call", {
          toolCall,
          backgroundJobId: jobId,
        })
      },
      onToolResult: async (toolCall) => {
        await replayStore.record(input.sessionId, "tool_result", {
          toolCall,
          backgroundJobId: jobId,
        })
      },
    })

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: turn.reply,
      toolCalls: turn.toolCalls,
      sessionId: input.sessionId,
      timestamp: new Date().toISOString(),
      metadata: {
        tokens: turn.usageTokens,
        agentType: turn.mode,
        model: turn.model,
        workflowId: input.workflowId ?? undefined,
        backgroundJobId: jobId,
      },
    }

    await sessionStore.saveMessage(input.sessionId, assistantMessage)
    await replayStore.record(input.sessionId, "assistant_message", {
      message: assistantMessage,
      backgroundJobId: jobId,
    })
    await traceStore.append(input.sessionId, {
      startedAt,
      completedAt: assistantMessage.timestamp,
      mode: turn.mode,
      toolPolicy: turn.toolPolicy,
      provider: providerSettings.provider,
      model: turn.model,
      warnings,
      toolCount: turn.toolCalls.length,
      totalToolDurationMs: turn.toolCalls.reduce(
        (total, toolCall) => total + (toolCall.duration ?? 0),
        0
      ),
      responseSchemaApplied: Boolean(input.responseSchema),
      retryCount: turn.retryCount,
      success: true,
      workflowId: input.workflowId ?? undefined,
    })
    await jobStore.update(jobId, {
      status: "completed",
      completedAt: assistantMessage.timestamp,
      resultMessageId: assistantMessage.id,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Background task failed"
    await replayStore.record(input.sessionId, "assistant_message", {
      error: message,
      backgroundJobId: jobId,
    })
    await traceStore.append(input.sessionId, {
      startedAt,
      completedAt: new Date().toISOString(),
      mode:
        input.requestedMode === "research" ||
        input.requestedMode === "browser" ||
        input.requestedMode === "workspace" ||
        input.requestedMode === "document"
          ? input.requestedMode
          : "general",
      toolPolicy:
        input.requestedToolPolicy === "read_only" || input.requestedToolPolicy === "full_auto"
          ? input.requestedToolPolicy
          : "balanced",
      provider: providerSettings.provider,
      model:
        providerSettings.provider === "openrouter"
          ? providerSettings.openRouterModel
          : providerSettings.provider === "openai"
            ? providerSettings.openAIModel
            : providerSettings.azureOpenAIDeployment,
      warnings,
      toolCount: 0,
      totalToolDurationMs: 0,
      responseSchemaApplied: Boolean(input.responseSchema),
      retryCount: 0,
      success: false,
      workflowId: input.workflowId ?? undefined,
      error: message,
    })
    await jobStore.update(jobId, {
      status: "failed",
      completedAt: new Date().toISOString(),
      error: message,
    })
  }
}
