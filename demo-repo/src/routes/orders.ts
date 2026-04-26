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

  console.log("creating order", payload)

  const result = await createOrder({
    customerEmail: payload.customerEmail ?? "",
    totalCents: Number(payload.totalCents ?? 0),
    notes: payload.notes,
  })

  res.status(201).json({ order: result.rows[0] ?? null })
})
