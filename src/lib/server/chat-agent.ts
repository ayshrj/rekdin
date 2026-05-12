import { ChatAnthropic } from "@langchain/anthropic"
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
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { AzureChatOpenAI, ChatOpenAI } from "@langchain/openai"

import { OPENROUTER_API_KEY, OPENROUTER_FALLBACK_MODEL, OPENROUTER_MODEL } from "@/configs"
import {
  getOpenAICompatibleProviderConfig,
  getProviderDefaultModel,
  getProviderLabel,
  getProviderModel,
  isOpenAICompatibleProvider,
  normalizeLlmProvider,
} from "@/lib/llm-providers"
import { ChatMessage, ToolCall } from "@/types/chat"
import {
  LlmProvider,
  ProviderSettings,
  TokenUsageEstimate,
  ToolPolicyProfile,
} from "@/types/runtime"

import { createModelToolMessageContent } from "./model-tool-results"
import { getToolApprovalReason, requiresToolApproval } from "./runtime/tool-policy"
import {
  createEmptyTokenUsageEstimate,
  estimateTokens,
  finalizeTokenUsageEstimate,
} from "./token-budget"
import { runWithToolExecutionContext } from "./tool-execution-context"
import { createToolset } from "./tools"
import {
  findBlockedWorkspaceDirectoryReference,
  findBlockedWorkspacePathSegment,
} from "./workspace"

type AgentEventHandlers = {
  onToolStart?: (tool: Partial<ToolCall> & { id: string }) => void | Promise<void>
  onToolResult?: (tool: ToolCall) => void | Promise<void>
  onApprovalRequired?: (approval: {
    sessionId: string
    toolName: string
    arguments: Record<string, unknown>
    reason: string
  }) => boolean | Promise<boolean>
  onChunk?: (chunk: string) => void | Promise<void>
  onWarning?: (warning: string) => void | Promise<void>
}

type BoundToolModel = {
  stream: (
    messages: BaseMessage[]
  ) => Promise<AsyncIterable<AIMessageChunk> | IterableReadableStream<AIMessageChunk>>
}

type ToolCapableChatModel = {
  bindTools: (tools: StructuredToolInterface[]) => BoundToolModel
}

const GEMINI_UNSUPPORTED_TOOL_NAMES = new Set([
  "http_request",
  "download_fetch",
  "json_patch",
  "yaml_patch",
])

const PROTECTED_WORKSPACE_ACCESS_ARGUMENT_KEYS: Record<string, string[]> = {
  file_read: ["path"],
  list_files: ["path"],
  file_stat: ["path"],
  workspace_stats: ["path"],
  file_head_tail: ["path"],
  file_outline: ["path"],
  symbol_search: ["path"],
  symbol_references: ["path"],
  dependency_graph: ["path"],
  duplicate_code_candidates: ["path"],
  dead_code_candidates: ["path"],
  code_map: ["path"],
  file_search: ["path"],
  write_file: ["path"],
  file_replace: ["path"],
  json_patch: ["path"],
  yaml_patch: ["path"],
  archive_create: ["paths"],
  archive_extract: ["outputDir"],
  extract_todos: ["path"],
  pdf_extract_text: ["path"],
  docx_extract_text: ["path"],
  csv_preview: ["path"],
  csv_query: ["path"],
  json_query: ["path"],
  yaml_query: ["path"],
  sqlite_query: ["path"],
  markdown_frontmatter: ["path"],
  secret_scan: ["path"],
  workspace_permissions_scan: ["path"],
  asset_manifest: ["path"],
  svg_optimize: ["path"],
  git_diff_summary: ["path"],
  git_blame: ["path"],
  git_file_history: ["path"],
  git_staged_diff: ["path"],
  git_show: ["path"],
  git_patch_preview: ["path"],
  git_apply_patch: ["patch"],
  execute_command: ["command", "cwd"],
  shell_execute: ["command", "cwd"],
  node_execute: ["code"],
  python_execute: ["code"],
  node_codeact: ["code"],
  python_codeact: ["code"],
  shell_codeact: ["code"],
}
const FREEFORM_PROTECTED_WORKSPACE_ARGUMENT_KEYS = new Set(["command", "code", "patch"])

function findProtectedWorkspaceAccessReference(key: string, value: unknown): string | undefined {
  if (typeof value === "string") {
    return FREEFORM_PROTECTED_WORKSPACE_ARGUMENT_KEYS.has(key)
      ? findBlockedWorkspaceDirectoryReference(value)
      : findBlockedWorkspacePathSegment(value)
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const blockedDirectory = findProtectedWorkspaceAccessReference(key, item)
      if (blockedDirectory) return blockedDirectory
    }
  }
  return undefined
}

function getProtectedWorkspaceAccessReason(toolName: string, args: unknown) {
  const keys = PROTECTED_WORKSPACE_ACCESS_ARGUMENT_KEYS[toolName]
  if (!keys || !args || typeof args !== "object") return undefined
  const argRecord = args as Record<string, unknown>
  for (const key of keys) {
    const blockedDirectory = findProtectedWorkspaceAccessReference(key, argRecord[key])
    if (blockedDirectory) {
      return `This tool references protected workspace directory "${blockedDirectory}". Rekdin skips generated dependency/build folders by default; explicit access needs approval.`
    }
  }
  return undefined
}

/**
 * Creates the provider-specific LangChain chat model from normalized provider settings.
 * Missing credentials fail early with user-facing setup errors.
 */
function createModel({
  provider,
  origin,
  modelId,
  openRouterApiKey,
  openAIApiKey,
  geminiApiKey,
  claudeApiKey,
  grokApiKey,
  azureOpenAIApiKey,
  azureOpenAIEndpoint,
  azureOpenAIApiVersion,
  azureOpenAIDeployment,
}: {
  provider: LlmProvider
  origin?: string
  modelId: string
  openRouterApiKey?: string
  openAIApiKey?: string
  geminiApiKey?: string
  claudeApiKey?: string
  grokApiKey?: string
  azureOpenAIApiKey?: string
  azureOpenAIEndpoint?: string
  azureOpenAIApiVersion?: string
  azureOpenAIDeployment?: string
}): ToolCapableChatModel {
  if (provider === "gemini") {
    const apiKey = geminiApiKey
    const model = modelId || getProviderDefaultModel("gemini")
    if (!apiKey) throw new Error("Missing Gemini API key (set it in Settings)")
    if (!model) throw new Error("Missing Gemini model (set it in Settings)")

    return new ChatGoogleGenerativeAI({
      apiKey,
      model,
      temperature: 0.2,
    })
  }

  if (provider === "claude") {
    const apiKey = claudeApiKey
    const model = modelId || getProviderDefaultModel("claude")
    if (!apiKey) throw new Error("Missing Claude API key (set it in Settings)")
    if (!model) throw new Error("Missing Claude model (set it in Settings)")

    return new ChatAnthropic({
      apiKey,
      model,
      temperature: 0.2,
    })
  }

  if (isOpenAICompatibleProvider(provider)) {
    const apiKey =
      provider === "openrouter"
        ? (openRouterApiKey ?? OPENROUTER_API_KEY)
        : provider === "openai"
          ? openAIApiKey
          : grokApiKey
    const model =
      modelId || (provider === "openrouter" ? OPENROUTER_MODEL : getProviderDefaultModel(provider))
    const label = getProviderLabel(provider)
    if (!apiKey) throw new Error(`Missing ${label} API key (set it in Settings)`)
    if (!model) throw new Error(`Missing ${label} model (set it in Settings)`)
    const configuration = getOpenAICompatibleProviderConfig(provider, origin)

    return new ChatOpenAI({
      apiKey,
      model,
      temperature: 0.2,
      configuration,
    })
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

function addToolTokenEstimate(
  estimate: TokenUsageEstimate,
  result: { originalTokens: number; tokens: number }
) {
  estimate.originalToolResultTokens += result.originalTokens
  estimate.toolResultTokens += result.tokens
  estimate.savedToolResultTokens = Math.max(
    estimate.originalToolResultTokens - estimate.toolResultTokens,
    0
  )
}

function estimateToolSchemaTokens(tools: StructuredToolInterface[]) {
  return estimateTokens(
    JSON.stringify(
      tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
      }))
    )
  )
}

/**
 * Converts persisted Rekdin messages into LangChain messages, including matching ToolMessages for
 * assistant tool calls so providers accept historical tool-call context.
 */
function toLangChainMessages(
  message: ChatMessage,
  tokenEstimate?: TokenUsageEstimate
): BaseMessage[] {
  if (message.role === "user") {
    const content = formatUserContent(message.content, message.attachments)
    if (tokenEstimate) tokenEstimate.historyTokens += estimateTokens(content)
    return [new HumanMessage(content)]
  }
  if (message.role === "assistant") {
    const toolCalls = message.toolCalls ?? []
    if (tokenEstimate) {
      tokenEstimate.historyTokens += estimateTokens(
        JSON.stringify({
          role: message.role,
          content: message.content,
          toolCalls: toolCalls.map((call) => ({
            name: call.name,
            arguments: call.arguments,
          })),
        })
      )
    }
    const aiMsg = new AIMessage({
      content: message.content,
      tool_calls: toolCalls.map((call) => ({
        id: call.id,
        name: call.name,
        args: call.arguments,
      })),
    })
    // Each tool call in history must be followed by a ToolMessage with its result,
    // otherwise OpenAI rejects the conversation with a 400.
    const toolMessages = toolCalls
      .filter((call) => call.result !== undefined || call.error !== undefined)
      .map((call) => {
        const toolContent = createModelToolMessageContent(
          call.name,
          call.result ?? { error: call.error ?? "unknown error" },
          "history"
        )
        if (tokenEstimate) addToolTokenEstimate(tokenEstimate, toolContent)
        return new ToolMessage({
          tool_call_id: call.id,
          content: toolContent.content,
        })
      })
    return [aiMsg, ...toolMessages]
  }
  if (tokenEstimate) tokenEstimate.historyTokens += estimateTokens(message.content)
  return [new SystemMessage(message.content)]
}

/**
 * Appends attachment hints to user content so the model knows whether to use file or network tools.
 */
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
  sessionId: string
  contextMessages: ChatMessage[]
  systemPrompt?: string
  providerSettings: ProviderSettings
  workspaceRoot?: string
  origin?: string
  toolHeaders?: HeadersInit
  allowedToolNames?: string[]
  toolPolicy?: ToolPolicyProfile
}

export interface AgentRunResult {
  reply: string
  toolCalls: ToolCall[]
  usageTokens: number
  tokenUsageEstimate: TokenUsageEstimate
  model: string
  retryCount: number
}

/**
 * Identifies transient provider failures that are worth retrying inside a single agent turn.
 */
function isRetryableModelError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : ""
  return (
    message.includes("timeout") ||
    message.includes("econnreset") ||
    message.includes("temporar") ||
    message.includes("network") ||
    message.includes("rate limit")
  )
}

/**
 * Streams one model response, aggregates chunks into a final message, and throttles visible text
 * deltas so the UI does not flicker while tool calls are still forming.
 */
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
    await onChunk(emittedText)
  }

  if (!aggregated) {
    throw new Error("Model stream returned no chunks")
  }

  const finalText =
    typeof aggregated.content === "string" ? aggregated.content : JSON.stringify(aggregated.content)

  if (onChunk && !sawToolCall && finalText.length > 0) {
    await onChunk(finalText)
  }

  return aggregated
}

/**
 * Runs the LangChain model/tool loop for one turn.
 *
 * The loop binds the allowed toolset, streams model output, executes requested tools, feeds tool
 * results back as ToolMessages, handles provider fallbacks/retries, and returns the final assistant
 * text plus the executed tool timeline.
 */
export async function runAgent({
  sessionId,
  contextMessages,
  systemPrompt,
  providerSettings,
  workspaceRoot,
  origin,
  toolHeaders,
  allowedToolNames,
  toolPolicy,
  onToolStart,
  onToolResult,
  onApprovalRequired,
  onChunk,
  onWarning,
}: AgentRunOptions): Promise<AgentRunResult> {
  return runWithToolExecutionContext({ sessionId, workspaceRoot }, async () => {
    const providerId = normalizeLlmProvider(providerSettings.provider)
    const MAX_API_TOOLS = 128
    const allTools: StructuredToolInterface[] = createToolset({
      headers: toolHeaders,
      allowedToolNames,
    }).filter((tool) =>
      providerId === "gemini" ? !GEMINI_UNSUPPORTED_TOOL_NAMES.has(tool.name) : true
    )

    if (providerId === "gemini") {
      const disabledTools = createToolset({
        headers: toolHeaders,
        allowedToolNames,
      })
        .map((tool) => tool.name)
        .filter((name) => GEMINI_UNSUPPORTED_TOOL_NAMES.has(name))
      if (disabledTools.length > 0) {
        await onWarning?.(`Gemini disables unsupported tool schemas: ${disabledTools.join(", ")}.`)
      }
    }

    const tools: StructuredToolInterface[] =
      allTools.length > MAX_API_TOOLS ? allTools.slice(0, MAX_API_TOOLS) : allTools
    if (allTools.length > MAX_API_TOOLS) {
      const trimmed = allTools.slice(MAX_API_TOOLS).map((t) => t.name)
      await onWarning?.(
        `Tool count (${allTools.length}) exceeds API limit of ${MAX_API_TOOLS}. Trimmed: ${trimmed.join(", ")}.`
      )
    }

    let modelId =
      getProviderModel(providerId, providerSettings).trim() ||
      (providerId === "openrouter"
        ? OPENROUTER_MODEL
        : providerId === "azure_openai"
          ? ""
          : getProviderDefaultModel(providerId))

    let llm = createModel({
      provider: providerId,
      origin,
      modelId,
      openRouterApiKey: providerSettings.openRouterApiKey,
      openAIApiKey: providerSettings.openAIApiKey,
      geminiApiKey: providerSettings.geminiApiKey,
      claudeApiKey: providerSettings.claudeApiKey,
      grokApiKey: providerSettings.grokApiKey,
      azureOpenAIApiKey: providerSettings.azureOpenAIApiKey,
      azureOpenAIEndpoint: providerSettings.azureOpenAIEndpoint,
      azureOpenAIApiVersion: providerSettings.azureOpenAIApiVersion,
      azureOpenAIDeployment: providerSettings.azureOpenAIDeployment,
    })
    let llmWithTools = llm.bindTools(tools)
    const tokenUsageEstimate = createEmptyTokenUsageEstimate()
    tokenUsageEstimate.systemPromptTokens = estimateTokens(systemPrompt ?? "")
    tokenUsageEstimate.toolSchemaTokens = estimateToolSchemaTokens(tools)
    const history: BaseMessage[] = [
      ...(systemPrompt ? [new SystemMessage(systemPrompt)] : []),
      ...contextMessages.flatMap((message) => toLangChainMessages(message, tokenUsageEstimate)),
    ]

    const executedTools: ToolCall[] = []
    let iterations = 0
    let finalMessage: AIMessageChunk | null = null
    let retryCount = 0

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
          retryCount += 1
          await onWarning?.(`Primary model could not use tools; falling back to ${modelId}.`)
          llm = createModel({
            provider: providerId,
            origin,
            modelId,
            openRouterApiKey: providerSettings.openRouterApiKey,
            openAIApiKey: providerSettings.openAIApiKey,
            geminiApiKey: providerSettings.geminiApiKey,
            claudeApiKey: providerSettings.claudeApiKey,
            grokApiKey: providerSettings.grokApiKey,
            azureOpenAIApiKey: providerSettings.azureOpenAIApiKey,
            azureOpenAIEndpoint: providerSettings.azureOpenAIEndpoint,
            azureOpenAIApiVersion: providerSettings.azureOpenAIApiVersion,
            azureOpenAIDeployment: providerSettings.azureOpenAIDeployment,
          })
          llmWithTools = llm.bindTools(tools)
          iterations -= 1
          continue
        }
        if (isRetryableModelError(err) && iterations < 8) {
          retryCount += 1
          await onWarning?.("Transient model error encountered; retrying the request.")
          continue
        }
        throw err
      }
      if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
        history.push(aiMessage)
        for (const call of aiMessage.tool_calls) {
          const toolName = call.name
          if (!toolName) continue
          const tool = tools.find((t) => t.name === toolName)
          if (!tool) continue
          const started = Date.now()
          const toolCallId =
            call.id ?? `tool_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
          await onToolStart?.({
            id: toolCallId,
            name: toolName,
            arguments: call.args,
            timestamp: new Date().toISOString(),
            status: "running",
          })
          let status: ToolCall["status"] = "success"
          let result: unknown
          let error: string | undefined
          try {
            const approvalReasons: string[] = []
            if (toolPolicy && requiresToolApproval(toolName, toolPolicy)) {
              approvalReasons.push(getToolApprovalReason(toolName, toolPolicy))
            }
            const protectedWorkspaceAccessReason = getProtectedWorkspaceAccessReason(
              toolName,
              call.args
            )
            if (protectedWorkspaceAccessReason) {
              approvalReasons.push(protectedWorkspaceAccessReason)
            }
            if (approvalReasons.length > 0) {
              const approved = await onApprovalRequired?.({
                sessionId,
                toolName,
                arguments:
                  call.args && typeof call.args === "object"
                    ? (call.args as Record<string, unknown>)
                    : { value: call.args },
                reason: approvalReasons.join(" "),
              })
              if (!approved) {
                throw new Error(`Tool execution rejected by approval gate: ${toolName}`)
              }
            }
            result = protectedWorkspaceAccessReason
              ? await runWithToolExecutionContext(
                  { sessionId, workspaceRoot, allowProtectedWorkspaceAccess: true },
                  async () => await tool.invoke(call.args)
                )
              : await tool.invoke(call.args)
          } catch (err) {
            status = "error"
            error = err instanceof Error ? err.message : "Unknown error"
            result = { error }
          }
          const record: ToolCall = {
            id: toolCallId,
            name: toolName,
            arguments: call.args,
            result:
              typeof result === "object" ? (result as Record<string, unknown>) : { output: result },
            status,
            error,
            timestamp: new Date().toISOString(),
            duration: Date.now() - started,
          }
          executedTools.push(record)
          await onToolResult?.(record)
          const toolContent = createModelToolMessageContent(
            record.name,
            record.result ?? record.error ?? "",
            "current"
          )
          addToolTokenEstimate(tokenUsageEstimate, toolContent)
          history.push(
            new ToolMessage({
              tool_call_id: record.id,
              content: toolContent.content,
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
    const completionTokens = estimateTokens(text)
    const finalizedTokenEstimate = finalizeTokenUsageEstimate(tokenUsageEstimate, completionTokens)

    return {
      reply: text,
      toolCalls: executedTools,
      usageTokens: finalMessage.usage_metadata?.total_tokens ?? finalizedTokenEstimate.totalTokens,
      tokenUsageEstimate: finalizedTokenEstimate,
      model: modelId,
      retryCount,
    }
  })
}
