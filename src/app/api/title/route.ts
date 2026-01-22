import { NextResponse } from "next/server"
import { z } from "zod"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const requestSchema = z.object({
  prompt: z.string().min(1).max(10_000),
})

function fallbackTitle(prompt: string) {
  const cleaned = prompt
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!cleaned) return "New Conversation"
  const firstSentence = cleaned.split(/[.?!]\s/)[0] ?? cleaned
  const title = firstSentence.slice(0, 60).trim()
  return title.length > 0 ? title : "New Conversation"
}

function cleanModelTitle(raw: string) {
  const normalized = raw
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.。！？!]+$/g, "")
    .trim()
  if (!normalized) return null
  return normalized.slice(0, 60)
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const apiKey = req.headers.get("x-openrouter-api-key")?.trim() ?? ""
  const model = req.headers.get("x-openrouter-model")?.trim() || "openai/gpt-4o-mini"

  if (!apiKey) {
    return NextResponse.json({ title: fallbackTitle(parsed.data.prompt), source: "fallback" })
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": req.headers.get("origin") ?? "http://localhost:3000",
        "X-Title": "Rekdin Next",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 24,
        messages: [
          {
            role: "system",
            content:
              "Generate a concise chat title describing the user's request. Return ONLY the title text (3-8 words), no quotes, no markdown, no trailing punctuation. Max 60 chars.",
          },
          { role: "user", content: parsed.data.prompt },
        ],
      }),
    })

    if (!res.ok) {
      return NextResponse.json({ title: fallbackTitle(parsed.data.prompt), source: "fallback" })
    }

    const data = (await res.json().catch(() => null)) as {
      choices?: Array<{
        message?: { content?: string }
      }>
    } | null
    const raw = data?.choices?.[0]?.message?.content ?? ""
    const title = cleanModelTitle(raw) ?? fallbackTitle(parsed.data.prompt)
    return NextResponse.json({ title, source: "openrouter" })
  } catch {
    return NextResponse.json({ title: fallbackTitle(parsed.data.prompt), source: "fallback" })
  }
}
