import { tool } from "@langchain/core/tools"
import crypto from "crypto"
import { z } from "zod"

import { ChatMessage, ReplayEvent, ToolCall } from "@/types/chat"

import { getReplayStore } from "../../replay-store"
import { getSessionStore } from "../../session-store"
import { boundedLimit, previewString } from "../shared/formatting"

function hashUnknown(value: unknown) {
  let text: string
  try {
    text = typeof value === "string" ? value : JSON.stringify(value)
  } catch {
    text = String(value)
  }
  return crypto
    .createHash("sha256")
    .update(text ?? "")
    .digest("hex")
    .slice(0, 16)
}

function getMessageToolCalls(message: ChatMessage) {
  return Array.isArray(message.toolCalls) ? message.toolCalls : []
}

function compactToolCall(call: ToolCall) {
  return {
    id: call.id,
    name: call.name,
    status: call.status,
    timestamp: call.timestamp,
    duration: call.duration,
    argumentKeys: Object.keys(call.arguments ?? {}),
    resultType:
      call.result && typeof call.result === "object" && typeof call.result.type === "string"
        ? call.result.type
        : undefined,
    error: call.error ? previewString(call.error, 240) : undefined,
  }
}

function compactMessage(message: ChatMessage) {
  const toolCalls = getMessageToolCalls(message)
  return {
    id: message.id,
    role: message.role,
    timestamp: message.timestamp,
    contentPreview: previewString(message.content, 500),
    contentChars: message.content.length,
    attachmentsCount: message.attachments?.length ?? 0,
    toolCallCount: toolCalls.length,
    toolCalls: toolCalls.slice(0, 12).map(compactToolCall),
    omittedToolCalls: Math.max(toolCalls.length - 12, 0),
    metadata: {
      tokens: message.metadata?.tokens,
      agentType: message.metadata?.agentType,
      model: message.metadata?.model,
      toolPolicy: message.metadata?.toolPolicy,
      workflowId: message.metadata?.workflowId,
      backgroundJobId: message.metadata?.backgroundJobId,
      errorCode: message.metadata?.errorCode,
    },
  }
}

function replayToolCall(event: ReplayEvent) {
  const data = event.data ?? {}
  const toolCall = data.toolCall
  return toolCall && typeof toolCall === "object" ? (toolCall as Record<string, unknown>) : null
}

function replayEventText(event: ReplayEvent) {
  try {
    return JSON.stringify(event)
  } catch {
    return `${event.type} ${event.id}`
  }
}

function compactReplayEvent(event: ReplayEvent) {
  const toolCall = replayToolCall(event)
  return {
    id: event.id,
    type: event.type,
    timestamp: event.timestamp,
    toolName: typeof toolCall?.name === "string" ? toolCall.name : undefined,
    status: typeof toolCall?.status === "string" ? toolCall.status : undefined,
    duration: typeof toolCall?.duration === "number" ? toolCall.duration : undefined,
    dataPreview: previewString(replayEventText(event), 700),
    dataHash: hashUnknown(event.data),
  }
}

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1
    return counts
  }, {})
}

function lastDefined<T>(values: T[], predicate: (value: T) => boolean) {
  return [...values].reverse().find(predicate)
}

export const sessionListTool = tool(
  async ({ limit }: { limit?: number }) => {
    const limitValue = boundedLimit(limit, 20, 100)
    const sessions = await getSessionStore().listSessions()
    const selected = sessions.slice(0, limitValue)
    return {
      type: "session_list",
      totalSessions: sessions.length,
      sessions: selected.map((session) => {
        const messages = session.messages ?? []
        const toolCalls = messages.flatMap(getMessageToolCalls)
        const lastUser = lastDefined(messages, (message) => message.role === "user")
        const lastAssistant = lastDefined(messages, (message) => message.role === "assistant")
        const metadataMessage = lastDefined(messages, (message) =>
          Boolean(message.metadata?.model || message.metadata?.toolPolicy)
        )
        return {
          id: session.id,
          title: session.title,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          messageCount: session.metadata?.messageCount ?? messages.length,
          totalTokens: session.metadata?.totalTokens ?? 0,
          model: metadataMessage?.metadata?.model ?? session.metadata?.model,
          agentType: metadataMessage?.metadata?.agentType,
          toolPolicy: metadataMessage?.metadata?.toolPolicy,
          workflowId: metadataMessage?.metadata?.workflowId,
          lastUserPromptPreview: lastUser ? previewString(lastUser.content, 360) : "",
          finalAnswerPreview: lastAssistant ? previewString(lastAssistant.content, 360) : "",
          toolCallCount: toolCalls.length,
          failedToolCallCount: toolCalls.filter((call) => call.status === "error").length,
        }
      }),
      omittedSessions: Math.max(sessions.length - selected.length, 0),
    }
  },
  {
    name: "session_list",
    description:
      "List recent Rekdin chat sessions with compact metadata, prompt previews, token totals, and tool-call counts.",
    schema: z.object({
      limit: z.number().int().positive().max(100).optional(),
    }),
  }
)

export const sessionInspectTool = tool(
  async ({ sessionId, messageLimit }: { sessionId: string; messageLimit?: number }) => {
    const limitValue = boundedLimit(messageLimit, 20, 100)
    const session = await getSessionStore().getSession(sessionId)
    if (!session) {
      return {
        type: "session_inspect",
        sessionId,
        found: false,
        error: "Session not found.",
      }
    }

    const messages = session.messages ?? []
    const selectedMessages = messages.slice(-limitValue)
    const toolCalls = messages.flatMap(getMessageToolCalls)
    const finalAssistant = lastDefined(messages, (message) => message.role === "assistant")
    return {
      type: "session_inspect",
      sessionId,
      found: true,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messageCount: messages.length,
      returnedMessageCount: selectedMessages.length,
      omittedMessages: Math.max(messages.length - selectedMessages.length, 0),
      totalTokens: session.metadata?.totalTokens ?? 0,
      model: session.metadata?.model,
      attachmentCount: messages.reduce(
        (total, message) => total + (message.attachments?.length ?? 0),
        0
      ),
      toolCallCount: toolCalls.length,
      toolCallStatusCounts: countBy(toolCalls.map((call) => call.status)),
      toolCallNameCounts: countBy(toolCalls.map((call) => call.name)),
      finalAnswerPreview: finalAssistant ? previewString(finalAssistant.content, 700) : "",
      messages: selectedMessages.map(compactMessage),
    }
  },
  {
    name: "session_inspect",
    description:
      "Inspect one Rekdin session with compact message previews, metadata, attachments, tool-call counts, and final-answer preview.",
    schema: z.object({
      sessionId: z.string().min(1),
      messageLimit: z.number().int().positive().max(100).optional(),
    }),
  }
)

export const replaySummaryTool = tool(
  async ({ sessionId }: { sessionId: string }) => {
    const replay = await getReplayStore().getReplay(sessionId)
    if (!replay) {
      return {
        type: "replay_summary",
        sessionId,
        found: false,
        error: "Replay not found.",
      }
    }

    const toolTimeline = replay.events
      .filter((event) => event.type === "tool_result")
      .map((event) => compactReplayEvent(event))
    const warnings = replay.events
      .filter((event) => {
        const data = event.data ?? {}
        return typeof data.warning === "string" || typeof data.error === "string"
      })
      .slice(0, 20)
      .map(compactReplayEvent)
    return {
      type: "replay_summary",
      sessionId,
      found: true,
      startTime: replay.startTime,
      endTime: replay.endTime,
      durationMs: replay.endTime - replay.startTime,
      eventCount: replay.events.length,
      eventTypeCounts: countBy(replay.events.map((event) => event.type)),
      metadata: replay.metadata,
      toolTimeline: toolTimeline.slice(0, 60),
      omittedToolTimeline: Math.max(toolTimeline.length - 60, 0),
      failedTools: toolTimeline.filter((event) => event.status === "error").slice(0, 20),
      warnings,
      slowestSteps: [...toolTimeline]
        .filter((event) => typeof event.duration === "number")
        .sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0))
        .slice(0, 10),
    }
  },
  {
    name: "replay_summary",
    description:
      "Summarize one Rekdin replay into event counts, duration, tool timeline, failed tools, warnings, and slowest steps.",
    schema: z.object({
      sessionId: z.string().min(1),
    }),
  }
)

export const replaySearchTool = tool(
  async ({
    sessionId,
    query,
    eventType,
    toolName,
    status,
    limit,
  }: {
    sessionId: string
    query?: string
    eventType?: string
    toolName?: string
    status?: string
    limit?: number
  }) => {
    const replay = await getReplayStore().getReplay(sessionId)
    if (!replay) {
      return {
        type: "replay_search",
        sessionId,
        found: false,
        error: "Replay not found.",
      }
    }

    const limitValue = boundedLimit(limit, 30, 100)
    const normalizedQuery = query?.trim().toLowerCase()
    const matches = replay.events.filter((event) => {
      const call = replayToolCall(event)
      if (eventType && event.type !== eventType) return false
      if (toolName && call?.name !== toolName) return false
      if (status && call?.status !== status) return false
      if (!normalizedQuery) return true
      return replayEventText(event).toLowerCase().includes(normalizedQuery)
    })
    const selected = matches.slice(0, limitValue)
    return {
      type: "replay_search",
      sessionId,
      found: true,
      query: query ?? "",
      eventType,
      toolName,
      status,
      totalMatches: matches.length,
      matches: selected.map(compactReplayEvent),
      omittedMatches: Math.max(matches.length - selected.length, 0),
    }
  },
  {
    name: "replay_search",
    description:
      "Search one Rekdin replay by event type, tool name, status, or text query and return compact event previews.",
    schema: z.object({
      sessionId: z.string().min(1),
      query: z.string().optional(),
      eventType: z.string().optional(),
      toolName: z.string().optional(),
      status: z.string().optional(),
      limit: z.number().int().positive().max(100).optional(),
    }),
  }
)
