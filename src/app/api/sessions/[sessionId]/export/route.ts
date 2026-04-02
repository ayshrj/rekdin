import { NextResponse } from "next/server"

import { buildSessionExportBundle } from "@/lib/server/session-export"

export const runtime = "nodejs"

export async function GET(req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params
  const bundle = await buildSessionExportBundle(sessionId)
  if (!bundle) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  const url = new URL(req.url)
  const format = url.searchParams.get("format")

  if (format === "html") {
    return new NextResponse(bundle.replayHtml ?? "<p>No replay recorded.</p>", {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${sessionId}-replay.html"`,
      },
    })
  }

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${sessionId}-bundle.json"`,
    },
  })
}
