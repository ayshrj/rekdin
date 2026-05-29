import { NextResponse } from "next/server"
import { z } from "zod"

import { appendMemory, clearMemory, readMemory } from "@/lib/server/memory-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const content = await readMemory()
  return NextResponse.json({ content, hasMemory: content.trim().length > 0 })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = z.object({ fact: z.string().min(1).max(2000) }).safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "fact must be a non-empty string (max 2000 chars)" },
      { status: 400 }
    )
  }
  await appendMemory(parsed.data.fact)
  const content = await readMemory()
  return NextResponse.json({ ok: true, content })
}

export async function DELETE() {
  await clearMemory()
  return NextResponse.json({ ok: true })
}
