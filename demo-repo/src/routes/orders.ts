import { Router } from "express"

import { createOrder, searchOrders } from "../db"

export const ordersRouter = Router()

ordersRouter.get("/", async (req, res) => {
  const search = String(req.query.search ?? "")
  const result = await searchOrders(search)
  res.json({ items: result.rows })
})

ordersRouter.post("/", async (req, res) => {
  const payload = req.body as {
    customerEmail?: string
    totalCents?: number
    notes?: string
  }

  if (!payload.customerEmail || !payload.customerEmail.includes("@")) {
    return res.status(400).json({ error: "customerEmail is required and must be a valid email" })
  }

  if (
    typeof payload.totalCents !== "number" ||
    payload.totalCents <= 0 ||
    !Number.isInteger(payload.totalCents)
  ) {
    return res.status(400).json({ error: "totalCents must be a positive integer" })
  }

  const result = await createOrder({
    customerEmail: payload.customerEmail,
    totalCents: payload.totalCents,
    notes: payload.notes,
  })

  res.status(201).json({ order: result.rows[0] ?? null })
})
