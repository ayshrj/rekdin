import { ChatOpenAI } from "@langchain/openai"
import { AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages"
import { StructuredToolInterface } from "@langchain/core/tools"

import { OPENROUTER_API_KEY, OPENROUTER_MODEL, OPENROUTER_FALLBACK_MODEL } from "@/configs"
import { ChatMessage, ToolCall } from "@/types/chat"
import { toolset } from "./tools"

type AgentEventHandlers = {
  onToolResult?: (tool: ToolCall) => void
  onChunk?: (chunk: string) => void
}

function requireConfig() {
  if (!OPENROUTER_API_KEY) throw new Error("Missing OPENROUTER_API_KEY")
  if (!OPENROUTER_MODEL) throw new Error("Missing OPENROUTER_MODEL")
}

function createModel(headers?: HeadersInit, modelOverride?: string) {
  requireConfig()
  const origin = headers instanceof Headers ? headers.get("origin") ?? undefined : undefined
  const referer = typeof origin === "string" ? origin : "http://localhost:3000"
  return new ChatOpenAI({
    apiKey: OPENROUTER_API_KEY,
    model: modelOverride ?? OPENROUTER_MODEL,
    temperature: 0.2,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": referer,
        "X-Title": "Terminator Next",
      },
    },
  })
}

function toLangChainMessage(message: ChatMessage): BaseMessage {
  if (message.role === "user") {
    return new HumanMessage(formatUserContent(message.content, message.attachments))
  }
  if (message.role === "assistant") {
    const aiMsg = new AIMessage({
      content: message.content,
      tool_calls:
        message.toolCalls?.map((call) => ({
          id: call.id,
          name: call.name,
          args: call.arguments,
        })) ?? [],
    })
    return aiMsg
  }
  return new SystemMessage(message.content)
}

function formatUserContent(content: string, attachments?: string[]) {
  if (!attachments || attachments.length === 0) return content
  const note = attachments.map((path) => `- ${path}`).join("\n")
  return `${content}\n\nAttachments uploaded to workspace:\n${note}\nUse file_read if you need the contents.`
}

export interface AgentRunOptions extends AgentEventHandlers {
  headers?: Headers
  contextMessages: ChatMessage[]
}

export interface AgentRunResult {
  reply: string
  toolCalls: ToolCall[]
  usageTokens: number
}

export async function runAgent({
  headers,
  contextMessages,
  onToolResult,
  onChunk,
}: AgentRunOptions): Promise<AgentRunResult> {
  const tools: StructuredToolInterface[] = toolset
  let modelId = OPENROUTER_MODEL
  let llm = createModel(headers, modelId)
  let llmWithTools = llm.bindTools(tools)
  const history: BaseMessage[] = contextMessages.map(toLangChainMessage)

  const executedTools: ToolCall[] = []
  let iterations = 0
  let finalMessage: AIMessage | null = null

  while (iterations < 8) {
    iterations += 1
    let aiMessage: AIMessage
    try {
      aiMessage = await llmWithTools.invoke(history)
    } catch (err) {
      const message = err instanceof Error ? err.message : ""
      const lowered = typeof message === "string" ? message.toLowerCase() : ""
      const shouldFallback = Boolean(
        OPENROUTER_FALLBACK_MODEL &&
          modelId !== OPENROUTER_FALLBACK_MODEL &&
          (lowered.includes("support tool use") ||
            lowered.includes("model_not_found") ||
            lowered.includes("model not found"))
      )
      if (shouldFallback) {
        modelId = OPENROUTER_FALLBACK_MODEL
        llm = createModel(headers, modelId)
        llmWithTools = llm.bindTools(tools)
        iterations -= 1
        continue
      }
      throw err
    }
    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      history.push(aiMessage)
      for (const call of aiMessage.tool_calls) {
        const tool = tools.find((t) => t.name === call.name)
        if (!tool) continue
        const started = Date.now()
        let status: ToolCall["status"] = "success"
        let result: unknown
        let error: string | undefined
        try {
          result = await tool.invoke(call.args)
        } catch (err) {
          status = "error"
          error = err instanceof Error ? err.message : "Unknown error"
          result = { error }
        }
        const record: ToolCall = {
          id: call.id ?? `tool_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: call.name,
          arguments: call.args,
          result: typeof result === "object" ? (result as Record<string, unknown>) : { output: result },
          status,
          error,
          timestamp: new Date().toISOString(),
          duration: Date.now() - started,
        }
        executedTools.push(record)
        onToolResult?.(record)
        history.push(
          new ToolMessage({
            tool_call_id: record.id,
            content: JSON.stringify(record.result ?? record.error ?? ""),
          })
        )
      }
      continue
    }
    finalMessage = aiMessage
    break
  }

  if (!finalMessage) {
    throw new Error("Agent failed to produce a response")
  }

  const text = typeof finalMessage.content === "string" ? finalMessage.content : JSON.stringify(finalMessage.content)
  onChunk?.(text)

  return {
    reply: text,
    toolCalls: executedTools,
    usageTokens: finalMessage.usage_metadata?.total_tokens ?? 0,
  }
}
