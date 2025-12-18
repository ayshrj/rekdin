import { NextResponse } from "next/server"

import { getReplayStore } from "@/lib/server/replay-store"

export const runtime = "nodejs"

export async function GET(_req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params
  const replay = getReplayStore().getReplay(sessionId)
  if (!replay) {
    return NextResponse.json({ error: "No replay events recorded" }, { status: 404 })
  }
  return NextResponse.json(replay)
}
