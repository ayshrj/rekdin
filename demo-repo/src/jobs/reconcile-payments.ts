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
  let failed = 0
  const errors: string[] = []

  for (const row of pending.rows) {
    try {
      await query(`update orders set status = 'paid' where id = $1`, [row.id])
      processed += 1
    } catch (err) {
      failed += 1
      errors.push(`order ${row.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return {
    processed,
    failed,
    scanned: pending.rows.length,
    errors: errors.length > 0 ? errors : undefined,
  }
}
