import { NextResponse } from "next/server"

import { getSessionStore } from "@/lib/server/session-store"

export const runtime = "nodejs"

export async function GET(_req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params
  const store = getSessionStore()
  const session = await store.getSession(sessionId)
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }
  return NextResponse.json({ session })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params
  const store = getSessionStore()
  const deleted = await store.deleteSession(sessionId)
  if (!deleted) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
