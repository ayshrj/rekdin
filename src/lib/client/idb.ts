import { openDB } from "idb"

import { ChatMessage, ChatSession } from "@/types/chat"

const DB_NAME = "terminator-idb"
const STORE_SESSIONS = "sessions"
const DB_VERSION = 1

async function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS)
      }
    },
  })
}

export async function saveSession(session: ChatSession) {
  const db = await getDb()
  await db.put(STORE_SESSIONS, session, session.id)
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

export async function appendMessage(sessionId: string, message: ChatMessage) {
  const session = (await loadSession(sessionId)) ?? null
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
}

export async function replaceMessage(sessionId: string, message: ChatMessage) {
  const session = (await loadSession(sessionId)) ?? null
  if (!session) {
    await appendMessage(sessionId, message)
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
      totalTokens: (session.metadata?.totalTokens ?? 0) + (message.metadata?.tokens ?? 0),
    },
  }
  await saveSession(next)
}
