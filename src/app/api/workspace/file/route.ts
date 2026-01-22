import { readFile, stat } from "fs/promises"
import { NextResponse } from "next/server"
import path from "path"

import { ensureWorkspaceDirs, resolveWorkspacePath } from "@/lib/server/workspace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function contentTypeFor(filename: string) {
  const ext = path.extname(filename).toLowerCase()
  switch (ext) {
    case ".tex":
      return "application/x-tex; charset=utf-8"
    case ".pdf":
      return "application/pdf"
    case ".json":
      return "application/json; charset=utf-8"
    case ".txt":
    case ".md":
    case ".log":
      return "text/plain; charset=utf-8"
    case ".csv":
      return "text/csv; charset=utf-8"
    case ".zip":
      return "application/zip"
    case ".png":
      return "image/png"
    case ".jpg":
    case ".jpeg":
      return "image/jpeg"
    case ".webp":
      return "image/webp"
    case ".svg":
      return "image/svg+xml; charset=utf-8"
    default:
      return "application/octet-stream"
  }
}

function sanitizeDownloadName(filePath: string) {
  const base = path.basename(filePath)
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, "_")
  return safe.length > 0 ? safe : "download"
}

export async function GET(req: Request) {
  await ensureWorkspaceDirs()

  const url = new URL(req.url)
  const requested = (url.searchParams.get("path") ?? "").trim()
  if (!requested) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 })
  }

  let resolved: string
  try {
    resolved = resolveWorkspacePath(requested)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid path" },
      { status: 400 }
    )
  }

  let size: number
  try {
    const info = await stat(resolved)
    size = info.size
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }

  if (size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 })
  }

  const buf = await readFile(resolved)
  const downloadName = sanitizeDownloadName(requested)

  return new NextResponse(buf, {
    headers: {
      "Content-Type": contentTypeFor(downloadName),
      "Content-Disposition": `attachment; filename="${downloadName}"`,
      "Cache-Control": "no-store",
      "Content-Length": String(buf.length),
    },
  })
}
