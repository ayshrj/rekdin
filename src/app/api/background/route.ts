import { NextResponse } from "next/server"
import { z } from "zod"

import { enqueueBackgroundJob } from "@/lib/server/background-job-runner"
import { getBackgroundJobStore } from "@/lib/server/background-job-store"

export const runtime = "nodejs"

const createSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1).max(10_000),
  attachments: z.array(z.string()).optional(),
  agentMode: z.string().optional(),
  toolPolicy: z.string().optional(),
  workflowId: z.string().optional(),
  responseSchema: z.record(z.string(), z.unknown()).nullable().optional(),
})

export async function GET(req: Request) {
  const url = new URL(req.url)
  const sessionId = url.searchParams.get("sessionId")
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
  }
  const jobs = await getBackgroundJobStore().listBySession(sessionId)
  return NextResponse.json({ jobs })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const job = await enqueueBackgroundJob({
    sessionId: parsed.data.sessionId,
    message: parsed.data.message,
    attachments: parsed.data.attachments ?? [],
    requestedMode: parsed.data.agentMode,
    requestedToolPolicy: parsed.data.toolPolicy,
    workflowId: parsed.data.workflowId ?? null,
    responseSchema: parsed.data.responseSchema ?? null,
  })

  return NextResponse.json({ job }, { status: 202 })
}
