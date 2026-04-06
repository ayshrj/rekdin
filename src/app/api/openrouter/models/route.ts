import { NextResponse } from "next/server"

import { getSettingsStore } from "@/lib/server/settings-store"

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

const DIRECT_PROVIDER_MODEL_PREFIXES = [
  "openai/",
  "anthropic/claude",
  "google/gemini",
  "x-ai/grok",
  "xai/grok",
] as const

function isFilteredDirectProviderModel(modelId: string) {
  return DIRECT_PROVIDER_MODEL_PREFIXES.some((prefix) => modelId.startsWith(prefix))
}

export async function GET(req: Request) {
  const settings = await getSettingsStore().load()
  const apiKey = req.headers.get("x-openrouter-api-key")?.trim() || settings.openRouterApiKey
  if (!apiKey) {
    return NextResponse.json({ error: "Missing OpenRouter API key" }, { status: 400 })
  }

  const res = await fetch("https://openrouter.ai/api/v1/models", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
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
    data.data
      ?.filter((m) => !isFilteredDirectProviderModel(m.id))
      .map((m) => ({
        id: m.id,
        name: m.name ?? m.id,
        description: m.description ?? "",
        contextLength: m.context_length ?? null,
      })) ?? []

  return NextResponse.json({ models })
}
