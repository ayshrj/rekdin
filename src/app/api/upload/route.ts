import crypto from "crypto"
import { writeFile } from "fs/promises"
import { NextResponse } from "next/server"
import path from "path"

import { getSettingsStore } from "@/lib/server/settings-store"
import { ensureWorkspaceDirs, getUploadsDir } from "@/lib/server/workspace"

export const runtime = "nodejs"

type CloudinaryConfig = {
  cloudName: string
  apiKey: string
  apiSecret: string
}

function getCloudinaryConfig(settings: {
  cloudinaryCloudName: string
  cloudinaryApiKey: string
  cloudinaryApiSecret: string
}): CloudinaryConfig | null {
  const cloudName = settings.cloudinaryCloudName?.trim() ?? ""
  const apiKey = settings.cloudinaryApiKey?.trim() ?? ""
  const apiSecret = settings.cloudinaryApiSecret?.trim() ?? ""
  if (!cloudName || !apiKey || !apiSecret) return null
  return { cloudName, apiKey, apiSecret }
}

async function uploadToCloudinary(entry: File, config: CloudinaryConfig) {
  const bytes = Buffer.from(await entry.arrayBuffer())
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = crypto
    .createHash("sha1")
    .update(`timestamp=${timestamp}${config.apiSecret}`)
    .digest("hex")

  const form = new FormData()
  const mimeType = entry.type || "application/octet-stream"
  const base64 = bytes.toString("base64")
  form.append("file", `data:${mimeType};base64,${base64}`)
  form.append("api_key", config.apiKey)
  form.append("timestamp", String(timestamp))
  form.append("signature", signature)

  const endpoint = `https://api.cloudinary.com/v1_1/${config.cloudName}/auto/upload`
  const res = await fetch(endpoint, { method: "POST", body: form })
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    const suffix = detail ? `: ${detail.slice(0, 200)}` : ""
    throw new Error(`Cloudinary upload failed (${res.status})${suffix}`)
  }
  const data = (await res.json()) as { secure_url?: string; url?: string }
  const url = data.secure_url || data.url
  if (!url) throw new Error("Cloudinary response missing URL")
  return url
}

async function storeLocally(entry: File) {
  await ensureWorkspaceDirs()
  const originalName = entry.name?.trim() || "upload"
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_")
  const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`
  const destination = path.join(getUploadsDir(), filename)
  const bytes = Buffer.from(await entry.arrayBuffer())
  await writeFile(destination, bytes)
  return `/api/uploads/${filename}`
}

export async function POST(req: Request) {
  const formData = await req.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 })
  }

  const settings = await getSettingsStore().load()
  const cloudinary = getCloudinaryConfig(settings)
  const uploads: string[] = []
  for (const entry of formData.getAll("files")) {
    if (!(entry instanceof File)) continue
    const url = cloudinary ? await uploadToCloudinary(entry, cloudinary) : await storeLocally(entry)
    uploads.push(url)
  }

  return NextResponse.json({ files: uploads })
}
