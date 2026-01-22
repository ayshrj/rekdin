import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages"
import { StructuredToolInterface } from "@langchain/core/tools"
import { IterableReadableStream } from "@langchain/core/utils/stream"
import { AzureChatOpenAI, ChatOpenAI } from "@langchain/openai"

import { OPENROUTER_API_KEY, OPENROUTER_FALLBACK_MODEL, OPENROUTER_MODEL } from "@/configs"
import { ChatMessage, ToolCall } from "@/types/chat"

import { createToolset } from "./tools"

type AgentEventHandlers = {
  onToolResult?: (tool: ToolCall) => void
  onChunk?: (chunk: string) => void
}

const MAX_TOOL_RESULT_CHARS = 12_000
const MAX_STRING_CHARS = 6_000
const MAX_ARRAY_ITEMS = 30
const MAX_OBJECT_KEYS = 50
const MAX_DEPTH = 4

function truncateString(value: string, max = MAX_STRING_CHARS) {
  if (value.length <= max) return value
  return `${value.slice(0, max)}\n\n...(truncated, ${value.length} chars total)`
}

function sanitizeToolPayload(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[truncated: max depth]"

  if (typeof value === "string") {
    if (value.startsWith("data:image/") && value.length > 200) {
      return `[omitted image data url, ${value.length} chars]`
    }
    return truncateString(value)
  }

  if (typeof value === "number" || typeof value === "boolean" || value == null) return value

  if (Array.isArray(value)) {
    const slice = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeToolPayload(item, depth + 1))
    if (value.length > MAX_ARRAY_ITEMS) {
      slice.push(`[truncated: ${value.length - MAX_ARRAY_ITEMS} more items]`)
    }
    return slice
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj)
    const limitedKeys = keys.slice(0, MAX_OBJECT_KEYS)
    const out: Record<string, unknown> = {}

    for (const key of limitedKeys) {
      const val = obj[key]
      if (typeof val === "string") {
        const lower = key.toLowerCase()
        if (lower.includes("screenshot") || lower.includes("image")) {
          out[key] = val.startsWith("data:image/")
            ? `[omitted ${key}, ${val.length} chars]`
            : truncateString(val, 500)
          continue
        }
        if (
          key === "markdown" ||
          key === "content" ||
          key === "html" ||
          key === "stdout" ||
          key === "stderr"
        ) {
          out[key] = truncateString(val)
          continue
        }
      }
      out[key] = sanitizeToolPayload(val, depth + 1)
    }

    if (keys.length > MAX_OBJECT_KEYS) {
      out.__truncatedKeys = keys.length - MAX_OBJECT_KEYS
    }

    return out
  }

  return String(value)
}

function toolMessageContent(result: unknown) {
  const sanitized = sanitizeToolPayload(result)
  let content = JSON.stringify(sanitized)
  if (content.length > MAX_TOOL_RESULT_CHARS) {
    content = `${content.slice(0, MAX_TOOL_RESULT_CHARS)}...(truncated tool result, ${content.length} chars total)`
  }
  return content
}

type LlmProvider = "openrouter" | "openai" | "azure_openai"

function normalizeProvider(value: string | undefined | null): LlmProvider {
  const normalized = (value ?? "").trim().toLowerCase()
  if (normalized === "openai") return "openai"
  if (normalized === "azure_openai" || normalized === "azure-openai" || normalized === "azure") {
    return "azure_openai"
  }
  return "openrouter"
}

function createModel({
  provider,
  headers,
  modelId,
  openRouterApiKey,
  openAIApiKey,
  azureOpenAIApiKey,
  azureOpenAIEndpoint,
  azureOpenAIApiVersion,
  azureOpenAIDeployment,
}: {
  provider: LlmProvider
  headers?: HeadersInit
  modelId: string
  openRouterApiKey?: string
  openAIApiKey?: string
  azureOpenAIApiKey?: string
  azureOpenAIEndpoint?: string
  azureOpenAIApiVersion?: string
  azureOpenAIDeployment?: string
}) {
  const origin = headers instanceof Headers ? (headers.get("origin") ?? undefined) : undefined
  const referer = typeof origin === "string" ? origin : "http://localhost:3000"

  if (provider === "openrouter") {
    const apiKey = openRouterApiKey ?? OPENROUTER_API_KEY
    const model = modelId || OPENROUTER_MODEL
    if (!apiKey) throw new Error("Missing OpenRouter API key (set it in Settings)")
    if (!model) throw new Error("Missing OpenRouter model (set it in Settings)")
    return new ChatOpenAI({
      apiKey,
      model,
      temperature: 0.2,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": referer,
          "X-Title": "Rekdin Next",
        },
      },
    })
  }

  if (provider === "openai") {
    const apiKey = openAIApiKey
    const model = modelId
    if (!apiKey) throw new Error("Missing OpenAI API key (set it in Settings)")
    if (!model) throw new Error("Missing OpenAI model (set it in Settings)")
    return new ChatOpenAI({ apiKey, model, temperature: 0.2 })
  }

  const apiKey = azureOpenAIApiKey
  const endpoint = azureOpenAIEndpoint
  const deployment = azureOpenAIDeployment || modelId
  const apiVersion = azureOpenAIApiVersion || "2024-02-15-preview"

  if (!apiKey) throw new Error("Missing Azure OpenAI key (set it in Settings)")
  if (!endpoint) throw new Error("Missing Azure OpenAI endpoint (set it in Settings)")
  if (!deployment) throw new Error("Missing Azure OpenAI deployment (set it in Settings)")

  return new AzureChatOpenAI({
    azureOpenAIApiKey: apiKey,
    azureOpenAIEndpoint: endpoint,
    azureOpenAIApiDeploymentName: deployment,
    azureOpenAIApiVersion: apiVersion,
    model: deployment,
    temperature: 0.2,
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
  const remote = attachments.filter((path) => /^https?:\/\//i.test(path))
  const local = attachments.filter((path) => !/^https?:\/\//i.test(path))
  let hint = "Use file_read if you need the contents."
  if (remote.length && local.length) {
    hint = "Use visit_link for URLs and file_read for workspace paths."
  } else if (remote.length) {
    hint = "Use visit_link if you need to fetch the attachment."
  }
  return `${content}\n\nAttachments:\n${note}\n${hint}`
}

export interface AgentRunOptions extends AgentEventHandlers {
  headers?: Headers
  contextMessages: ChatMessage[]
  provider?: string
  openRouterApiKey?: string
  openRouterModel?: string
  openAIApiKey?: string
  openAIModel?: string
  azureOpenAIApiKey?: string
  azureOpenAIEndpoint?: string
  azureOpenAIApiVersion?: string
  azureOpenAIDeployment?: string
}

export interface AgentRunResult {
  reply: string
  toolCalls: ToolCall[]
  usageTokens: number
}

async function streamModelMessage(
  llmWithTools: {
    stream: (
      messages: BaseMessage[]
    ) => Promise<AsyncIterable<AIMessageChunk> | IterableReadableStream<AIMessageChunk>>
  },
  history: BaseMessage[],
  onChunk?: (chunk: string) => void
): Promise<AIMessageChunk> {
  let aggregated: AIMessageChunk | null = null
  let emittedText = ""
  let lastEmit = 0
  let sawToolCall = false
  let chunkCount = 0
  let startedEmitting = false

  const MIN_CHUNKS_BEFORE_EMIT = 2
  const MIN_MS_BETWEEN_EMITS = 40

  const stream = await llmWithTools.stream(history)
  for await (const maybeChunk of stream) {
    if (!AIMessageChunk.isInstance(maybeChunk)) continue
    chunkCount += 1

    aggregated = aggregated ? (aggregated.concat(maybeChunk) as AIMessageChunk) : maybeChunk

    if (
      (maybeChunk.tool_call_chunks?.length ?? 0) > 0 ||
      (maybeChunk.tool_calls?.length ?? 0) > 0
    ) {
      sawToolCall = true
    }

    const part = typeof maybeChunk.content === "string" ? maybeChunk.content : ""
    if (!onChunk || part.length === 0) continue

    emittedText += part

    if (
      !startedEmitting &&
      !sawToolCall &&
      emittedText.length > 0 &&
      chunkCount >= MIN_CHUNKS_BEFORE_EMIT
    ) {
      startedEmitting = true
    }

    if (!startedEmitting || sawToolCall) continue

    const now = Date.now()
    if (now - lastEmit < MIN_MS_BETWEEN_EMITS) continue
    lastEmit = now
    onChunk(emittedText)
  }

  if (!aggregated) {
    throw new Error("Model stream returned no chunks")
  }

  const finalText =
    typeof aggregated.content === "string" ? aggregated.content : JSON.stringify(aggregated.content)

  if (onChunk && !sawToolCall && finalText.length > 0) {
    onChunk(finalText)
  }

  return aggregated
}

export async function runAgent({
  headers,
  contextMessages,
  onToolResult,
  onChunk,
  provider,
  openRouterApiKey,
  openRouterModel,
  openAIApiKey,
  openAIModel,
  azureOpenAIApiKey,
  azureOpenAIEndpoint,
  azureOpenAIApiVersion,
  azureOpenAIDeployment,
}: AgentRunOptions): Promise<AgentRunResult> {
  const tools: StructuredToolInterface[] = createToolset({ headers })
  const providerId = normalizeProvider(provider)
  let modelId =
    providerId === "openrouter"
      ? (openRouterModel ?? OPENROUTER_MODEL)
      : providerId === "openai"
        ? (openAIModel ?? "")
        : (azureOpenAIDeployment ?? "")

  let llm = createModel({
    provider: providerId,
    headers,
    modelId,
    openRouterApiKey,
    openAIApiKey,
    azureOpenAIApiKey,
    azureOpenAIEndpoint,
    azureOpenAIApiVersion,
    azureOpenAIDeployment,
  })
  let llmWithTools = llm.bindTools(tools)
  const history: BaseMessage[] = contextMessages.map(toLangChainMessage)

  const executedTools: ToolCall[] = []
  let iterations = 0
  let finalMessage: AIMessageChunk | null = null

  while (iterations < 8) {
    iterations += 1
    let aiMessage: AIMessageChunk
    try {
      aiMessage = await streamModelMessage(llmWithTools, history, onChunk)
    } catch (err) {
      const message = err instanceof Error ? err.message : ""
      const lowered = typeof message === "string" ? message.toLowerCase() : ""
      const shouldFallback = Boolean(
        providerId === "openrouter" &&
        OPENROUTER_FALLBACK_MODEL &&
        modelId !== OPENROUTER_FALLBACK_MODEL &&
        (lowered.includes("support tool use") ||
          lowered.includes("model_not_found") ||
          lowered.includes("model not found"))
      )
      if (shouldFallback) {
        modelId = OPENROUTER_FALLBACK_MODEL
        llm = createModel({
          provider: providerId,
          headers,
          modelId,
          openRouterApiKey,
          openAIApiKey,
          azureOpenAIApiKey,
          azureOpenAIEndpoint,
          azureOpenAIApiVersion,
          azureOpenAIDeployment,
        })
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
          result:
            typeof result === "object" ? (result as Record<string, unknown>) : { output: result },
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
            content: toolMessageContent(record.result ?? record.error ?? ""),
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

  const text =
    typeof finalMessage.content === "string"
      ? finalMessage.content
      : JSON.stringify(finalMessage.content)

  return {
    reply: text,
    toolCalls: executedTools,
    usageTokens: finalMessage.usage_metadata?.total_tokens ?? 0,
  }
}
