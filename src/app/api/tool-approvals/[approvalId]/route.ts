import { NextResponse } from "next/server"
import { z } from "zod"

import { resolveToolApproval } from "@/lib/server/runtime/tool-approval-broker"

export const runtime = "nodejs"

const decisionSchema = z.object({
  approved: z.boolean(),
})

export async function POST(req: Request, ctx: { params: Promise<{ approvalId: string }> }) {
  const { approvalId } = await ctx.params
  const body = await req.json().catch(() => null)
  const parsed = decisionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid approval decision" }, { status: 400 })
  }
  const found = resolveToolApproval(approvalId, parsed.data.approved)
  if (!found) {
    return NextResponse.json(
      { error: "Approval request expired or was not found" },
      { status: 404 }
    )
  }
  return NextResponse.json({ ok: true })
}
