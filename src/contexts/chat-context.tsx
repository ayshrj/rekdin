"use client"

import * as React from "react"
import { toast } from "sonner"

import {
  appendMessage,
  deleteMessage,
  deleteSession as deleteSessionFromDb,
  deleteToolResults,
  loadSession,
  loadSessions,
  loadSettings as loadLocalSettings,
  loadToolResults,
  replaceMessage,
  replaceToolResult,
  saveSession,
  saveSettings as saveLocalSettings,
  saveToolResults,
  updateSessionTitle,
} from "@/lib/client/idb"
import { parseLLMError } from "@/lib/llm-errors"
import {
  getProviderDefaultModel,
  getProviderMissingConfigMessage,
  hasProviderCredentials,
  normalizeLlmProvider,
} from "@/lib/llm-providers"
import { logger } from "@/lib/logger"
import { ChatMessage, ChatSession, ToolResultEntry } from "@/types/chat"
import { LlmProvider, ServerEventV2, ServerSettings } from "@/types/runtime"

type ChatContextValue = {
  sessions: ChatSession[]
  currentSessionId: string | null
  messages: ChatMessage[]
  toolResults: ToolResultEntry[]
  isLoading: boolean
  isThinking: boolean
  connected: boolean
  llmProvider: LlmProvider
  openRouterModel: string
  openRouterApiKey: string
  openAIModel: string
  openAIApiKey: string
  geminiModel: string
  geminiApiKey: string
  claudeModel: string
  claudeApiKey: string
  grokModel: string
  grokApiKey: string
  azureOpenAIApiKey: string
  azureOpenAIEndpoint: string
  azureOpenAIApiVersion: string
  azureOpenAIDeployment: string
  liveModeEnabled: boolean
  cloudinaryCloudName: string
  cloudinaryApiKey: string
  cloudinaryApiSecret: string
  updateLlmSettings: (next: Partial<LlmSettings>) => void
  updateCloudinarySettings: (next: {
    cloudName?: string
    apiKey?: string
    apiSecret?: string
  }) => void
  createSession: () => Promise<void>
  joinSession: (sessionId: string) => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
  sendMessage: (
    content: string,
    attachments?: File[],
    metadata?: {
      agentType?: string
      responseSchema?: Record<string, unknown> | null
      workflowId?: string
    }
  ) => Promise<void>
  refreshSessions: () => Promise<void>
}

type LegacyServerEvent =
  | { type: "ack"; message: ChatMessage }
  | { type: "assistant_thinking"; value: boolean }
  | { type: "message_chunk"; messageId: string; content: string }
  | { type: "message_complete"; message: ChatMessage; tempId?: string }
  | { type: "tool_result"; toolCall: Record<string, unknown> }
  | { type: "error"; error: string }

const ChatContext = React.createContext<ChatContextValue | undefined>(undefined)

type LlmSettings = {
  provider: LlmProvider
  openRouterModel: string
  openRouterApiKey: string
  openAIModel: string
  openAIApiKey: string
  geminiModel: string
  geminiApiKey: string
  claudeModel: string
  claudeApiKey: string
  grokModel: string
  grokApiKey: string
  azureOpenAIApiKey: string
  azureOpenAIEndpoint: string
  azureOpenAIApiVersion: string
  azureOpenAIDeployment: string
  liveModeEnabled: boolean
}

/**
 * Loads persisted server settings so the browser mirrors the active provider/runtime config.
 */
async function fetchServerSettings(): Promise<ServerSettings> {
  const response = await fetch("/api/settings", { cache: "no-store" })
  const data = (await response.json().catch(() => null)) as { settings?: ServerSettings } | null
  if (!response.ok || !data?.settings) {
    throw new Error("Unable to load server settings")
  }
  return data.settings
}

/**
 * Persists changed runtime settings to the server-side JSON store.
 */
async function saveServerSettings(next: Partial<ServerSettings>) {
  const response = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(next),
  })
  const data = (await response.json().catch(() => null)) as {
    settings?: ServerSettings
    error?: string
  } | null
  if (!response.ok || !data?.settings) {
    throw new Error(data?.error ?? "Unable to save server settings")
  }
  return data.settings
}

function isCloudinaryUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.hostname.includes("cloudinary.com") && parsed.pathname.includes("/upload/")
  } catch {
    return false
  }
}

function collectCloudinaryUrlsFromValue(value: unknown, urls: Set<string>) {
  if (typeof value === "string") {
    if (isCloudinaryUrl(value)) urls.add(value)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectCloudinaryUrlsFromValue(item, urls))
    return
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectCloudinaryUrlsFromValue(item, urls))
  }
}

/**
 * Extracts uploaded Cloudinary asset URLs referenced by messages/tool results for cleanup.
 */
function collectCloudinaryUrls(messages: ChatMessage[], toolResults: ToolResultEntry[] = []) {
  const urls = new Set<string>()
  messages.forEach((message) => {
    message.attachments?.forEach((attachment) => {
      if (isCloudinaryUrl(attachment)) urls.add(attachment)
    })
    message.toolCalls?.forEach((call) => {
      collectCloudinaryUrlsFromValue(call?.result, urls)
    })
  })
  toolResults.forEach((entry) => {
    collectCloudinaryUrlsFromValue(entry.result, urls)
  })
  return Array.from(urls)
}

/**
 * Converts streamed tool-call records into the workspace panel's IndexedDB-friendly result shape.
 */
function toToolResultEntry(toolCall: Record<string, unknown>, fallbackTimestamp?: string) {
  const id = typeof toolCall.id === "string" ? toolCall.id : crypto.randomUUID()
  const toolName =
    typeof toolCall.name === "string"
      ? toolCall.name
      : typeof toolCall.toolName === "string"
        ? toolCall.toolName
        : "tool"
  const status = typeof toolCall.status === "string" ? toolCall.status : "success"
  const args =
    typeof toolCall.arguments !== "undefined"
      ? (toolCall.arguments as Record<string, unknown>)
      : ((("toolInput" in toolCall && toolCall.toolInput) as Record<string, unknown>) ?? {})
  const rawResult =
    typeof toolCall.result !== "undefined"
      ? toolCall.result
      : (("toolResult" in toolCall && toolCall.toolResult) ?? {})
  const result =
    rawResult === null
      ? undefined
      : typeof rawResult === "string" || typeof rawResult === "object"
        ? (rawResult as Record<string, unknown> | string)
        : undefined
  const timestamp =
    typeof toolCall.timestamp === "string"
      ? toolCall.timestamp
      : (fallbackTimestamp ?? new Date().toISOString())
  return {
    id,
    toolName,
    status,
    arguments: args,
    result,
    timestamp,
  }
}

/**
 * Rebuilds the tool result list from persisted assistant messages when hydrating a session.
 */
function extractToolResults(messages: ChatMessage[]) {
  const results: ToolResultEntry[] = []
  messages.forEach((message) => {
    message.toolCalls?.forEach((call) => {
      if (call && typeof call === "object") {
        results.push(
          toToolResultEntry(call as unknown as Record<string, unknown>, message.timestamp)
        )
      }
    })
  })
  return results
}

/**
 * Limits client-provided history before sending it to `/api/chat` to reduce request size.
 */
function trimHistory(messages: ChatMessage[], maxChars = 20000, maxMessages = 50): ChatMessage[] {
  let total = 0
  const selected: ChatMessage[] = []
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i]
    const len = msg.content?.length ?? 0
    if (selected.length >= maxMessages) break
    if (selected.length > 0 && total + len > maxChars) break
    total += len
    selected.push(msg)
  }
  const trimmed = selected.reverse()
  if (trimmed.length < messages.length) {
    const sessionId = messages[0]?.sessionId ?? trimmed[0]?.sessionId ?? ""
    trimmed.unshift({
      id: crypto.randomUUID(),
      sessionId,
      role: "system",
      content: "Conversation truncated to fit context window. Summaries may omit earlier details.",
      timestamp: new Date().toISOString(),
    })
    logger.warn("Trimmed chat history to avoid context limits", {
      kept: trimmed.length,
      dropped: messages.length - trimmed.length,
    })
  }
  return trimmed
}

/**
 * Uploads selected attachments through the Rekdin upload route and returns paths/URLs for tools.
 */
async function uploadFiles(files: File[]) {
  if (!files || files.length === 0) return []
  const formData = new FormData()
  files.forEach((file) => formData.append("files", file))
  const res = await fetch("/api/upload", { method: "POST", body: formData })
  if (!res.ok) throw new Error("File upload failed")
  const data = (await res.json()) as { files: string[] }
  return data.files
}

/**
 * Owns browser-side chat orchestration: session hydration, settings sync, optimistic messages,
 * attachment uploads, SSE consumption, tool result mirroring, and IndexedDB persistence.
 */
export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = React.useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = React.useState<string | null>(null)
  const [llmProvider, setLlmProvider] = React.useState<LlmProvider>("openrouter")
  const [openRouterModel, setOpenRouterModel] = React.useState(
    getProviderDefaultModel("openrouter")
  )
  const [openRouterApiKey, setOpenRouterApiKey] = React.useState("")
  const [openAIModel, setOpenAIModel] = React.useState(getProviderDefaultModel("openai"))
  const [openAIApiKey, setOpenAIApiKey] = React.useState("")
  const [geminiModel, setGeminiModel] = React.useState(getProviderDefaultModel("gemini"))
  const [geminiApiKey, setGeminiApiKey] = React.useState("")
  const [claudeModel, setClaudeModel] = React.useState(getProviderDefaultModel("claude"))
  const [claudeApiKey, setClaudeApiKey] = React.useState("")
  const [grokModel, setGrokModel] = React.useState(getProviderDefaultModel("grok"))
  const [grokApiKey, setGrokApiKey] = React.useState("")
  const [azureOpenAIApiKey, setAzureOpenAIApiKey] = React.useState("")
  const [azureOpenAIEndpoint, setAzureOpenAIEndpoint] = React.useState("")
  const [azureOpenAIApiVersion, setAzureOpenAIApiVersion] = React.useState("2024-02-15-preview")
  const [azureOpenAIDeployment, setAzureOpenAIDeployment] = React.useState("")
  const [liveModeEnabled, setLiveModeEnabled] = React.useState(true)
  const [cloudinaryCloudName, setCloudinaryCloudName] = React.useState("")
  const [cloudinaryApiKey, setCloudinaryApiKey] = React.useState("")
  const [cloudinaryApiSecret, setCloudinaryApiSecret] = React.useState("")
  const [messagesBySession, setMessagesBySession] = React.useState<Record<string, ChatMessage[]>>(
    {}
  )
  const [toolResults, setToolResults] = React.useState<ToolResultEntry[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [isThinking, setIsThinking] = React.useState(false)
  const [connected, setConnected] = React.useState(false)
  const bootstrappedRef = React.useRef(false)
  const settingsHydratedRef = React.useRef(false)
  const uploadedDataUrlsRef = React.useRef(new Map<string, string>())
  const pendingUploadsRef = React.useRef(new Map<string, Promise<string>>())
  const draftPersistRef = React.useRef(new Map<string, number>())

  const mergeToolResults = React.useCallback(
    (current: ToolResultEntry[], incoming: ToolResultEntry[]) => {
      if (incoming.length === 0) return current
      const byId = new Map(current.map((entry) => [entry.id, entry] as const))
      incoming.forEach((entry) => {
        byId.set(entry.id, entry)
      })
      const orderedIds = [
        ...current.map((entry) => entry.id),
        ...incoming
          .map((entry) => entry.id)
          .filter((id) => !current.some((entry) => entry.id === id)),
      ]
      return orderedIds.map((id) => byId.get(id)!).filter(Boolean)
    },
    []
  )

  const dataUrlToFile = React.useCallback(async (dataUrl: string, label: string) => {
    const response = await fetch(dataUrl)
    const blob = await response.blob()
    const mime = blob.type || "application/octet-stream"
    const extension = mime.includes("/") ? mime.split("/")[1] : "bin"
    const safeLabel = label.replace(/[^a-z0-9_-]/gi, "_")
    const filename = `${safeLabel}_${Date.now()}.${extension}`
    return new File([blob], filename, { type: mime })
  }, [])

  const uploadDataUrl = React.useCallback(
    async (dataUrl: string, label: string) => {
      const cached = uploadedDataUrlsRef.current.get(dataUrl)
      if (cached) return cached
      const pending = pendingUploadsRef.current.get(dataUrl)
      if (pending) return await pending
      if (!cloudinaryCloudName || !cloudinaryApiKey || !cloudinaryApiSecret) {
        return dataUrl
      }
      const uploadPromise = (async () => {
        try {
          const file = await dataUrlToFile(dataUrl, label)
          const [url] = await uploadFiles([file])
          if (!url) return dataUrl
          uploadedDataUrlsRef.current.set(dataUrl, url)
          return url
        } catch (err) {
          logger.error("Failed to upload screenshot to Cloudinary", err)
          return dataUrl
        }
      })()
      pendingUploadsRef.current.set(dataUrl, uploadPromise)
      try {
        return await uploadPromise
      } finally {
        pendingUploadsRef.current.delete(dataUrl)
      }
    },
    [cloudinaryApiKey, cloudinaryApiSecret, cloudinaryCloudName, dataUrlToFile]
  )

  const replaceDataUrls = React.useCallback(
    async function replaceDataUrls(
      value: unknown,
      label: string
    ): Promise<{ value: unknown; changed: boolean }> {
      if (typeof value === "string") {
        if (value.startsWith("data:image/")) {
          const url = await uploadDataUrl(value, label)
          return { value: url, changed: url !== value }
        }
        return { value, changed: false }
      }
      if (Array.isArray(value)) {
        let changed = false
        const next: unknown[] = []
        for (const item of value) {
          const replaced = await replaceDataUrls(item, label)
          if (replaced.changed) changed = true
          next.push(replaced.value)
        }
        return { value: changed ? next : value, changed }
      }
      if (value && typeof value === "object") {
        let changed = false
        const next: Record<string, unknown> = {}
        for (const [key, item] of Object.entries(value)) {
          const replaced = await replaceDataUrls(item, `${label}_${key}`)
          if (replaced.changed) changed = true
          next[key] = replaced.value
        }
        return { value: changed ? next : value, changed }
      }
      return { value, changed: false }
    },
    [uploadDataUrl]
  )

  const normalizeToolCall = React.useCallback(
    async (toolCall: Record<string, unknown>) => {
      const rawResult =
        (toolCall.result as Record<string, unknown>) ??
        (("toolResult" in toolCall && toolCall.toolResult) as Record<string, unknown>) ??
        null
      if (!rawResult) return toolCall
      const label =
        typeof toolCall.name === "string"
          ? toolCall.name
          : typeof toolCall.toolName === "string"
            ? toolCall.toolName
            : "tool"
      const replaced = await replaceDataUrls(rawResult, label)
      if (!replaced.changed) return toolCall
      const next = { ...toolCall, result: replaced.value }
      if ("toolResult" in toolCall) {
        return { ...(next as Record<string, unknown>), toolResult: replaced.value }
      }
      return next
    },
    [replaceDataUrls]
  )

  const normalizeMessageToolCalls = React.useCallback(
    async (message: ChatMessage) => {
      if (!message.toolCalls || message.toolCalls.length === 0) return message
      let changed = false
      const nextCalls = []
      for (const call of message.toolCalls) {
        const normalized = await normalizeToolCall(call as unknown as Record<string, unknown>)
        if (normalized !== call) changed = true
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nextCalls.push(normalized as any)
      }
      if (!changed) return message
      return { ...message, toolCalls: nextCalls }
    },
    [normalizeToolCall]
  )

  const updateMessages = React.useCallback(
    (sessionId: string, updater: (messages: ChatMessage[]) => ChatMessage[]) => {
      setMessagesBySession((prev) => {
        const next: Record<string, ChatMessage[]> = { ...prev }
        next[sessionId] = updater(prev[sessionId] ?? [])
        return next
      })
    },
    []
  )

  const hydrateFromIdb = React.useCallback(
    async (preferredSessionId?: string | null) => {
      try {
        logger.debug("Hydrating sessions from IndexedDB")
        const stored = await loadSessions()
        if (stored.length === 0) {
          logger.info("No sessions in IndexedDB")
          setSessions([])
          setMessagesBySession({})
          setCurrentSessionId(null)
          setToolResults([])
          return []
        }
        const sorted = [...stored].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
        const messagesById: Record<string, ChatMessage[]> = {}
        sorted.forEach((session) => {
          messagesById[session.id] = session.messages ?? []
        })
        const preferred =
          preferredSessionId && sorted.some((session) => session.id === preferredSessionId)
            ? preferredSessionId
            : null
        const currentValid =
          currentSessionId && sorted.some((session) => session.id === currentSessionId)
            ? currentSessionId
            : null
        const resolvedSessionId = currentValid ?? preferred ?? sorted[0]?.id ?? null
        logger.info(
          "Loaded sessions from IndexedDB",
          sorted.map((s) => s.id)
        )
        setSessions(sorted)
        setMessagesBySession(messagesById)
        setCurrentSessionId(resolvedSessionId)
        if (resolvedSessionId) {
          const storedToolResults = await loadToolResults(resolvedSessionId)
          const derivedResults = extractToolResults(messagesById[resolvedSessionId] ?? [])
          const nextToolResults = storedToolResults.length > 0 ? storedToolResults : derivedResults
          setToolResults(nextToolResults)
          if (storedToolResults.length === 0 && derivedResults.length > 0) {
            void saveToolResults(resolvedSessionId, derivedResults)
          }
        } else {
          setToolResults([])
        }
        return sorted
      } catch (err) {
        setConnected(false)
        toast.error(err instanceof Error ? err.message : "Unable to load saved sessions")
        logger.error("Failed to hydrate from IndexedDB", err)
        return null
      }
    },
    [currentSessionId]
  )

  const createSession = React.useCallback(async (): Promise<void> => {
    setCurrentSessionId(null)
    setToolResults([])
  }, [])

  React.useEffect(() => {
    if (bootstrappedRef.current) return
    bootstrappedRef.current = true
    void (async () => {
      let preferredSessionId: string | null = null
      try {
        const serverSettings = await fetchServerSettings()
        setLlmProvider(normalizeLlmProvider(serverSettings.llmProvider))
        setOpenRouterModel(serverSettings.openRouterModel || getProviderDefaultModel("openrouter"))
        setOpenRouterApiKey(serverSettings.openRouterApiKey || "")
        setOpenAIModel(serverSettings.openAIModel || getProviderDefaultModel("openai"))
        setOpenAIApiKey(serverSettings.openAIApiKey || "")
        setGeminiModel(serverSettings.geminiModel || getProviderDefaultModel("gemini"))
        setGeminiApiKey(serverSettings.geminiApiKey || "")
        setClaudeModel(serverSettings.claudeModel || getProviderDefaultModel("claude"))
        setClaudeApiKey(serverSettings.claudeApiKey || "")
        setGrokModel(serverSettings.grokModel || getProviderDefaultModel("grok"))
        setGrokApiKey(serverSettings.grokApiKey || "")
        setAzureOpenAIApiKey(serverSettings.azureOpenAIApiKey || "")
        setAzureOpenAIEndpoint(serverSettings.azureOpenAIEndpoint || "")
        setAzureOpenAIApiVersion(serverSettings.azureOpenAIApiVersion || "2024-02-15-preview")
        setAzureOpenAIDeployment(serverSettings.azureOpenAIDeployment || "")
        setLiveModeEnabled(
          typeof serverSettings.liveModeEnabled === "boolean"
            ? serverSettings.liveModeEnabled
            : true
        )
        setCloudinaryCloudName(serverSettings.cloudinaryCloudName || "")
        setCloudinaryApiKey(serverSettings.cloudinaryApiKey || "")
        setCloudinaryApiSecret(serverSettings.cloudinaryApiSecret || "")

        const localSettings = await loadLocalSettings()
        if (typeof localSettings.currentSessionId === "string") {
          preferredSessionId = localSettings.currentSessionId
        } else if (typeof serverSettings.currentSessionId === "string") {
          preferredSessionId = serverSettings.currentSessionId
        }
      } catch (err) {
        logger.error("Failed to load startup settings", err)
      } finally {
        settingsHydratedRef.current = true
      }
      void hydrateFromIdb(preferredSessionId)
    })()
  }, [hydrateFromIdb])

  React.useEffect(() => {
    setConnected(
      hasProviderCredentials(llmProvider, {
        openRouterModel,
        openRouterApiKey,
        openAIModel,
        openAIApiKey,
        geminiModel,
        geminiApiKey,
        claudeModel,
        claudeApiKey,
        grokModel,
        grokApiKey,
        azureOpenAIApiKey,
        azureOpenAIEndpoint,
        azureOpenAIApiVersion,
        azureOpenAIDeployment,
      })
    )
  }, [
    azureOpenAIApiKey,
    azureOpenAIApiVersion,
    azureOpenAIDeployment,
    azureOpenAIEndpoint,
    claudeApiKey,
    claudeModel,
    geminiApiKey,
    geminiModel,
    grokApiKey,
    grokModel,
    llmProvider,
    openAIApiKey,
    openAIModel,
    openRouterApiKey,
    openRouterModel,
  ])

  React.useEffect(() => {
    if (!settingsHydratedRef.current) return
    void saveLocalSettings({ currentSessionId })
    void saveServerSettings({ currentSessionId }).catch((err) => {
      logger.warn("Failed to persist current session to server settings", err)
    })
  }, [currentSessionId])

  const updateLlmSettings = React.useCallback((next: Partial<LlmSettings>) => {
    if (typeof next.provider === "string") {
      const value = normalizeLlmProvider(next.provider)
      setLlmProvider(value)
    }
    if (typeof next.openRouterModel === "string") {
      const value = next.openRouterModel.trim()
      setOpenRouterModel(value || getProviderDefaultModel("openrouter"))
    }
    if (typeof next.openRouterApiKey === "string") {
      const value = next.openRouterApiKey.trim()
      setOpenRouterApiKey(value)
    }
    if (typeof next.openAIModel === "string") {
      const value = next.openAIModel.trim()
      setOpenAIModel(value || getProviderDefaultModel("openai"))
    }
    if (typeof next.openAIApiKey === "string") {
      const value = next.openAIApiKey.trim()
      setOpenAIApiKey(value)
    }
    if (typeof next.geminiModel === "string") {
      const value = next.geminiModel.trim()
      setGeminiModel(value || getProviderDefaultModel("gemini"))
    }
    if (typeof next.geminiApiKey === "string") {
      const value = next.geminiApiKey.trim()
      setGeminiApiKey(value)
    }
    if (typeof next.claudeModel === "string") {
      const value = next.claudeModel.trim()
      setClaudeModel(value || getProviderDefaultModel("claude"))
    }
    if (typeof next.claudeApiKey === "string") {
      const value = next.claudeApiKey.trim()
      setClaudeApiKey(value)
    }
    if (typeof next.grokModel === "string") {
      const value = next.grokModel.trim()
      setGrokModel(value || getProviderDefaultModel("grok"))
    }
    if (typeof next.grokApiKey === "string") {
      const value = next.grokApiKey.trim()
      setGrokApiKey(value)
    }
    if (typeof next.azureOpenAIApiKey === "string") {
      const value = next.azureOpenAIApiKey.trim()
      setAzureOpenAIApiKey(value)
    }
    if (typeof next.azureOpenAIEndpoint === "string") {
      const value = next.azureOpenAIEndpoint.trim()
      setAzureOpenAIEndpoint(value)
    }
    if (typeof next.azureOpenAIApiVersion === "string") {
      const value = next.azureOpenAIApiVersion.trim()
      setAzureOpenAIApiVersion(value || "2024-02-15-preview")
    }
    if (typeof next.azureOpenAIDeployment === "string") {
      const value = next.azureOpenAIDeployment.trim()
      setAzureOpenAIDeployment(value)
    }
    if (typeof next.liveModeEnabled === "boolean") {
      setLiveModeEnabled(next.liveModeEnabled)
    }
    void saveServerSettings({
      ...(typeof next.provider === "string"
        ? { llmProvider: normalizeLlmProvider(next.provider) }
        : {}),
      ...(typeof next.openRouterModel === "string"
        ? { openRouterModel: next.openRouterModel.trim() || getProviderDefaultModel("openrouter") }
        : {}),
      ...(typeof next.openRouterApiKey === "string"
        ? { openRouterApiKey: next.openRouterApiKey.trim() }
        : {}),
      ...(typeof next.openAIModel === "string"
        ? { openAIModel: next.openAIModel.trim() || getProviderDefaultModel("openai") }
        : {}),
      ...(typeof next.openAIApiKey === "string" ? { openAIApiKey: next.openAIApiKey.trim() } : {}),
      ...(typeof next.geminiModel === "string"
        ? { geminiModel: next.geminiModel.trim() || getProviderDefaultModel("gemini") }
        : {}),
      ...(typeof next.geminiApiKey === "string" ? { geminiApiKey: next.geminiApiKey.trim() } : {}),
      ...(typeof next.claudeModel === "string"
        ? { claudeModel: next.claudeModel.trim() || getProviderDefaultModel("claude") }
        : {}),
      ...(typeof next.claudeApiKey === "string" ? { claudeApiKey: next.claudeApiKey.trim() } : {}),
      ...(typeof next.grokModel === "string"
        ? { grokModel: next.grokModel.trim() || getProviderDefaultModel("grok") }
        : {}),
      ...(typeof next.grokApiKey === "string" ? { grokApiKey: next.grokApiKey.trim() } : {}),
      ...(typeof next.azureOpenAIApiKey === "string"
        ? { azureOpenAIApiKey: next.azureOpenAIApiKey.trim() }
        : {}),
      ...(typeof next.azureOpenAIEndpoint === "string"
        ? { azureOpenAIEndpoint: next.azureOpenAIEndpoint.trim() }
        : {}),
      ...(typeof next.azureOpenAIApiVersion === "string"
        ? { azureOpenAIApiVersion: next.azureOpenAIApiVersion.trim() || "2024-02-15-preview" }
        : {}),
      ...(typeof next.azureOpenAIDeployment === "string"
        ? { azureOpenAIDeployment: next.azureOpenAIDeployment.trim() }
        : {}),
      ...(typeof next.liveModeEnabled === "boolean"
        ? { liveModeEnabled: next.liveModeEnabled }
        : {}),
    }).catch((err) => {
      logger.error("Failed to save LLM settings to server", err)
      toast.error("Unable to save model settings")
    })
  }, [])

  const updateCloudinarySettings = React.useCallback(
    (next: { cloudName?: string; apiKey?: string; apiSecret?: string }) => {
      if (typeof next.cloudName === "string") {
        const value = next.cloudName.trim()
        setCloudinaryCloudName(value)
      }
      if (typeof next.apiKey === "string") {
        const value = next.apiKey.trim()
        setCloudinaryApiKey(value)
      }
      if (typeof next.apiSecret === "string") {
        const value = next.apiSecret.trim()
        setCloudinaryApiSecret(value)
      }
      void saveServerSettings({
        ...(typeof next.cloudName === "string"
          ? { cloudinaryCloudName: next.cloudName.trim() }
          : {}),
        ...(typeof next.apiKey === "string" ? { cloudinaryApiKey: next.apiKey.trim() } : {}),
        ...(typeof next.apiSecret === "string"
          ? { cloudinaryApiSecret: next.apiSecret.trim() }
          : {}),
      }).catch((err) => {
        logger.error("Failed to save Cloudinary settings to server", err)
        toast.error("Unable to save upload settings")
      })
    },
    []
  )

  const joinSession = React.useCallback(
    async (sessionId: string) => {
      setCurrentSessionId(sessionId)
      const storedToolResults = await loadToolResults(sessionId)
      if (!messagesBySession[sessionId]) {
        const stored = await loadSession(sessionId)
        if (stored) {
          const storedMessages = stored.messages ?? []
          setMessagesBySession((prev) => ({ ...prev, [sessionId]: storedMessages }))
          if (storedToolResults.length > 0) {
            setToolResults(storedToolResults)
          } else {
            const derivedResults = extractToolResults(storedMessages)
            setToolResults(derivedResults)
            if (derivedResults.length > 0) {
              void saveToolResults(sessionId, derivedResults)
            }
          }
          logger.info("Joined session", sessionId)
        }
        return
      }
      if (storedToolResults.length > 0) {
        setToolResults(storedToolResults)
        return
      }
      const derivedResults = extractToolResults(messagesBySession[sessionId] ?? [])
      setToolResults(derivedResults)
      if (derivedResults.length > 0) {
        void saveToolResults(sessionId, derivedResults)
      }
    },
    [messagesBySession]
  )

  const deleteSession = React.useCallback(
    async (sessionId: string) => {
      try {
        let sessionMessages = messagesBySession[sessionId] ?? []
        if (sessionMessages.length === 0) {
          const stored = await loadSession(sessionId)
          sessionMessages = stored?.messages ?? []
        }
        const storedToolResults = await loadToolResults(sessionId)
        const cloudinaryUrls = collectCloudinaryUrls(sessionMessages, storedToolResults)
        if (cloudinaryUrls.length > 0) {
          const res = await fetch("/api/cloudinary/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ urls: cloudinaryUrls }),
          })
          if (!res.ok) {
            const data = (await res.json().catch(() => ({}))) as { error?: string }
            logger.warn(
              "Cloudinary cleanup failed while deleting session",
              data.error ?? res.status
            )
          }
        }
        await deleteSessionFromDb(sessionId)
        await deleteToolResults(sessionId)
        await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" }).catch((error) => {
          logger.warn("Failed to delete server session", error)
        })
        setSessions((prev) => prev.filter((s) => s.id !== sessionId))
        setMessagesBySession((prev) => {
          const next = { ...prev }
          delete next[sessionId]
          return next
        })
        if (currentSessionId === sessionId) {
          const nextSession = sessions.find((s) => s.id !== sessionId)
          const nextSessionId = nextSession?.id ?? null
          setCurrentSessionId(nextSessionId)
          if (nextSessionId) {
            const nextMessages =
              messagesBySession[nextSessionId] ?? (await loadSession(nextSessionId))?.messages ?? []
            const nextToolResults = await loadToolResults(nextSessionId)
            if (nextToolResults.length > 0) {
              setToolResults(nextToolResults)
            } else {
              const derivedResults = extractToolResults(nextMessages)
              setToolResults(derivedResults)
              if (derivedResults.length > 0) {
                void saveToolResults(nextSessionId, derivedResults)
              }
            }
          } else {
            setToolResults([])
          }
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to delete session")
        logger.error("Error deleting session", err)
      }
    },
    [currentSessionId, messagesBySession, sessions]
  )

  const refreshSessions = React.useCallback(async () => {
    await hydrateFromIdb()
  }, [hydrateFromIdb])

  const sendMessage = React.useCallback(
    async (
      content: string,
      files: File[] = [],
      metadata?: {
        agentType?: string
        responseSchema?: Record<string, unknown> | null
        workflowId?: string
      }
    ) => {
      if (!content.trim()) return
      if (isLoading) return
      const hasLlmConfig = hasProviderCredentials(llmProvider, {
        openRouterModel,
        openRouterApiKey,
        openAIModel,
        openAIApiKey,
        geminiModel,
        geminiApiKey,
        claudeModel,
        claudeApiKey,
        grokModel,
        grokApiKey,
        azureOpenAIApiKey,
        azureOpenAIEndpoint,
        azureOpenAIApiVersion,
        azureOpenAIDeployment,
      })
      if (!hasLlmConfig) {
        toast.error(getProviderMissingConfigMessage(llmProvider))
        return
      }

      const trimmed = content.trim()
      const tempUserId = crypto.randomUUID()
      let uploadedPaths: string[] = []
      try {
        setIsLoading(true)
        if (files.length > 0) {
          uploadedPaths = await uploadFiles(files)
        }
      } catch (err) {
        setIsLoading(false)
        toast.error(err instanceof Error ? err.message : "File upload failed")
        return
      }

      let targetSession = currentSessionId
      if (!targetSession) {
        const newSession: ChatSession = {
          id: crypto.randomUUID(),
          title: "New Conversation",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [],
          metadata: { totalTokens: 0, messageCount: 0 },
        }
        try {
          await saveSession(newSession)
        } catch (err) {
          logger.warn("Failed to persist session to IndexedDB", err)
        }
        setSessions((prev) => {
          const next = [newSession, ...prev]
          return next.sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )
        })
        setCurrentSessionId(newSession.id)
        setMessagesBySession((prev) => ({ ...prev, [newSession.id]: [] }))
        setToolResults([])
        logger.info("Session created", { id: newSession.id })
        targetSession = newSession.id
      }

      const optimisticUser: ChatMessage = {
        id: tempUserId,
        sessionId: targetSession,
        role: "user",
        content: trimmed,
        attachments: uploadedPaths,
        timestamp: new Date().toISOString(),
        metadata:
          metadata?.workflowId || metadata?.agentType
            ? {
                agentType: metadata.agentType,
                workflowId: metadata.workflowId,
              }
            : undefined,
      }

      const existingMessages = messagesBySession[targetSession] ?? []
      const isFirstUserMessage = !existingMessages.some((m) => m.role === "user")

      updateMessages(targetSession, (prev) => [...prev, optimisticUser])
      void replaceMessage(targetSession, optimisticUser).catch((err) => {
        logger.warn("Failed to persist optimistic user message to IndexedDB", err)
      })

      if (isFirstUserMessage) {
        void (async () => {
          try {
            const res = await fetch("/api/title", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt: trimmed }),
            })
            const data = (await res.json().catch(() => null)) as { title?: string } | null
            const nextTitle = typeof data?.title === "string" ? data.title.trim() : ""
            if (!nextTitle || nextTitle === "New Conversation") return

            setSessions((prev) =>
              prev
                .map((session) =>
                  session.id === targetSession && session.title === "New Conversation"
                    ? { ...session, title: nextTitle }
                    : session
                )
                .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            )
            await updateSessionTitle(targetSession, nextTitle)
            await fetch(`/api/sessions/${targetSession}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title: nextTitle }),
            }).catch((error) => {
              logger.warn("Failed to update server session title", error)
            })
          } catch (err) {
            logger.warn("Failed to auto-title session", err)
          }
        })()
      }

      try {
        const history = trimHistory(
          (messagesBySession[targetSession] ?? [])
            .filter((m) => !(m.role === "system" && m.metadata?.errorCode !== undefined))
            .concat(optimisticUser)
        )
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: targetSession,
            message: trimmed,
            attachments: uploadedPaths,
            agentType: metadata?.agentType,
            agentMode: metadata?.agentType,
            workflowId: metadata?.workflowId,
            responseSchema: metadata?.responseSchema ?? null,
            history,
          }),
        })
        if (!response.ok || !response.body) {
          throw new Error(`Request failed (${response.status})`)
        }

        await readEventStream(response, async (event) => {
          switch (event.type) {
            case "ack": {
              updateMessages(targetSession, (prev) =>
                prev.map((msg) => (msg.id === tempUserId ? event.message : msg))
              )
              void replaceMessage(targetSession, event.message)
              break
            }
            case "status":
              setIsThinking(
                event.phase === "received" ||
                  event.phase === "thinking" ||
                  event.phase === "running_tools"
              )
              break
            case "assistant_thinking":
              setIsThinking(event.value)
              break
            case "assistant_delta":
            case "message_chunk":
              if (!liveModeEnabled) break
              updateMessages(targetSession, (prev) => {
                const existing = prev.find((msg) => msg.id === event.messageId)
                if (existing) {
                  return prev.map((msg) =>
                    msg.id === event.messageId
                      ? {
                          ...msg,
                          content: event.content,
                          metadata: {
                            ...(msg.metadata ?? {}),
                            thinking: true,
                            agentType: metadata?.agentType,
                            workflowId: metadata?.workflowId,
                          },
                        }
                      : msg
                  )
                }
                const draft: ChatMessage = {
                  id: event.messageId,
                  sessionId: targetSession,
                  role: "assistant",
                  content: event.content,
                  timestamp: new Date().toISOString(),
                  metadata: {
                    thinking: true,
                    agentType: metadata?.agentType,
                    workflowId: metadata?.workflowId,
                  },
                }
                return [...prev, draft]
              })
              void (async () => {
                const now = Date.now()
                const lastPersist = draftPersistRef.current.get(event.messageId) ?? 0
                if (now - lastPersist < 500) return
                draftPersistRef.current.set(event.messageId, now)
                await replaceMessage(targetSession, {
                  id: event.messageId,
                  sessionId: targetSession,
                  role: "assistant",
                  content: event.content,
                  timestamp: new Date().toISOString(),
                  metadata: {
                    thinking: true,
                    agentType: metadata?.agentType,
                    workflowId: metadata?.workflowId,
                  },
                })
              })().catch((err) => logger.warn("Failed to persist assistant draft message", err))
              break
            case "assistant_final":
            case "message_complete":
              {
                const incomingMessage = event.message
                if (typeof event.tempId === "string" && event.tempId.length > 0) {
                  draftPersistRef.current.delete(event.tempId)
                  void deleteMessage(targetSession, event.tempId).catch((err) => {
                    logger.warn("Failed to delete assistant draft message from IndexedDB", err)
                  })
                }
                updateMessages(targetSession, (prev) => {
                  const filtered = prev.filter((msg) => msg.id !== event.tempId)
                  return [
                    ...filtered.filter((msg) => msg.id !== incomingMessage.id),
                    incomingMessage,
                  ]
                })
                setSessions((prev) =>
                  prev
                    .map((session) =>
                      session.id === targetSession
                        ? {
                            ...session,
                            updatedAt: incomingMessage.timestamp,
                            metadata: {
                              ...(session.metadata ?? {}),
                              messageCount: (session.metadata?.messageCount ?? 0) + 1,
                              totalTokens:
                                (session.metadata?.totalTokens ?? 0) +
                                (incomingMessage.metadata?.tokens ?? 0),
                            },
                          }
                        : session
                    )
                    .sort(
                      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
                    )
                )
                await appendMessage(targetSession, incomingMessage)
                if (incomingMessage.toolCalls && incomingMessage.toolCalls.length > 0) {
                  const derivedResults = extractToolResults([incomingMessage])
                  if (derivedResults.length > 0) {
                    setToolResults((prev) => mergeToolResults(prev, derivedResults))
                    void Promise.all(
                      derivedResults.map((entry) => replaceToolResult(targetSession, entry))
                    )
                  }
                }
                void (async () => {
                  const normalizedMessage = await normalizeMessageToolCalls(incomingMessage)
                  if (normalizedMessage === incomingMessage) return
                  updateMessages(targetSession, (prev) =>
                    prev.map((msg) => (msg.id === normalizedMessage.id ? normalizedMessage : msg))
                  )
                  await replaceMessage(targetSession, normalizedMessage)
                })()
              }
              break
            case "tool_started": {
              const entry = {
                id: event.toolCall.id,
                toolName: typeof event.toolCall.name === "string" ? event.toolCall.name : "tool",
                status: "running",
                arguments:
                  (event.toolCall.arguments as Record<string, unknown>) ??
                  (event.toolCall.arguments ? { value: event.toolCall.arguments } : {}),
                result: undefined,
                timestamp:
                  typeof event.toolCall.timestamp === "string"
                    ? event.toolCall.timestamp
                    : new Date().toISOString(),
              } satisfies ToolResultEntry
              setToolResults((prev) => mergeToolResults(prev, [entry]))
              void replaceToolResult(targetSession, entry)
              break
            }
            case "tool_finished":
            case "tool_result":
              {
                const rawToolCall = event.toolCall as Record<string, unknown>
                const entry = toToolResultEntry(rawToolCall)
                setToolResults((prev) => mergeToolResults(prev, [entry]))
                void replaceToolResult(targetSession, entry)
                void (async () => {
                  const normalizedToolCall = await normalizeToolCall(rawToolCall)
                  if (normalizedToolCall === rawToolCall) return
                  const normalizedEntry = toToolResultEntry(
                    normalizedToolCall as Record<string, unknown>,
                    entry.timestamp
                  )
                  setToolResults((prev) =>
                    prev.map((item) => (item.id === normalizedEntry.id ? normalizedEntry : item))
                  )
                  void replaceToolResult(targetSession, normalizedEntry)
                  logger.debug("Tool result updated with Cloudinary URL", normalizedEntry)
                })()
                logger.debug("Tool result received", entry)
              }
              break
            case "warning":
              logger.warn("Chat runtime warning", event.warning)
              break
            case "heartbeat":
              break
            case "done":
              setIsThinking(false)
              break
            case "error": {
              const parsed = parseLLMError(event.error)
              toast.error(parsed.title, {
                description: parsed.action ?? parsed.detail,
              })
              logger.error("Chat stream error", event.error)
              const errorMsg: ChatMessage = {
                id: crypto.randomUUID(),
                sessionId: targetSession,
                role: "system" as const,
                content: parsed.detail,
                timestamp: new Date().toISOString(),
                metadata: { errorCode: parsed.code, errorAction: parsed.action },
              }
              updateMessages(targetSession, (prev) => [...prev, errorMsg])
              void appendMessage(targetSession, errorMsg).catch((err) => {
                logger.warn("Failed to persist error message to IndexedDB", err)
              })
              break
            }
          }
        })
      } catch (err) {
        const raw = err instanceof Error ? err.message : "Request failed"
        const parsed = parseLLMError(raw)
        toast.error(parsed.title, {
          description: parsed.action ?? parsed.detail,
        })
        logger.error("Send message failed", err)
        const catchErrorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          sessionId: targetSession,
          role: "system" as const,
          content: parsed.detail,
          timestamp: new Date().toISOString(),
          metadata: { errorCode: parsed.code, errorAction: parsed.action },
        }
        updateMessages(targetSession, (prev) => [...prev, catchErrorMsg])
        void appendMessage(targetSession, catchErrorMsg).catch((e) => {
          logger.warn("Failed to persist catch error message to IndexedDB", e)
        })
      } finally {
        setIsLoading(false)
        setIsThinking(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      cloudinaryApiKey,
      cloudinaryApiSecret,
      cloudinaryCloudName,
      currentSessionId,
      hydrateFromIdb,
      isLoading,
      llmProvider,
      liveModeEnabled,
      messagesBySession,
      mergeToolResults,
      normalizeMessageToolCalls,
      normalizeToolCall,
      geminiApiKey,
      geminiModel,
      claudeApiKey,
      claudeModel,
      grokApiKey,
      grokModel,
      openAIApiKey,
      openAIModel,
      openRouterApiKey,
      openRouterModel,
      azureOpenAIApiKey,
      azureOpenAIEndpoint,
      azureOpenAIApiVersion,
      azureOpenAIDeployment,
      updateMessages,
    ]
  )

  const messages = React.useMemo(
    () => (currentSessionId ? (messagesBySession[currentSessionId] ?? []) : []),
    [currentSessionId, messagesBySession]
  )

  const value = React.useMemo<ChatContextValue>(
    () => ({
      sessions,
      currentSessionId,
      messages,
      toolResults,
      isLoading,
      isThinking,
      connected,
      llmProvider,
      openRouterModel,
      openRouterApiKey,
      openAIModel,
      openAIApiKey,
      geminiModel,
      geminiApiKey,
      claudeModel,
      claudeApiKey,
      grokModel,
      grokApiKey,
      azureOpenAIApiKey,
      azureOpenAIEndpoint,
      azureOpenAIApiVersion,
      azureOpenAIDeployment,
      liveModeEnabled,
      cloudinaryCloudName,
      cloudinaryApiKey,
      cloudinaryApiSecret,
      updateLlmSettings,
      updateCloudinarySettings,
      createSession,
      joinSession,
      deleteSession,
      sendMessage,
      refreshSessions,
    }),
    [
      azureOpenAIApiKey,
      azureOpenAIApiVersion,
      azureOpenAIDeployment,
      azureOpenAIEndpoint,
      connected,
      createSession,
      currentSessionId,
      cloudinaryApiKey,
      cloudinaryApiSecret,
      cloudinaryCloudName,
      deleteSession,
      isLoading,
      isThinking,
      joinSession,
      llmProvider,
      messages,
      geminiApiKey,
      geminiModel,
      claudeApiKey,
      claudeModel,
      grokApiKey,
      grokModel,
      openAIApiKey,
      openAIModel,
      openRouterApiKey,
      openRouterModel,
      liveModeEnabled,
      refreshSessions,
      sendMessage,
      sessions,
      toolResults,
      updateCloudinarySettings,
      updateLlmSettings,
    ]
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

/**
 * Parses `ServerEventV2` frames from a fetch response body and dispatches each event to the caller.
 */
async function readEventStream(
  response: Response,
  onEvent: (data: ServerEventV2 | LegacyServerEvent) => void | Promise<void>
) {
  if (!response.body) return
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let boundary
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, boundary).trim()
      buffer = buffer.slice(boundary + 2)
      if (!raw.startsWith("data:")) continue
      try {
        const payload = JSON.parse(raw.replace(/^data:\s*/, "")) as
          | ServerEventV2
          | LegacyServerEvent
        await onEvent(payload)
      } catch (error) {
        console.error("Failed to parse SSE payload", error)
      }
    }
  }
  if (buffer.trim()) {
    try {
      const payload = JSON.parse(buffer.replace(/^data:\s*/, "")) as
        | ServerEventV2
        | LegacyServerEvent
      await onEvent(payload)
    } catch {
      // ignore trailing junk
    }
  }
}

/**
 * Provides the chat context and fails fast when used outside `ChatProvider`.
 */
export function useChat() {
  const ctx = React.useContext(ChatContext)
  if (!ctx) throw new Error("useChat must be used within ChatProvider")
  return ctx
}

/**
 * Convenience hook for consumers that only need the current session's tool timeline.
 */
export function useToolResults() {
  const ctx = useChat()
  return { toolResults: ctx.toolResults }
}

export type { ToolResultEntry }
