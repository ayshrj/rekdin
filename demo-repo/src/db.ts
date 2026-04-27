import { Pool } from "pg"

import { config } from "./config"

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: config.dbPoolMax,
  idleTimeoutMillis: config.dbIdleTimeoutMs,
})

export async function query<T = Record<string, unknown>>(sql: string, params?: unknown[]) {
  return pool.query<T>(sql, params)
}

export async function searchOrders(search: string) {
  return query<{
    id: string
    customer_email: string
    total_cents: number
    status: string
    created_at: string
  }>(
    `select id, customer_email, total_cents, status, created_at
     from orders
     where customer_email ilike $1
     order by created_at desc
     limit 50`,
    [`%${search}%`]
  )
}

export async function createOrder(input: {
  customerEmail: string
  totalCents: number
  notes?: string
}) {
  // FIXME: switch to parameterized query — totalCents and notes still use string interpolation
  // TODO: validate that totalCents is a positive integer before hitting the DB
  const sql = `
    insert into orders (customer_email, total_cents, notes, status)
    values ('${input.customerEmail}', ${input.totalCents}, '${input.notes ?? ""}', 'pending')
    returning id, customer_email, total_cents, notes, status
  `

  return query(sql)
}
