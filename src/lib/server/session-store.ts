import crypto from "crypto"

import { ChatMessage, ChatSession } from "@/types/chat"

type NewMessage = Omit<ChatMessage, "id" | "timestamp" | "sessionId">

class SessionStore {
  private sessions = new Map<string, ChatSession>()

  async listSessions(): Promise<ChatSession[]> {
    return Array.from(this.sessions.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  }

  async createSession(title = "New Conversation"): Promise<ChatSession> {
    const session: ChatSession = {
      id: crypto.randomUUID(),
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      metadata: {
        totalTokens: 0,
        messageCount: 0,
      },
    }
    this.sessions.set(session.id, session)
    return { ...session }
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    const session = this.sessions.get(sessionId)
    return session ? { ...session, messages: [...session.messages] } : null
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return this.sessions.delete(sessionId)
  }

  async addMessage(sessionId: string, message: NewMessage): Promise<ChatMessage> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error("Session not found")
    const newMessage: ChatMessage = {
      ...message,
      id: crypto.randomUUID(),
      sessionId,
      timestamp: new Date().toISOString(),
    }
    session.messages.push(newMessage)
    session.updatedAt = newMessage.timestamp
    const meta = session.metadata ?? {}
    session.metadata = {
      ...meta,
      messageCount: (meta.messageCount ?? 0) + 1,
      totalTokens: (meta.totalTokens ?? 0) + (newMessage.metadata?.tokens ?? 0),
    }
    return { ...newMessage }
  }

  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    const session = this.sessions.get(sessionId)
    if (!session) return []
    return session.messages.map((msg) => ({ ...msg }))
  }
}

declare global {
  var __SESSION_STORE: SessionStore | undefined
}

export function getSessionStore() {
  if (!globalThis.__SESSION_STORE) {
    globalThis.__SESSION_STORE = new SessionStore()
  }
  return globalThis.__SESSION_STORE
}
