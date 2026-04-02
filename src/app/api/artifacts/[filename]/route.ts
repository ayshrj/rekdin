import { readFile } from "fs/promises"
import { NextResponse } from "next/server"
import path from "path"

import { ensureWorkspaceDirs, getArtifactsDir } from "@/lib/server/workspace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function contentTypeFor(fileName: string) {
  const lower = fileName.toLowerCase()
  if (lower.endsWith(".png")) return "image/png"
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg"
  if (lower.endsWith(".webp")) return "image/webp"
  if (lower.endsWith(".gif")) return "image/gif"
  if (lower.endsWith(".pdf")) return "application/pdf"
  if (lower.endsWith(".zip")) return "application/zip"
  if (lower.endsWith(".json")) return "application/json; charset=utf-8"
  if (lower.endsWith(".txt") || lower.endsWith(".md")) return "text/plain; charset=utf-8"
  return "application/octet-stream"
}

export async function GET(_req: Request, ctx: { params: Promise<{ filename: string }> }) {
  const { filename } = await ctx.params
  const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "")
  if (!safeName) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 })
  }

  await ensureWorkspaceDirs()
  const filePath = path.join(getArtifactsDir(), safeName)

  try {
    const body = await readFile(filePath)
    return new NextResponse(body, {
      headers: {
        "Content-Type": contentTypeFor(safeName),
        "Cache-Control": "no-store",
      },
    })
  } catch {
    return NextResponse.json({ error: "Artifact not found" }, { status: 404 })
  }
}
