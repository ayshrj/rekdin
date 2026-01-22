import { readFile } from "fs/promises"
import { NextResponse } from "next/server"
import path from "path"

import { ensureWorkspaceDirs, getPdfsDir } from "@/lib/server/workspace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isAllowedProxyUrl(raw: string) {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return false
  }
  if (parsed.protocol !== "https:") return false
  // Avoid SSRF: allow only Cloudinary delivery host.
  if (!parsed.hostname.endsWith("res.cloudinary.com")) return false
  return true
}

export async function GET(req: Request, ctx: { params: Promise<{ filename: string }> }) {
  const { filename } = await ctx.params
  const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "")
  if (!safeName.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Only .pdf files are supported" }, { status: 400 })
  }

  await ensureWorkspaceDirs()
  const pdfPath = path.join(getPdfsDir(), safeName)
  try {
    const buf = await readFile(pdfPath)
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
      },
    })
  } catch {
    const urlParam = new URL(req.url).searchParams.get("url") ?? ""
    if (!urlParam) {
      return NextResponse.json({ error: "PDF not found" }, { status: 404 })
    }
    if (!isAllowedProxyUrl(urlParam)) {
      return NextResponse.json({ error: "Invalid or disallowed proxy URL" }, { status: 400 })
    }

    const upstream = await fetch(urlParam, { cache: "no-store", redirect: "follow" })
    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "")
      return NextResponse.json(
        { error: `Upstream fetch failed (${upstream.status})`, details: detail.slice(0, 500) },
        { status: 502 }
      )
    }

    const contentType = upstream.headers.get("content-type") ?? ""
    const looksLikePdf =
      contentType.toLowerCase().includes("application/pdf") ||
      contentType.toLowerCase().includes("application/octet-stream")
    if (!looksLikePdf) {
      return NextResponse.json(
        { error: "Upstream did not return a PDF", contentType: contentType || null },
        { status: 415 }
      )
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${safeName}"`,
    }
    const contentLength = upstream.headers.get("content-length")
    if (contentLength) headers["Content-Length"] = contentLength

    return new NextResponse(upstream.body, { headers })
  }
}
