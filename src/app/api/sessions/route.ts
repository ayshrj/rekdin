import { NextResponse } from "next/server"
import { z } from "zod"

import { getSessionStore } from "@/lib/server/session-store"

export const runtime = "nodejs"

const createSchema = z.object({
  title: z.string().min(1).max(160).optional(),
})

export async function GET() {
  const store = getSessionStore()
  const sessions = await store.listSessions()
  return NextResponse.json({ sessions })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body ?? {})
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const store = getSessionStore()
  const session = await store.createSession(parsed.data.title)
  return NextResponse.json({ session })
}
