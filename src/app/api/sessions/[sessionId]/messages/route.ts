import { NextResponse } from "next/server"
import { z } from "zod"

import { getSessionStore } from "@/lib/server/session-store"

export const runtime = "nodejs"

const messageSchema = z.object({
  id: z.string(),
  sessionId: z.string().optional(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  attachments: z.array(z.string()).optional(),
  toolCalls: z.array(z.any()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  timestamp: z.string(),
})

const putSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  messages: z.array(messageSchema).max(500),
})

export async function GET(_req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params
  const store = getSessionStore()
  const session = await store.getSession(sessionId)
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }
  return NextResponse.json({ messages: session.messages })
}

export async function PUT(req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params
  const body = await req.json().catch(() => null)
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const store = getSessionStore()
  const existing = await store.getSession(sessionId)
  const now = new Date().toISOString()
  const messages = parsed.data.messages.map((message) => ({
    ...message,
    sessionId,
  }))
  const session = await store.upsertSession({
    id: sessionId,
    title: parsed.data.title ?? existing?.title ?? "New Conversation",
    createdAt: existing?.createdAt ?? messages[0]?.timestamp ?? now,
    updatedAt: messages[messages.length - 1]?.timestamp ?? now,
    messages,
    metadata: existing?.metadata,
  })
  return NextResponse.json({ session })
}
