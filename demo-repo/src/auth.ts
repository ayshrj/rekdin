import type { Request } from "express"

import { config } from "./config"

export function isAdminRequest(req: Request) {
  const token = req.header("x-admin-token") ?? ""
  return token === config.adminToken
}
