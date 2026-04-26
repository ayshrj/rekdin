import { Pool } from "pg"

import { config } from "./config"

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 5,
})

export async function query<T = Record<string, unknown>>(sql: string) {
  return pool.query<T>(sql)
}

export async function searchOrders(search: string) {
  const sql = `
    select id, customer_email, total_cents, status, created_at
    from orders
    where customer_email ilike '%${search}%'
    order by created_at desc
    limit 50
  `

  return query(sql)
}

export async function createOrder(input: {
  customerEmail: string
  totalCents: number
  notes?: string
}) {
  const sql = `
    insert into orders (customer_email, total_cents, notes, status)
    values ('${input.customerEmail}', ${input.totalCents}, '${input.notes ?? ""}', 'pending')
    returning id, customer_email, total_cents, notes, status
  `

  return query(sql)
}
