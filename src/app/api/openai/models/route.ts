import { NextResponse } from "next/server"

import { getSettingsStore } from "@/lib/server/settings-store"

export const runtime = "nodejs"

interface OpenAIModel {
  id: string
  object: "model"
  created: number
  owned_by: string
}

interface OpenAIListResponse {
  object: "list"
  data: OpenAIModel[]
}

const CHAT_MODEL_PREFIXES = ["gpt-", "o1", "o3", "o4", "chatgpt-"]

function isChatModel(id: string) {
  return CHAT_MODEL_PREFIXES.some((p) => id.startsWith(p))
}

export async function GET(req: Request) {
  const settings = await getSettingsStore().load()
  const apiKey = req.headers.get("x-openai-api-key")?.trim() || settings.openAIApiKey
  if (!apiKey) {
    return NextResponse.json({ error: "Missing OpenAI API key" }, { status: 400 })
  }

  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    return NextResponse.json(
      { error: `OpenAI error (${res.status})`, details: text.slice(0, 2000) },
      { status: 502 }
    )
  }

  const data = (await res.json()) as OpenAIListResponse
  const models = data.data
    .filter((m) => isChatModel(m.id))
    .sort((a, b) => b.created - a.created)
    .map((m) => ({ id: m.id, owned_by: m.owned_by }))

  return NextResponse.json({ models })
}
