import { openDB } from "idb"

import { ChatMessage, ChatSession, ToolResultEntry } from "@/types/chat"

const DB_NAME = "rekdin-idb"
const STORE_SESSIONS = "sessions"
const STORE_SETTINGS = "settings"
const STORE_TOOL_RESULTS = "tool_results"
const DB_VERSION = 2
const SETTINGS_KEY = "app_settings"

export type AppSettings = {
  currentSessionId?: string | null
  openRouterModel?: string
  openRouterApiKey?: string
  cloudinaryCloudName?: string
  cloudinaryApiKey?: string
  cloudinaryApiSecret?: string
}

const sessionWriteLocks = new Map<string, Promise<unknown>>()

async function withSessionWriteLock<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
  const previous = sessionWriteLocks.get(sessionId) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(fn)
  sessionWriteLocks.set(sessionId, next)
  try {
    return await next
  } finally {
    if (sessionWriteLocks.get(sessionId) === next) {
      sessionWriteLocks.delete(sessionId)
    }
  }
}

const MAX_STORED_STRING_CHARS = 20_000
const MAX_STORED_ARRAY_ITEMS = 200
const MAX_STORED_OBJECT_KEYS = 200
const MAX_STORED_DEPTH = 6

function truncate(value: string, max = MAX_STORED_STRING_CHARS) {
  if (value.length <= max) return value
  return `${value.slice(0, max)}\n\n...(truncated for storage, ${value.length} chars total)`
}

function sanitizeForStorage(value: unknown, depth = 0): unknown {
  if (depth > MAX_STORED_DEPTH) return "[truncated for storage: max depth]"

  if (typeof value === "string") {
    if (value.startsWith("data:image/") && value.length > 500) {
      return `[omitted image data url for storage, ${value.length} chars]`
    }
    return truncate(value)
  }
  if (typeof value === "number" || typeof value === "boolean" || value == null) return value

  if (Array.isArray(value)) {
    const limited = value
      .slice(0, MAX_STORED_ARRAY_ITEMS)
      .map((item) => sanitizeForStorage(item, depth + 1))
    if (value.length > MAX_STORED_ARRAY_ITEMS) {
      limited.push(`[truncated for storage: ${value.length - MAX_STORED_ARRAY_ITEMS} more items]`)
    }
    return limited
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj)
    const limitedKeys = keys.slice(0, MAX_STORED_OBJECT_KEYS)
    const out: Record<string, unknown> = {}
    for (const key of limitedKeys) {
      out[key] = sanitizeForStorage(obj[key], depth + 1)
    }
    if (keys.length > MAX_STORED_OBJECT_KEYS) {
      out.__truncatedKeys = keys.length - MAX_STORED_OBJECT_KEYS
    }
    return out
  }

  return truncate(String(value), 2_000)
}

function sanitizeMessage(message: ChatMessage): ChatMessage {
  if (!message.toolCalls || message.toolCalls.length === 0) return message
  return {
    ...message,
    toolCalls: message.toolCalls.map((call) => ({
      ...call,
      arguments: (sanitizeForStorage(call.arguments) as Record<string, unknown>) ?? {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result: sanitizeForStorage(call.result) as any,
      error: typeof call.error === "string" ? truncate(call.error, 2_000) : call.error,
    })),
  }
}

function sanitizeSession(session: ChatSession): ChatSession {
  const messages = (session.messages ?? []).map(sanitizeMessage)
  return { ...session, messages }
}

function sanitizeToolResults(results: ToolResultEntry[]): ToolResultEntry[] {
  return (results ?? []).map((entry) => ({
    ...entry,
    arguments: (sanitizeForStorage(entry.arguments) as Record<string, unknown>) ?? {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result: sanitizeForStorage(entry.result) as any,
  }))
}

async function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS)
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS)
      }
      if (!db.objectStoreNames.contains(STORE_TOOL_RESULTS)) {
        db.createObjectStore(STORE_TOOL_RESULTS)
      }
    },
  })
}

export async function loadSettings(): Promise<AppSettings> {
  const db = await getDb()
  const settings = await db.get(STORE_SETTINGS, SETTINGS_KEY)
  return (settings as AppSettings) ?? {}
}

export async function saveSettings(next: Partial<AppSettings>): Promise<AppSettings> {
  const db = await getDb()
  const current = ((await db.get(STORE_SETTINGS, SETTINGS_KEY)) as AppSettings) ?? {}
  const merged = { ...current, ...next }
  await db.put(STORE_SETTINGS, merged, SETTINGS_KEY)
  return merged
}

export async function saveSession(session: ChatSession) {
  const db = await getDb()
  await db.put(STORE_SESSIONS, sanitizeSession(session), session.id)
}

export async function deleteSession(sessionId: string) {
  const db = await getDb()
  await db.delete(STORE_SESSIONS, sessionId)
}

export async function loadSessions(): Promise<ChatSession[]> {
  const db = await getDb()
  const all: ChatSession[] = []
  let cursor = await db.transaction(STORE_SESSIONS).store.openCursor()
  while (cursor) {
    all.push(cursor.value as ChatSession)
    cursor = await cursor.continue()
  }
  return all
}

export async function loadSession(sessionId: string): Promise<ChatSession | null> {
  const db = await getDb()
  const session = await db.get(STORE_SESSIONS, sessionId)
  return (session as ChatSession) ?? null
}

export async function loadToolResults(sessionId: string): Promise<ToolResultEntry[]> {
  const db = await getDb()
  const results = await db.get(STORE_TOOL_RESULTS, sessionId)
  return (results as ToolResultEntry[]) ?? []
}

export async function saveToolResults(sessionId: string, results: ToolResultEntry[]) {
  return withSessionWriteLock(sessionId, async () => {
    const db = await getDb()
    await db.put(STORE_TOOL_RESULTS, sanitizeToolResults(results), sessionId)
  })
}

export async function appendToolResult(sessionId: string, entry: ToolResultEntry) {
  return withSessionWriteLock(sessionId, async () => {
    const db = await getDb()
    const existing = ((await db.get(STORE_TOOL_RESULTS, sessionId)) as ToolResultEntry[]) ?? []
    const next = [...existing, entry]
    await db.put(STORE_TOOL_RESULTS, sanitizeToolResults(next), sessionId)
    return next
  })
}

export async function replaceToolResult(sessionId: string, entry: ToolResultEntry) {
  return withSessionWriteLock(sessionId, async () => {
    const db = await getDb()
    const existing = ((await db.get(STORE_TOOL_RESULTS, sessionId)) as ToolResultEntry[]) ?? []
    const index = existing.findIndex((item) => item.id === entry.id)
    const next =
      index >= 0
        ? existing.map((item) => (item.id === entry.id ? entry : item))
        : [...existing, entry]
    await db.put(STORE_TOOL_RESULTS, sanitizeToolResults(next), sessionId)
    return next
  })
}

export async function deleteToolResults(sessionId: string) {
  const db = await getDb()
  await db.delete(STORE_TOOL_RESULTS, sessionId)
}

export async function appendMessage(sessionId: string, message: ChatMessage) {
  return withSessionWriteLock(sessionId, async () => {
    const session = ((await (await getDb()).get(STORE_SESSIONS, sessionId)) as ChatSession) ?? null
    if (!session) {
      // upsert a shell session if somehow missing
      const shell: ChatSession = {
        id: sessionId,
        title: "New Conversation",
        createdAt: new Date().toISOString(),
        updatedAt: message.timestamp ?? new Date().toISOString(),
        messages: [message],
        metadata: { messageCount: 1, totalTokens: message.metadata?.tokens ?? 0 },
      }
      await saveSession(shell)
      return
    }
    const next: ChatSession = {
      ...session,
      messages: [...(session.messages ?? []), message],
      updatedAt: message.timestamp ?? new Date().toISOString(),
      metadata: {
        ...(session.metadata ?? {}),
        messageCount: (session.metadata?.messageCount ?? 0) + 1,
        totalTokens: (session.metadata?.totalTokens ?? 0) + (message.metadata?.tokens ?? 0),
      },
    }
    await saveSession(next)
  })
}

export async function replaceMessage(sessionId: string, message: ChatMessage) {
  return withSessionWriteLock(sessionId, async () => {
    const session = ((await (await getDb()).get(STORE_SESSIONS, sessionId)) as ChatSession) ?? null
    if (!session) {
      const timestamp = message.timestamp ?? new Date().toISOString()
      const shell: ChatSession = {
        id: sessionId,
        title: "New Conversation",
        createdAt: new Date().toISOString(),
        updatedAt: timestamp,
        messages: [message],
        metadata: { messageCount: 1, totalTokens: message.metadata?.tokens ?? 0 },
      }
      await saveSession(shell)
      return
    }
    const existing = session.messages ?? []
    const found = existing.some((m) => m.id === message.id)
    const nextMessages = found
      ? existing.map((m) => (m.id === message.id ? message : m))
      : [...existing, message]
    const next: ChatSession = {
      ...session,
      messages: nextMessages,
      updatedAt: message.timestamp ?? new Date().toISOString(),
      metadata: {
        ...(session.metadata ?? {}),
        messageCount: (session.metadata?.messageCount ?? 0) + (found ? 0 : 1),
        totalTokens:
          (session.metadata?.totalTokens ?? 0) + (found ? 0 : (message.metadata?.tokens ?? 0)),
      },
    }
    await saveSession(next)
  })
}

export async function deleteMessage(sessionId: string, messageId: string) {
  return withSessionWriteLock(sessionId, async () => {
    const db = await getDb()
    const session = (await db.get(STORE_SESSIONS, sessionId)) as ChatSession | undefined
    if (!session) return
    const existing = session.messages ?? []
    const removed = existing.find((message) => message.id === messageId)
    if (!removed) return

    const nextMessages = existing.filter((message) => message.id !== messageId)
    const nextUpdatedAt =
      nextMessages[nextMessages.length - 1]?.timestamp ??
      session.updatedAt ??
      new Date().toISOString()
    const removedTokens = removed.metadata?.tokens ?? 0

    const next: ChatSession = {
      ...session,
      messages: nextMessages,
      updatedAt: nextUpdatedAt,
      metadata: {
        ...(session.metadata ?? {}),
        messageCount: Math.max(0, (session.metadata?.messageCount ?? 0) - 1),
        totalTokens: Math.max(0, (session.metadata?.totalTokens ?? 0) - removedTokens),
      },
    }
    await db.put(STORE_SESSIONS, next, sessionId)
  })
}

export async function updateSessionTitle(sessionId: string, title: string) {
  const nextTitle = title.trim()
  if (!nextTitle) return
  return withSessionWriteLock(sessionId, async () => {
    const db = await getDb()
    const session = (await db.get(STORE_SESSIONS, sessionId)) as ChatSession | undefined
    if (!session) return
    if (session.title && session.title !== "New Conversation") return
    const next: ChatSession = { ...session, title: nextTitle }
    await db.put(STORE_SESSIONS, next, sessionId)
  })
}
