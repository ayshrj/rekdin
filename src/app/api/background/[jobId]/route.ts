import { NextResponse } from "next/server"

import { getBackgroundJobStore } from "@/lib/server/background-job-store"

export const runtime = "nodejs"

export async function GET(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params
  const job = await getBackgroundJobStore().get(jobId)
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }
  return NextResponse.json({ job })
}
