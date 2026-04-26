const API_BASE =
  (globalThis as typeof globalThis & { __DEMO_API_BASE__?: string }).__DEMO_API_BASE__ ??
  "http://localhost:4000"

export async function fetchOrders(search: string) {
  const response = await fetch(`${API_BASE}/api/orders?search=${encodeURIComponent(search)}`)
  return response.json()
}

export async function triggerReconcile(adminToken: string, limit: number) {
  const response = await fetch(`${API_BASE}/api/admin/reconcile-payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": adminToken,
    },
    body: JSON.stringify({ limit }),
  })

  return response.json()
}
