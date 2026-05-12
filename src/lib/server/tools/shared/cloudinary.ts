import crypto from "crypto"

type CloudinaryConfig = { cloudName: string; apiKey: string; apiSecret: string }

export type { CloudinaryConfig }

/**
 * Reads Cloudinary credentials from tool headers first, then server environment.
 */
export function parseCloudinaryConfig(headers?: HeadersInit): CloudinaryConfig | null {
  const get = (key: string) => {
    if (!headers) return ""
    if (headers instanceof Headers) return headers.get(key) ?? ""
    if (Array.isArray(headers)) {
      const match = headers.find(([k]) => k.toLowerCase() === key.toLowerCase())
      return match ? (match[1] ?? "") : ""
    }
    const record = headers as Record<string, string>
    return record[key] ?? ""
  }

  const cloudName =
    get("x-cloudinary-cloud-name") ||
    process.env.CLOUDINARY_CLOUD_NAME ||
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    ""
  const apiKey = get("x-cloudinary-api-key") || process.env.CLOUDINARY_API_KEY || ""
  const apiSecret = get("x-cloudinary-api-secret") || process.env.CLOUDINARY_API_SECRET || ""

  if (!cloudName || !apiKey || !apiSecret) return null
  return { cloudName: cloudName.trim(), apiKey: apiKey.trim(), apiSecret: apiSecret.trim() }
}

/**
 * Uploads generated PDF bytes to Cloudinary when upload credentials are configured.
 */
export async function uploadPdfToCloudinary(
  pdf: Buffer,
  publicId: string,
  config: CloudinaryConfig
): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = crypto
    .createHash("sha1")
    .update(`public_id=${publicId}&timestamp=${timestamp}${config.apiSecret}`)
    .digest("hex")

  const form = new FormData()
  const base64 = pdf.toString("base64")
  form.append("file", `data:application/pdf;base64,${base64}`)
  form.append("api_key", config.apiKey)
  form.append("timestamp", String(timestamp))
  form.append("signature", signature)
  form.append("public_id", publicId)

  const endpoint = `https://api.cloudinary.com/v1_1/${config.cloudName}/raw/upload`
  const res = await fetch(endpoint, { method: "POST", body: form })
  const data = (await res.json().catch(() => ({}))) as {
    secure_url?: string
    url?: string
    error?: unknown
  }
  if (!res.ok) {
    const message =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      typeof data?.error === "object" && data?.error && "message" in (data.error as any)
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data.error as any).message
        : JSON.stringify(data).slice(0, 500) || "Unknown Cloudinary error"
    throw new Error(`Cloudinary upload failed (${res.status}): ${message}`)
  }
  const url = data.secure_url || data.url
  if (!url) throw new Error("Cloudinary response missing URL")
  return url
}
