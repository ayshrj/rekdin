import crypto from "crypto"
import { mkdir, stat, writeFile } from "fs/promises"
import path from "path"

import { ArtifactRef } from "@/types/runtime"

import { ensureWorkspaceDirs, getArtifactsDir } from "./workspace"

function sanitizeFilename(name: string) {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_")
  return base || "artifact.bin"
}

function contentTypeFromFilename(name: string) {
  const lower = name.toLowerCase()
  if (lower.endsWith(".png")) return "image/png"
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg"
  if (lower.endsWith(".webp")) return "image/webp"
  if (lower.endsWith(".gif")) return "image/gif"
  if (lower.endsWith(".pdf")) return "application/pdf"
  if (lower.endsWith(".zip")) return "application/zip"
  if (lower.endsWith(".json")) return "application/json"
  if (lower.endsWith(".txt") || lower.endsWith(".md")) return "text/plain; charset=utf-8"
  return "application/octet-stream"
}

function inferKind(mimeType: string, filename: string): ArtifactRef["kind"] {
  if (mimeType.startsWith("image/")) return "image"
  if (mimeType === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) return "pdf"
  if (mimeType === "application/zip" || filename.toLowerCase().endsWith(".zip")) return "archive"
  if (mimeType.includes("json")) return "json"
  if (mimeType.startsWith("text/")) return "text"
  return "file"
}

export async function storeArtifact(options: {
  filename: string
  bytes: Buffer
  mimeType?: string
}): Promise<ArtifactRef> {
  await ensureWorkspaceDirs()
  const safeName = sanitizeFilename(options.filename)
  const id = crypto.randomUUID()
  const storedName = `${id}-${safeName}`
  const fullPath = path.join(getArtifactsDir(), storedName)
  await mkdir(path.dirname(fullPath), { recursive: true })
  await writeFile(fullPath, options.bytes)
  const fileInfo = await stat(fullPath)
  const mimeType = options.mimeType?.trim() || contentTypeFromFilename(safeName)
  return {
    id,
    kind: inferKind(mimeType, safeName),
    filename: safeName,
    mimeType,
    url: `/api/artifacts/${storedName}`,
    size: fileInfo.size,
  }
}
