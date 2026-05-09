import path from "path"

import { ChatMessage } from "@/types/chat"
import { AgentMode, ProviderSettings, ToolPolicyProfile } from "@/types/runtime"

import { type AgentRunResult, runAgent } from "../chat-agent"
import { getWorkspaceRoot } from "../workspace"
import { buildSystemPrompt } from "./prompt-builder"
import { validateStructuredOutput } from "./structured-output"
import { resolveAllowedToolNames } from "./tool-policy"
import { verifyToolCalls } from "./verification"

const MAX_CONTEXT_CHARS = 32_000
const MAX_CONTEXT_MESSAGES = 60

/**
 * Converts user/workflow-provided mode strings into the supported runtime modes.
 * Unknown values intentionally fall back to general mode instead of failing a request.
 */
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

/**
 * Normalizes policy aliases from UI/API callers into the canonical tool policy profiles.
 * Unknown values default to balanced so malformed input does not accidentally grant more access.
 */
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

/**
 * Keeps the most recent useful conversation context within the model budget and inserts a system
 * note when older context was compacted away.
 */
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

function withCurrentWorkspaceContext(messages: ChatMessage[], workspaceRoot = getWorkspaceRoot()) {
  const resolvedWorkspaceRoot = path.resolve(workspaceRoot)
  const latestUserIndex = messages.findLastIndex((message) => message.role === "user")
  const workspaceMessage: ChatMessage = {
    id: `system_workspace_${Date.now()}`,
    sessionId: messages[0]?.sessionId ?? "",
    role: "system",
    content: [
      `Current workspace root: ${resolvedWorkspaceRoot}`,
      "This is the authoritative workspace for this turn. Ignore older assistant messages that mention a different workspace path.",
    ].join("\n"),
    timestamp: new Date().toISOString(),
  }

  if (latestUserIndex === -1) {
    return [...messages, workspaceMessage]
  }

  return [
    ...messages.slice(0, latestUserIndex),
    workspaceMessage,
    ...messages.slice(latestUserIndex),
  ]
}

/**
 * Builds request headers passed into tool factories for optional integrations such as Cloudinary.
 */
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
  sessionId: string
  contextMessages: ChatMessage[]
  providerSettings: ProviderSettings
  workspaceRoot?: string
  cloudinaryCloudName: string
  cloudinaryApiKey: string
  cloudinaryApiSecret: string
  origin?: string
  requestedMode?: string | null
  requestedToolPolicy?: string | null
  workflowId?: string | null
  responseSchema?: Record<string, unknown> | null
  onToolStart?: Parameters<typeof runAgent>[0]["onToolStart"]
  onToolResult?: Parameters<typeof runAgent>[0]["onToolResult"]
  onApprovalRequired?: Parameters<typeof runAgent>[0]["onApprovalRequired"]
  onChunk?: Parameters<typeof runAgent>[0]["onChunk"]
  onWarning?: Parameters<typeof runAgent>[0]["onWarning"]
}

export interface ChatTurnResult extends AgentRunResult {
  mode: AgentMode
  toolPolicy: ToolPolicyProfile
  workflowId?: string
}

/**
 * Orchestrates one governed agent turn.
 *
 * This is the bridge between API routes/background jobs and the lower-level LangChain loop: it
 * normalizes mode/policy, builds the prompt, filters tools, retries invalid structured output once,
 * verifies side effects, and returns trace-ready metadata.
 */
export async function runChatTurn({
  sessionId,
  contextMessages,
  providerSettings,
  workspaceRoot,
  cloudinaryCloudName,
  cloudinaryApiKey,
  cloudinaryApiSecret,
  origin,
  requestedMode,
  requestedToolPolicy,
  workflowId,
  responseSchema,
  onToolStart,
  onToolResult,
  onApprovalRequired,
  onChunk,
  onWarning,
}: RunChatTurnOptions): Promise<ChatTurnResult> {
  const mode = normalizeAgentMode(requestedMode)
  const toolPolicy = normalizeToolPolicy(requestedToolPolicy)
  const baseSystemPrompt = await buildSystemPrompt({
    mode,
    toolPolicy,
    workspaceRoot,
    responseSchema,
  })
  const preparedMessages = withCurrentWorkspaceContext(trimHistory(contextMessages), workspaceRoot)
  const allowedToolNames = resolveAllowedToolNames(mode, toolPolicy)
  let retryPrompt = baseSystemPrompt
  let agentResult: AgentRunResult | null = null
  for (let attempt = 0; attempt < (responseSchema ? 2 : 1); attempt += 1) {
    agentResult = await runAgent({
      sessionId,
      contextMessages: preparedMessages,
      systemPrompt: retryPrompt,
      providerSettings,
      workspaceRoot,
      origin,
      toolHeaders: createToolHeaders({
        cloudinaryCloudName,
        cloudinaryApiKey,
        cloudinaryApiSecret,
      }),
      allowedToolNames,
      toolPolicy,
      onToolStart,
      onToolResult,
      onApprovalRequired,
      onChunk,
      onWarning,
    })

    const validation = validateStructuredOutput(agentResult.reply, responseSchema)
    if (!responseSchema || validation.valid) break
    await onWarning?.(
      `Structured output validation failed (${validation.errors.join("; ")}). Retrying with stricter instructions.`
    )
    retryPrompt = `${baseSystemPrompt}\n\n## Retry Correction\nYour previous reply did not satisfy the JSON schema. Return valid JSON only and ensure required fields are present.`
  }

  if (!agentResult) {
    throw new Error("Chat turn failed before producing a response")
  }

  const finalValidation = validateStructuredOutput(agentResult.reply, responseSchema)
  if (responseSchema && !finalValidation.valid) {
    throw new Error(`Structured output validation failed: ${finalValidation.errors.join("; ")}`)
  }

  const verification = await verifyToolCalls(agentResult.toolCalls)
  if (!verification.ok) {
    await onWarning?.(`Verification notes: ${verification.notes.join("; ")}`)
    agentResult = {
      ...agentResult,
      reply: `${agentResult.reply}\n\nVerification notes:\n- ${verification.notes.join("\n- ")}`,
    }
  }

  return {
    ...agentResult,
    mode,
    toolPolicy,
    workflowId: workflowId ?? undefined,
  }
}

export { normalizeAgentMode, normalizeToolPolicy, withCurrentWorkspaceContext }
