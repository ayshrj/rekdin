"use client"

import * as React from "react"
import { toast } from "sonner"

import { ChatMessage, ChatSession } from "@/types/chat"
import {
  loadSessions,
  loadSession,
  saveSession,
  deleteSession as deleteSessionFromDb,
  appendMessage,
  replaceMessage,
} from "@/lib/client/idb"
import { logger } from "@/lib/logger"

type ToolResultEntry = {
  id: string
  toolName: string
  status: string
  arguments: Record<string, unknown>
  result?: Record<string, unknown> | string
  timestamp: string
}

type ChatContextValue = {
  sessions: ChatSession[]
  currentSessionId: string | null
  messages: ChatMessage[]
  toolResults: ToolResultEntry[]
  isLoading: boolean
  isThinking: boolean
  connected: boolean
  createSession: () => Promise<void>
  joinSession: (sessionId: string) => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
  sendMessage: (content: string, attachments?: File[], metadata?: { agentType?: string }) => Promise<void>
  refreshSessions: () => Promise<void>
}

type ServerEvent =
  | { type: "ack"; message: ChatMessage }
  | { type: "assistant_thinking"; value: boolean }
  | { type: "message_chunk"; messageId: string; content: string }
  | { type: "message_complete"; message: ChatMessage; tempId?: string }
  | { type: "tool_result"; toolCall: Record<string, unknown> }
  | { type: "error"; error: string }

const ChatContext = React.createContext<ChatContextValue | undefined>(undefined)

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

async function uploadFiles(files: File[]) {
  if (!files || files.length === 0) return []
  const formData = new FormData()
  files.forEach((file) => formData.append("files", file))
  const res = await fetch("/api/upload", { method: "POST", body: formData })
  if (!res.ok) throw new Error("File upload failed")
  const data = (await res.json()) as { files: string[] }
  return data.files
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = React.useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = React.useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem("terminator_session")
  )
  const [messagesBySession, setMessagesBySession] = React.useState<Record<string, ChatMessage[]>>({})
  const [toolResults, setToolResults] = React.useState<ToolResultEntry[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [isThinking, setIsThinking] = React.useState(false)
  const [connected, setConnected] = React.useState(true)
  const bootstrappedRef = React.useRef(false)

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

  const hydrateFromIdb = React.useCallback(async () => {
    try {
      logger.debug("Hydrating sessions from IndexedDB")
      const stored = await loadSessions()
      if (stored.length === 0) {
        logger.info("No sessions in IndexedDB, creating starter session")
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
          logger.warn("Failed to seed session into IndexedDB", err)
        }
        setSessions([newSession])
        setMessagesBySession({ [newSession.id]: [] })
        setCurrentSessionId(newSession.id)
        setConnected(true)
        return [newSession]
      }
      const sorted = [...stored].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
      const messagesById: Record<string, ChatMessage[]> = {}
      sorted.forEach((session) => {
        messagesById[session.id] = session.messages ?? []
      })
      logger.info("Loaded sessions from IndexedDB", sorted.map((s) => s.id))
      setSessions(sorted)
      setMessagesBySession(messagesById)
      setCurrentSessionId((prev) => prev ?? sorted[0]?.id ?? null)
      setConnected(true)
      return sorted
    } catch (err) {
      setConnected(false)
      toast.error(err instanceof Error ? err.message : "Unable to load saved sessions")
      logger.error("Failed to hydrate from IndexedDB", err)
      return null
    }
  }, [])

  const createSession = React.useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true)
      logger.info("Creating a new session")
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
      logger.info("Session created", { id: newSession.id })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to create session")
      logger.error("Error creating session", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (bootstrappedRef.current) return
    bootstrappedRef.current = true
    void hydrateFromIdb().then((loaded) => {
      if ((loaded?.length ?? 0) === 0) {
        void createSession()
      }
    })
  }, [createSession, hydrateFromIdb])

  React.useEffect(() => {
    if (!sessions.length && !isLoading && connected) {
      void createSession()
    }
  }, [connected, createSession, isLoading, sessions.length])

  React.useEffect(() => {
    if (currentSessionId) {
      localStorage.setItem("terminator_session", currentSessionId)
    }
  }, [currentSessionId])

  const joinSession = React.useCallback(
    async (sessionId: string) => {
      setCurrentSessionId(sessionId)
      if (!messagesBySession[sessionId]) {
        const stored = await loadSession(sessionId)
        if (stored) {
          setMessagesBySession((prev) => ({ ...prev, [sessionId]: stored.messages ?? [] }))
          logger.info("Joined session", sessionId)
        }
      }
    },
    [messagesBySession]
  )

  const deleteSession = React.useCallback(
    async (sessionId: string) => {
      try {
        await deleteSessionFromDb(sessionId)
        setSessions((prev) => prev.filter((s) => s.id !== sessionId))
        setMessagesBySession((prev) => {
          const next = { ...prev }
          delete next[sessionId]
          return next
        })
        if (currentSessionId === sessionId) {
          const nextSession = sessions.find((s) => s.id !== sessionId)
          setCurrentSessionId(nextSession?.id ?? null)
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to delete session")
        logger.error("Error deleting session", err)
      }
    },
    [currentSessionId, sessions]
  )

  const refreshSessions = React.useCallback(async () => {
    await hydrateFromIdb()
  }, [hydrateFromIdb])

  const sendMessage = React.useCallback(
    async (content: string, files: File[] = [], metadata?: { agentType?: string }) => {
      if (!currentSessionId || !content.trim()) return
      if (isLoading) return
      const targetSession = currentSessionId
      setIsLoading(true)
      const trimmed = content.trim()
      const tempUserId = crypto.randomUUID()
      let uploadedPaths: string[] = []
      try {
        if (files.length > 0) {
          uploadedPaths = await uploadFiles(files)
        }
      } catch (err) {
        setIsLoading(false)
        toast.error(err instanceof Error ? err.message : "File upload failed")
        return
      }

      const optimisticUser: ChatMessage = {
        id: tempUserId,
        sessionId: currentSessionId,
        role: "user",
        content: trimmed,
        attachments: uploadedPaths,
        timestamp: new Date().toISOString(),
      }
      updateMessages(targetSession, (prev) => [...prev, optimisticUser])

      try {
        const history = trimHistory((messagesBySession[targetSession] ?? []).concat(optimisticUser))
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: targetSession,
            message: trimmed,
            attachments: uploadedPaths,
            agentType: metadata?.agentType,
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
            case "assistant_thinking":
              setIsThinking(event.value)
              break
            case "message_chunk":
              updateMessages(targetSession, (prev) => {
                const existing = prev.find((msg) => msg.id === event.messageId)
                if (existing) {
                  return prev.map((msg) =>
                    msg.id === event.messageId ? { ...msg, content: event.content } : msg
                  )
                }
                const draft: ChatMessage = {
                  id: event.messageId,
                  sessionId: targetSession,
                  role: "assistant",
                  content: event.content,
                  timestamp: new Date().toISOString(),
                  metadata: { thinking: true },
                }
                return [...prev, draft]
              })
              break
            case "message_complete":
              updateMessages(targetSession, (prev) => {
                const filtered = prev.filter((msg) => msg.id !== event.tempId)
                return [...filtered.filter((msg) => msg.id !== event.message.id), event.message]
              })
              setSessions((prev) =>
                prev
                  .map((session) =>
                    session.id === targetSession
                      ? {
                          ...session,
                          updatedAt: event.message.timestamp,
                          metadata: {
                            ...(session.metadata ?? {}),
                            messageCount: (session.metadata?.messageCount ?? 0) + 1,
                            totalTokens:
                              (session.metadata?.totalTokens ?? 0) + (event.message.metadata?.tokens ?? 0),
                          },
                        }
                      : session
                  )
                  .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
              )
              await appendMessage(targetSession, event.message)
              break
            case "tool_result":
              setToolResults((prev) => {
                const id =
                  typeof event.toolCall.id === "string" ? event.toolCall.id : crypto.randomUUID()
                const toolName =
                  typeof event.toolCall.name === "string"
                    ? event.toolCall.name
                    : typeof (event.toolCall as Record<string, unknown>).toolName === "string"
                      ? String((event.toolCall as Record<string, unknown>).toolName)
                      : "tool"
                const status =
                  typeof event.toolCall.status === "string" ? event.toolCall.status : "success"
                const args =
                  (event.toolCall.arguments as Record<string, unknown>) ??
                  (("toolInput" in event.toolCall &&
                    (event.toolCall as Record<string, unknown>).toolInput) as Record<
                    string,
                    unknown
                  >) ??
                  {}
                const result =
                  (event.toolCall.result as Record<string, unknown>) ??
                  (("toolResult" in event.toolCall &&
                    (event.toolCall as Record<string, unknown>).toolResult) as Record<
                    string,
                    unknown
                  >) ??
                  {}
                const timestamp =
                  typeof event.toolCall.timestamp === "string"
                    ? event.toolCall.timestamp
                    : new Date().toISOString()
                return [
                  ...prev,
                  {
                    id,
                    toolName,
                    status,
                    arguments: args,
                    result,
                    timestamp,
                  },
                ]
              })
              logger.debug("Tool result received", event.toolCall)
              break
            case "error":
              toast.error(event.error)
              logger.error("Chat stream error", event.error)
              break
          }
        })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to send message")
        logger.error("Send message failed", err)
        updateMessages(targetSession, (prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            sessionId: targetSession,
            role: "system",
            content: err instanceof Error ? err.message : "Request failed",
            timestamp: new Date().toISOString(),
          },
        ])
      } finally {
        setIsLoading(false)
        setIsThinking(false)
      }
    },
    [currentSessionId, hydrateFromIdb, isLoading, messagesBySession, updateMessages]
  )

  const messages = React.useMemo(
    () => (currentSessionId ? messagesBySession[currentSessionId] ?? [] : []),
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
      createSession,
      joinSession,
      deleteSession,
      sendMessage,
      refreshSessions,
    }),
    [
      connected,
      createSession,
      currentSessionId,
      deleteSession,
      isLoading,
      isThinking,
      joinSession,
      messages,
      refreshSessions,
      sendMessage,
      sessions,
      toolResults,
    ]
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

async function readEventStream(response: Response, onEvent: (data: ServerEvent) => void | Promise<void>) {
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
        const payload = JSON.parse(raw.replace(/^data:\s*/, "")) as ServerEvent
        await onEvent(payload)
      } catch (error) {
        console.error("Failed to parse SSE payload", error)
      }
    }
  }
  if (buffer.trim()) {
    try {
      const payload = JSON.parse(buffer.replace(/^data:\s*/, "")) as ServerEvent
      await onEvent(payload)
    } catch {
      // ignore trailing junk
    }
  }
}

export function useChat() {
  const ctx = React.useContext(ChatContext)
  if (!ctx) throw new Error("useChat must be used within ChatProvider")
  return ctx
}

export function useToolResults() {
  const ctx = useChat()
  return { toolResults: ctx.toolResults }
}

export type { ToolResultEntry }
