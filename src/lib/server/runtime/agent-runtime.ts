import { ChatMessage } from "@/types/chat"
import { AgentMode, ProviderSettings, ToolPolicyProfile } from "@/types/runtime"

import { type AgentRunResult, runAgent } from "../chat-agent"
import { buildSystemPrompt } from "./prompt-builder"
import { resolveAllowedToolNames } from "./tool-policy"

const MAX_CONTEXT_CHARS = 32_000
const MAX_CONTEXT_MESSAGES = 60

function normalizeAgentMode(value?: string | null): AgentMode {
  const normalized = (value ?? "").trim().toLowerCase()
  if (
    normalized === "research" ||
    normalized === "browser" ||
    normalized === "workspace" ||
    normalized === "document"
  ) {
    return normalized
  }
  return "general"
}

function normalizeToolPolicy(value?: string | null): ToolPolicyProfile {
  const normalized = (value ?? "").trim().toLowerCase()
  if (normalized === "read_only" || normalized === "read-only" || normalized === "readonly") {
    return "read_only"
  }
  if (normalized === "full_auto" || normalized === "full-auto" || normalized === "fullauto") {
    return "full_auto"
  }
  return "balanced"
}

function trimHistory(messages: ChatMessage[]) {
  let totalChars = 0
  const selected: ChatMessage[] = []

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    const contentLength = message.content?.length ?? 0
    if (selected.length >= MAX_CONTEXT_MESSAGES) break
    if (selected.length > 0 && totalChars + contentLength > MAX_CONTEXT_CHARS) break
    totalChars += contentLength
    selected.push(message)
  }

  const trimmed = selected.reverse()
  if (trimmed.length < messages.length) {
    const sessionId = messages[0]?.sessionId ?? trimmed[0]?.sessionId ?? ""
    trimmed.unshift({
      id: `system_truncation_${Date.now()}`,
      sessionId,
      role: "system",
      content:
        "Earlier conversation context was compacted to stay within the model context budget. Prefer verified recent facts over older assumptions.",
      timestamp: new Date().toISOString(),
    })
  }
  return trimmed
}

function createToolHeaders(settings: {
  cloudinaryCloudName: string
  cloudinaryApiKey: string
  cloudinaryApiSecret: string
}) {
  const headers = new Headers()
  if (settings.cloudinaryCloudName && settings.cloudinaryApiKey && settings.cloudinaryApiSecret) {
    headers.set("x-cloudinary-cloud-name", settings.cloudinaryCloudName)
    headers.set("x-cloudinary-api-key", settings.cloudinaryApiKey)
    headers.set("x-cloudinary-api-secret", settings.cloudinaryApiSecret)
  }
  return headers
}

type RunChatTurnOptions = {
  contextMessages: ChatMessage[]
  providerSettings: ProviderSettings
  cloudinaryCloudName: string
  cloudinaryApiKey: string
  cloudinaryApiSecret: string
  origin?: string
  requestedMode?: string | null
  requestedToolPolicy?: string | null
  responseSchema?: Record<string, unknown> | null
  onToolStart?: Parameters<typeof runAgent>[0]["onToolStart"]
  onToolResult?: Parameters<typeof runAgent>[0]["onToolResult"]
  onChunk?: Parameters<typeof runAgent>[0]["onChunk"]
  onWarning?: Parameters<typeof runAgent>[0]["onWarning"]
}

export interface ChatTurnResult extends AgentRunResult {
  mode: AgentMode
  toolPolicy: ToolPolicyProfile
}

export async function runChatTurn({
  contextMessages,
  providerSettings,
  cloudinaryCloudName,
  cloudinaryApiKey,
  cloudinaryApiSecret,
  origin,
  requestedMode,
  requestedToolPolicy,
  responseSchema,
  onToolStart,
  onToolResult,
  onChunk,
  onWarning,
}: RunChatTurnOptions): Promise<ChatTurnResult> {
  const mode = normalizeAgentMode(requestedMode)
  const toolPolicy = normalizeToolPolicy(requestedToolPolicy)
  const systemPrompt = await buildSystemPrompt({
    mode,
    toolPolicy,
    responseSchema,
  })
  const preparedMessages = trimHistory(contextMessages)
  const allowedToolNames = resolveAllowedToolNames(mode, toolPolicy)

  const agentResult = await runAgent({
    contextMessages: preparedMessages,
    systemPrompt,
    providerSettings,
    origin,
    toolHeaders: createToolHeaders({
      cloudinaryCloudName,
      cloudinaryApiKey,
      cloudinaryApiSecret,
    }),
    allowedToolNames,
    onToolStart,
    onToolResult,
    onChunk,
    onWarning,
  })

  return {
    ...agentResult,
    mode,
    toolPolicy,
  }
}

export { normalizeAgentMode, normalizeToolPolicy }
