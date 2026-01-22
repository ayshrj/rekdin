import { NextResponse } from "next/server"

export const runtime = "nodejs"

type OpenRouterModelsResponse = {
  data?: Array<{
    id: string
    name?: string
    description?: string
    context_length?: number
    pricing?: Record<string, unknown>
    top_provider?: Record<string, unknown>
  }>
}

export async function GET(req: Request) {
  const headerKey = req.headers.get("x-openrouter-api-key")?.trim() ?? ""
  if (!headerKey) {
    return NextResponse.json({ error: "Missing OpenRouter API key" }, { status: 400 })
  }

  const res = await fetch("https://openrouter.ai/api/v1/models", {
    headers: {
      Authorization: `Bearer ${headerKey}`,
      "HTTP-Referer": req.headers.get("origin") ?? "http://localhost:3000",
      "X-Title": "Rekdin Next",
    },
    cache: "no-store",
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    return NextResponse.json(
      { error: `OpenRouter error (${res.status})`, details: text.slice(0, 2000) },
      { status: 502 }
    )
  }

  const data = (await res.json()) as OpenRouterModelsResponse
  const models =
    data.data?.map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      description: m.description ?? "",
      contextLength: m.context_length ?? null,
    })) ?? []

  return NextResponse.json({ models })
}
