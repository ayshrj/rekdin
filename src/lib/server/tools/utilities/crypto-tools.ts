import { tool } from "@langchain/core/tools"
import crypto from "crypto"
import { z } from "zod"

import { readWorkspaceText } from "../workspace/workspace-fs"

/**
 * Computes a cryptographic hash for inline text or a workspace file.
 */
export const hashTool = tool(
  async ({ input, algorithm, path: filePath }) => {
    let data = input
    if (!data && !filePath) {
      return { type: "hash", error: "Provide `input` or `path`" }
    }
    if (filePath) {
      data = await readWorkspaceText(filePath)
    }
    const hash = crypto
      .createHash(algorithm)
      .update(data ?? "")
      .digest("hex")
    return { type: "hash", algorithm, hash, source: filePath ?? "inline" }
  },
  {
    name: "hash",
    description: "Compute a hash (md5/sha1/sha256/sha512) for inline text or a workspace file.",
    schema: z.object({
      input: z.string().optional(),
      path: z.string().optional(),
      algorithm: z.enum(["md5", "sha1", "sha256", "sha512"]).default("sha256"),
    }),
  }
)

export const uuidGenerateTool = tool(
  async ({ count = 1 }: { count?: number }) => {
    const n = Math.min(Math.max(Math.round(count), 1), 16)
    const uuids = Array.from({ length: n }, () => crypto.randomUUID())
    return { type: "uuid_generate", count: n, uuids }
  },
  {
    name: "uuid_generate",
    description: "Generate one or more v4 UUIDs.",
    schema: z.object({ count: z.number().int().min(1).max(16).optional() }),
  }
)

export const jwtDecodeTool = tool(
  async ({ token }: { token: string }) => {
    const parts = token.replace(/^Bearer\s+/i, "").split(".")
    if (parts.length < 2 || parts.length > 3) {
      return { type: "jwt_decode", error: "Invalid JWT: expected 2 or 3 dot-separated segments." }
    }
    function decodeSegment(seg: string): unknown {
      try {
        const padded = seg + "=".repeat((4 - (seg.length % 4)) % 4)
        const json = Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
          "utf8"
        )
        return JSON.parse(json)
      } catch {
        return null
      }
    }
    const header = decodeSegment(parts[0])
    const payload = decodeSegment(parts[1]) as Record<string, unknown> | null
    const now = Math.floor(Date.now() / 1000)
    const exp = typeof payload?.exp === "number" ? payload.exp : undefined
    const iat = typeof payload?.iat === "number" ? payload.iat : undefined
    const nbf = typeof payload?.nbf === "number" ? payload.nbf : undefined
    return {
      type: "jwt_decode",
      header,
      payload,
      hasSignature: parts.length === 3,
      algorithm: (header as Record<string, unknown> | null)?.alg ?? undefined,
      issuedAt: iat != null ? new Date(iat * 1000).toISOString() : undefined,
      notBefore: nbf != null ? new Date(nbf * 1000).toISOString() : undefined,
      expiresAt: exp != null ? new Date(exp * 1000).toISOString() : undefined,
      expired: exp != null ? now > exp : undefined,
      secondsUntilExpiry: exp != null ? exp - now : undefined,
    }
  },
  {
    name: "jwt_decode",
    description:
      "Decode a JWT token — return header, payload, and expiry info. Never verifies the signature.",
    schema: z.object({ token: z.string().min(1) }),
  }
)
