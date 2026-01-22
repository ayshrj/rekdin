export type Role = "user" | "assistant" | "system"

export type ToolStatus = "running" | "success" | "error"

export type ToolResultPayload = Record<string, unknown>

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
  result?: ToolResultPayload
  error?: string
  timestamp: string
  duration?: number
  status: ToolStatus
}

export interface ToolResultEntry {
  id: string
  toolName: string
  status: string
  arguments: Record<string, unknown>
  result?: Record<string, unknown> | string
  timestamp: string
}

export interface ChatMessage {
  id: string
  sessionId: string
  role: Role
  content: string
  timestamp: string
  attachments?: string[]
  toolCalls?: ToolCall[]
  metadata?: {
    tokens?: number
    thinking?: boolean
    agentType?: string
    model?: string
  }
}

export interface ChatSession {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: ChatMessage[]
  metadata?: {
    totalTokens?: number
    messageCount?: number
    model?: string
  }
}

export interface ReplayEvent {
  id: string
  sessionId: string
  type:
    | "user_message"
    | "assistant_message"
    | "tool_call"
    | "tool_result"
    | "message_chunk"
    | "assistant_thinking"
  timestamp: number
  data: Record<string, unknown>
}

export interface SessionReplayData {
  sessionId: string
  startTime: number
  endTime: number
  events: ReplayEvent[]
  metadata: {
    totalMessages: number
    totalToolCalls: number
  }
}
