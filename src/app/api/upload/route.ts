import crypto from "crypto"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

type CloudinaryConfig = {
  cloudName: string
  apiKey: string
  apiSecret: string
}

function getCloudinaryConfig(req: Request): CloudinaryConfig | null {
  const cloudName = req.headers.get("x-cloudinary-cloud-name")?.trim() ?? ""
  const apiKey = req.headers.get("x-cloudinary-api-key")?.trim() ?? ""
  const apiSecret = req.headers.get("x-cloudinary-api-secret")?.trim() ?? ""
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

export async function POST(req: Request) {
  const formData = await req.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 })
  }

  const cloudinary = getCloudinaryConfig(req)
  if (!cloudinary) {
    return NextResponse.json({ error: "Missing Cloudinary credentials" }, { status: 400 })
  }
  const uploads: string[] = []
  for (const entry of formData.getAll("files")) {
    if (!(entry instanceof File)) continue
    const url = await uploadToCloudinary(entry, cloudinary)
    uploads.push(url)
  }

  return NextResponse.json({ files: uploads })
}
