import { NextResponse } from "next/server"

import { getReplayStore, renderReplayHtml } from "@/lib/server/replay-store"

export const runtime = "nodejs"

export async function GET(_req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params
  const replay = getReplayStore().getReplay(sessionId)
  if (!replay) {
    return NextResponse.json({ error: "No replay events recorded" }, { status: 404 })
  }
  const html = renderReplayHtml(replay)
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
      "Content-Disposition": `attachment; filename="terminator-session-${sessionId}.html"`,
    },
  })
}
