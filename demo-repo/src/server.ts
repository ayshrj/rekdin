import cors from "cors"
import express from "express"

import { config } from "./config"
import { adminRouter } from "./routes/admin"
import { ordersRouter } from "./routes/orders"

const app = express()

app.use(cors({ origin: config.corsOrigin, credentials: true }))
app.use(express.json({ limit: "2mb" }))

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "demo-repo-api" })
})

app.use("/api/orders", ordersRouter)
app.use("/api/admin", adminRouter)

app.listen(config.port, () => {
  console.log(`demo-repo listening on http://localhost:${config.port}`)
})
