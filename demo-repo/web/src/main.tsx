import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"

import { fetchOrders, triggerReconcile } from "./api"

type Order = {
  id: string
  customer_email: string
  total_cents: number
  status: string
}

export function App() {
  const [search, setSearch] = useState("")
  const [adminToken, setAdminToken] = useState("")
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    fetchOrders(search).then((data) => setOrders(data.items ?? []))
  }, [search])

  return (
    <main>
      <h1>Order Operations Dashboard</h1>
      <input value={search} onChange={(event) => setSearch(event.target.value)} />
      <input
        value={adminToken}
        placeholder="Admin token"
        onChange={(event) => setAdminToken(event.target.value)}
      />
      <button onClick={() => triggerReconcile(adminToken, 100)}>Reconcile Payments</button>
      <ul>
        {orders.map((order) => (
          <li key={order.id}>
            {order.customer_email} - {order.status} - {order.total_cents}
          </li>
        ))}
      </ul>
    </main>
  )
}

const rootElement = document.getElementById("root")

if (rootElement) {
  createRoot(rootElement).render(<App />)
}
