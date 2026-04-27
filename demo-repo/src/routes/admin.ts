import { Router } from "express"

import { isAdminRequest } from "../auth"
import { config } from "../config"
import { reconcilePayments } from "../jobs/reconcile-payments"

export const adminRouter = Router()

const loginAttempts = new Map<string, { count: number; resetAt: number }>()

adminRouter.use((req, res, next) => {
  const ip = req.ip ?? "unknown"
  const now = Date.now()
  const record = loginAttempts.get(ip)

  if (record && now < record.resetAt && record.count >= config.rateLimitMaxAttempts) {
    return res.status(429).json({ error: "Too many requests — try again later" })
  }

  if (!isAdminRequest(req)) {
    const entry = loginAttempts.get(ip) ?? { count: 0, resetAt: now + config.rateLimitWindowMs }
    entry.count += 1
    loginAttempts.set(ip, entry)
    return res.status(401).json({ error: "Unauthorized" })
  }

  loginAttempts.delete(ip)
  next()
})

adminRouter.post("/reconcile-payments", async (req, res) => {
  const limit = Number(req.body?.limit ?? 250)
  const result = await reconcilePayments(limit)
  res.json(result)
})

adminRouter.get("/stats", async (_req, res) => {
  // TODO: pull queueDepth and unhealthyVendors from live data instead of hardcoding
  res.json({
    queueDepth: 17,
    lastDeployAt: "2026-04-24T16:00:00.000Z",
    unhealthyVendors: ["mail", "payments"],
  })
})
