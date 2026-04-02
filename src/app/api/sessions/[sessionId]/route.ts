import { NextResponse } from "next/server"
import { z } from "zod"

import { getReplayStore } from "@/lib/server/replay-store"
import { getSessionStore } from "@/lib/server/session-store"

export const runtime = "nodejs"

const patchSchema = z.object({
  title: z.string().min(1).max(160),
})

export async function PATCH(req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const session = await getSessionStore().updateTitle(sessionId, parsed.data.title)
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }
  return NextResponse.json({ session })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params
  const deleted = await getSessionStore().deleteSession(sessionId)
  await getReplayStore().deleteReplay(sessionId)
  if (!deleted) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
