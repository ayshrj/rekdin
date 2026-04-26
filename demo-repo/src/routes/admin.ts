import { Router } from "express"

import { isAdminRequest } from "../auth"
import { reconcilePayments } from "../jobs/reconcile-payments"

export const adminRouter = Router()

adminRouter.use((req, res, next) => {
  if (!isAdminRequest(req)) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  next()
})

adminRouter.post("/reconcile-payments", async (req, res) => {
  const limit = Number(req.body?.limit ?? 250)
  const result = await reconcilePayments(limit)
  res.json(result)
})

// TODO: add rate limiting to all admin endpoints — currently nothing prevents brute-forcing the token
adminRouter.get("/stats", async (_req, res) => {
  // TODO: pull queueDepth and unhealthyVendors from live data instead of hardcoding
  res.json({
    queueDepth: 17,
    lastDeployAt: "2026-04-24T16:00:00.000Z",
    unhealthyVendors: ["mail", "payments"],
  })
})
