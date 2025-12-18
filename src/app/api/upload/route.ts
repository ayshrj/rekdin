import { NextResponse } from "next/server"
import path from "path"
import { writeFile } from "fs/promises"

import { ensureWorkspaceDirs, getUploadsDir } from "@/lib/server/workspace"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const formData = await req.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 })
  }

  await ensureWorkspaceDirs()
  const uploads: string[] = []
  for (const entry of formData.getAll("files")) {
    if (!(entry instanceof File)) continue
    const bytes = Buffer.from(await entry.arrayBuffer())
    const safeName = entry.name.replace(/[^a-z0-9.\-_]/gi, "_")
    const filename = `${Date.now()}_${safeName}`
    const target = path.join(getUploadsDir(), filename)
    await writeFile(target, bytes)
    uploads.push(path.posix.join("uploads", filename))
  }

  return NextResponse.json({ files: uploads })
}
