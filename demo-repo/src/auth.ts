import crypto from "crypto"
import type { Request } from "express"

import { config } from "./config"

export function isAdminRequest(req: Request) {
  const token = req.header("x-admin-token") ?? ""
  if (token.length === 0 || token.length !== config.adminToken.length) return false
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(config.adminToken))
}
