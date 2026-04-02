import { NextResponse } from "next/server"

import { getTraceStore } from "@/lib/server/trace-store"

export const runtime = "nodejs"

export async function GET(_req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params
  const traces = await getTraceStore().list(sessionId)
  return NextResponse.json({ traces })
}
