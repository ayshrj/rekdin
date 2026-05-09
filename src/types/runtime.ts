import { LlmProvider, ProviderCredentialFields } from "@/lib/llm-providers"
import { ChatMessage, ToolCall } from "@/types/chat"

export type { LlmProvider } from "@/lib/llm-providers"

export type AgentMode = "general" | "research" | "browser" | "workspace" | "document"
export type ToolPolicyProfile = "read_only" | "balanced" | "full_auto"

export interface ServerSettings extends ProviderCredentialFields {
  currentSessionId?: string | null
  workspaceRoot: string
  llmProvider: LlmProvider
  customWorkflows: WorkflowPreset[]
  liveModeEnabled: boolean
  cloudinaryCloudName: string
  cloudinaryApiKey: string
  cloudinaryApiSecret: string
}

export interface ProviderSettings extends ProviderCredentialFields {
  provider: LlmProvider
}

export interface ArtifactRef {
  id: string
  kind: "image" | "pdf" | "archive" | "file" | "json" | "text"
  filename: string
  mimeType: string
  url: string
  size: number
}

export interface WorkflowPreset {
  id: string
  title: string
  description: string
  prompt: string
  mode: AgentMode
  toolPolicy?: ToolPolicyProfile
  responseSchema?: Record<string, unknown> | null
  category?: "research" | "browser" | "workspace" | "document" | "code"
  supportsBackground?: boolean
  custom?: boolean
}

export interface ToolApprovalRequest {
  id: string
  sessionId: string
  toolName: string
  arguments: Record<string, unknown>
  reason: string
  createdAt: string
  expiresAt: string
}

export interface ChatTurnRequest {
  sessionId: string
  message: string
  attachments?: string[]
  history?: ChatMessage[]
  agentMode?: AgentMode
  toolPolicy?: ToolPolicyProfile
  responseSchema?: Record<string, unknown> | null
}

export interface TurnTrace {
  id: string
  sessionId: string
  startedAt: string
  completedAt: string
  mode: AgentMode
  toolPolicy: ToolPolicyProfile
  provider: LlmProvider
  model: string
  warnings: string[]
  toolCount: number
  totalToolDurationMs?: number
  responseSchemaApplied: boolean
  retryCount: number
  success: boolean
  workflowId?: string
  error?: string
}

export type BackgroundJobStatus = "queued" | "running" | "completed" | "failed"

export interface BackgroundJob {
  id: string
  sessionId: string
  prompt: string
  mode: AgentMode
  toolPolicy: ToolPolicyProfile
  workflowId?: string
  responseSchema?: Record<string, unknown> | null
  status: BackgroundJobStatus
  createdAt: string
  startedAt?: string
  completedAt?: string
  resultMessageId?: string
  error?: string
}

type BaseServerEvent = {
  version: 2
}

export type ServerEventV2 =
  | (BaseServerEvent & { type: "ack"; message: ChatMessage })
  | (BaseServerEvent & {
      type: "status"
      phase: "received" | "thinking" | "running_tools" | "completed" | "idle"
      message?: string
    })
  | (BaseServerEvent & { type: "assistant_delta"; messageId: string; content: string })
  | (BaseServerEvent & { type: "assistant_final"; message: ChatMessage; tempId?: string })
  | (BaseServerEvent & { type: "tool_started"; toolCall: Partial<ToolCall> & { id: string } })
  | (BaseServerEvent & { type: "tool_finished"; toolCall: ToolCall })
  | (BaseServerEvent & { type: "approval_required"; approval: ToolApprovalRequest })
  | (BaseServerEvent & { type: "warning"; warning: string })
  | (BaseServerEvent & { type: "error"; error: string })
  | (BaseServerEvent & { type: "heartbeat"; at: string })
  | (BaseServerEvent & { type: "done" })
