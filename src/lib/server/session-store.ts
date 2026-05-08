import crypto from "crypto"

import { ChatMessage, ChatSession } from "@/types/chat"

import { readJsonFile, withFileWriteLock, writeJsonFileAtomic } from "./json-store"
import { ensureWorkspaceDirs, getSessionsFilePath } from "./workspace"

/**
 * Returns a shallow-safe copy so callers cannot mutate the in-memory session cache directly.
 */
function cloneSession(session: ChatSession): ChatSession {
  return {
    ...session,
    messages: [...(session.messages ?? [])],
    metadata: session.metadata ? { ...session.metadata } : undefined,
  }
}

function sortSessions(sessions: ChatSession[]) {
  return [...sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

/**
 * Recomputes derived session metadata from messages before persisting server-side session state.
 */
function recomputeMetadata(session: ChatSession): ChatSession {
  const messages = session.messages ?? []
  return {
    ...session,
    metadata: {
      ...(session.metadata ?? {}),
      messageCount: messages.length,
      totalTokens: messages.reduce((total, message) => total + (message.metadata?.tokens ?? 0), 0),
      model:
        [...messages].reverse().find((message) => typeof message.metadata?.model === "string")
          ?.metadata?.model ?? session.metadata?.model,
    },
  }
}

class SessionStore {
  private cache: ChatSession[] | null = null

  private async loadSessionsFromDisk() {
    if (this.cache) return this.cache
    await ensureWorkspaceDirs()
    const stored = await readJsonFile<ChatSession[]>(getSessionsFilePath(), [])
    this.cache = sortSessions(stored.map(cloneSession))
    return this.cache
  }

  private async saveSessions(next: ChatSession[]) {
    const filePath = getSessionsFilePath()
    return withFileWriteLock(filePath, async () => {
      const normalized = sortSessions(
        next.map((session) => recomputeMetadata(cloneSession(session)))
      )
      await writeJsonFileAtomic(filePath, normalized)
      this.cache = normalized
      return normalized
    })
  }

  async listSessions(): Promise<ChatSession[]> {
    const sessions = await this.loadSessionsFromDisk()
    return sessions.map(cloneSession)
  }

  async createSession(title = "New Conversation", id = crypto.randomUUID()): Promise<ChatSession> {
    const session: ChatSession = {
      id,
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      metadata: {
        totalTokens: 0,
        messageCount: 0,
      },
    }
    const sessions = await this.loadSessionsFromDisk()
    const next = [...sessions.filter((item) => item.id !== session.id), session]
    await this.saveSessions(next)
    return cloneSession(session)
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    const sessions = await this.loadSessionsFromDisk()
    const session = sessions.find((item) => item.id === sessionId)
    return session ? cloneSession(session) : null
  }

  async upsertSession(session: ChatSession): Promise<ChatSession> {
    const sessions = await this.loadSessionsFromDisk()
    const normalized = recomputeMetadata(cloneSession(session))
    const next = [...sessions.filter((item) => item.id !== session.id), normalized]
    await this.saveSessions(next)
    return cloneSession(normalized)
  }

  /**
   * Upserts a message into a session, creating the session if the first request arrives before an
   * explicit session record exists.
   */
  async saveMessage(sessionId: string, message: ChatMessage, title = "New Conversation") {
    const sessions = await this.loadSessionsFromDisk()
    const existing = sessions.find((item) => item.id === sessionId)
    const session =
      existing ??
      ({
        id: sessionId,
        title,
        createdAt: message.timestamp,
        updatedAt: message.timestamp,
        messages: [],
        metadata: {
          totalTokens: 0,
          messageCount: 0,
        },
      } satisfies ChatSession)

    const filtered = (session.messages ?? []).filter((item) => item.id !== message.id)
    const nextSession: ChatSession = recomputeMetadata({
      ...session,
      updatedAt: message.timestamp,
      messages: [...filtered, message].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ),
    })

    const next = [...sessions.filter((item) => item.id !== sessionId), nextSession]
    await this.saveSessions(next)
    return cloneSession(nextSession)
  }

  async updateTitle(sessionId: string, title: string) {
    const sessions = await this.loadSessionsFromDisk()
    const session = sessions.find((item) => item.id === sessionId)
    if (!session) return null
    const nextSession: ChatSession = {
      ...session,
      title: title.trim() || session.title,
      updatedAt: new Date().toISOString(),
    }
    const next = [...sessions.filter((item) => item.id !== sessionId), nextSession]
    await this.saveSessions(next)
    return cloneSession(nextSession)
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const sessions = await this.loadSessionsFromDisk()
    const next = sessions.filter((item) => item.id !== sessionId)
    if (next.length === sessions.length) return false
    await this.saveSessions(next)
    return true
  }
}

declare global {
  var __SESSION_STORE: SessionStore | undefined
}

/**
 * Returns the singleton JSON-backed session store used by API routes during local development.
 */
export function getSessionStore() {
  if (!globalThis.__SESSION_STORE) {
    globalThis.__SESSION_STORE = new SessionStore()
  }
  return globalThis.__SESSION_STORE
}
