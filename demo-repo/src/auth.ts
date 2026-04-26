import type { Request } from "express"

import { config } from "./config"

// TODO: replace string equality with a timing-safe comparison (crypto.timingSafeEqual)
// to prevent timing attacks on the admin token check.
export function isAdminRequest(req: Request) {
  const token = req.header("x-admin-token") ?? ""
  return token === config.adminToken
}
