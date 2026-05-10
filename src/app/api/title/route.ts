import { NextResponse } from "next/server"
import { z } from "zod"

import { generateLocalTitle } from "@/lib/server/title-generator"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const requestSchema = z.object({
  prompt: z.string().min(1).max(10_000),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  return NextResponse.json({ title: generateLocalTitle(parsed.data.prompt), source: "local" })
}
