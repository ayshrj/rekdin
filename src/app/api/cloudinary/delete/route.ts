import crypto from "crypto"
import { NextResponse } from "next/server"
import { z } from "zod"

import { getSettingsStore } from "@/lib/server/settings-store"

export const runtime = "nodejs"

const requestSchema = z.object({
  urls: z.array(z.string().min(1)).min(1),
})

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

function parseCloudinaryUrl(url: string, cloudName: string) {
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.includes("cloudinary.com")) return null
    const parts = parsed.pathname.split("/").filter(Boolean)
    if (parts.length < 4) return null
    if (parts[0] !== cloudName) return null
    const uploadIndex = parts.indexOf("upload")
    if (uploadIndex <= 0 || uploadIndex === parts.length - 1) return null
    const resourceType = parts[uploadIndex - 1]
    if (!["image", "video", "raw"].includes(resourceType)) return null
    let remainder = parts.slice(uploadIndex + 1)
    const versionIndex = remainder.findIndex((segment) => /^v\d+$/.test(segment))
    if (versionIndex !== -1) {
      remainder = remainder.slice(versionIndex + 1)
    }
    if (remainder.length === 0) return null
    let publicId = remainder.join("/")
    publicId = publicId.replace(/\.[^/.]+$/, "")
    if (!publicId) return null
    return { publicId, resourceType }
  } catch {
    return null
  }
}

async function deleteAsset(
  config: CloudinaryConfig,
  target: { publicId: string; resourceType: string }
) {
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = crypto
    .createHash("sha1")
    .update(`public_id=${target.publicId}&timestamp=${timestamp}${config.apiSecret}`)
    .digest("hex")

  const form = new FormData()
  form.append("public_id", target.publicId)
  form.append("api_key", config.apiKey)
  form.append("timestamp", String(timestamp))
  form.append("signature", signature)

  const endpoint = `https://api.cloudinary.com/v1_1/${config.cloudName}/${target.resourceType}/destroy`
  const res = await fetch(endpoint, { method: "POST", body: form })
  const data = (await res.json().catch(() => ({}))) as { result?: string }
  const result = data.result ?? (res.ok ? "ok" : "error")
  return { status: res.status, result }
}

export async function POST(req: Request) {
  const payload = await req.json().catch(() => null)
  if (!payload) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const settings = await getSettingsStore().load()
  const config = getCloudinaryConfig(settings)
  if (!config) {
    return NextResponse.json({ error: "Missing Cloudinary credentials" }, { status: 400 })
  }

  const targets = new Map<string, { publicId: string; resourceType: string }>()
  const skipped: string[] = []

  for (const url of parsed.data.urls) {
    const parsedUrl = parseCloudinaryUrl(url, config.cloudName)
    if (!parsedUrl) {
      skipped.push(url)
      continue
    }
    const key = `${parsedUrl.resourceType}:${parsedUrl.publicId}`
    if (!targets.has(key)) {
      targets.set(key, parsedUrl)
    }
  }

  const deleted: Array<{ publicId: string; resourceType: string; result: string }> = []
  const failed: Array<{ publicId: string; resourceType: string; result: string }> = []

  for (const target of targets.values()) {
    const outcome = await deleteAsset(config, target)
    const result = typeof outcome.result === "string" ? outcome.result : "error"
    const record = { publicId: target.publicId, resourceType: target.resourceType, result }
    if (
      outcome.status >= 200 &&
      outcome.status < 300 &&
      (result === "ok" || result === "not found")
    ) {
      deleted.push(record)
    } else {
      failed.push(record)
    }
  }

  if (failed.length > 0) {
    return NextResponse.json(
      { error: "Failed to delete some Cloudinary assets", deleted, failed, skipped },
      { status: 500 }
    )
  }

  return NextResponse.json({ deleted, skipped })
}
