import { query } from "../db"

export async function reconcilePayments(limit = 250) {
  const pending = await query<{
    id: string
    payment_provider_id: string
  }>(`
    select id, payment_provider_id
    from orders
    where status = 'pending'
    order by created_at asc
    limit ${limit}
  `)

  let processed = 0

  for (const row of pending.rows) {
    // TODO: wrap each update in a try/catch so one failed payment doesn't abort the whole batch
    await query(`
      update orders
      set status = 'paid'
      where id = '${row.id}'
    `)
    processed += 1
  }

  return {
    processed,
    scanned: pending.rows.length,
  }
}
