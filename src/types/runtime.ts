import { ChatMessage, ToolCall } from "@/types/chat"

export type LlmProvider = "openrouter" | "openai" | "azure_openai"
export type AgentMode = "general" | "research" | "browser" | "workspace" | "document"
export type ToolPolicyProfile = "read_only" | "balanced" | "full_auto"

export interface ServerSettings {
  currentSessionId?: string | null
  llmProvider: LlmProvider
  openRouterModel: string
  openRouterApiKey: string
  openAIModel: string
  openAIApiKey: string
  azureOpenAIApiKey: string
  azureOpenAIEndpoint: string
  azureOpenAIApiVersion: string
  azureOpenAIDeployment: string
  liveModeEnabled: boolean
  cloudinaryCloudName: string
  cloudinaryApiKey: string
  cloudinaryApiSecret: string
}

export interface ProviderSettings {
  provider: LlmProvider
  openRouterModel: string
  openRouterApiKey: string
  openAIModel: string
  openAIApiKey: string
  azureOpenAIApiKey: string
  azureOpenAIEndpoint: string
  azureOpenAIApiVersion: string
  azureOpenAIDeployment: string
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
  | (BaseServerEvent & { type: "warning"; warning: string })
  | (BaseServerEvent & { type: "error"; error: string })
  | (BaseServerEvent & { type: "heartbeat"; at: string })
  | (BaseServerEvent & { type: "done" })
