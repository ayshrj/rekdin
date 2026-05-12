import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { buildLlmFromSettings } from "@/lib/server/chat-agent"
import { getSessionStore } from "@/lib/server/session-store"
import { getProviderSettings } from "@/lib/server/settings-store"
import { ChatMessage } from "@/types/chat"

const RequestSchema = z.object({
  sessionId: z.string(),
  focus: z.string().optional(),
})

function formatTranscript(messages: ChatMessage[]): string {
  return messages
    .filter((m) => !m.metadata?.compactionMarker)
    .filter((m) => !m.metadata?.starred)
    .map((m) => {
      if (m.role === "user") {
        return `USER: ${m.content}`
      }
      if (m.role === "assistant") {
        const toolLines = (m.toolCalls ?? [])
          .map((tc) => {
            const resultPreview = tc.result ? JSON.stringify(tc.result).slice(0, 120) : undefined
            return `  [called ${tc.name}${resultPreview ? " → " + resultPreview : ""}]`
          })
          .join("\n")
        return `ASSISTANT: ${m.content || ""}${toolLines ? "\n" + toolLines : ""}`
      }
      return ""
    })
    .filter(Boolean)
    .join("\n\n")
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }
    const { sessionId, focus } = parsed.data

    const providerSettings = await getProviderSettings()
    const session = await getSessionStore().getSession(sessionId)
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const transcript = formatTranscript(session.messages)
    const pinned = session.messages
      .filter((message) => message.metadata?.starred)
      .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
      .join("\n\n")
    if (!transcript.trim()) {
      return NextResponse.json({ error: "No messages to summarize" }, { status: 400 })
    }

    const systemParts = [
      "Summarize this AI assistant conversation concisely.",
      "Preserve: current goal, key decisions, files and code discussed, tool findings, open tasks.",
      "Be faithful and complete. Output plain prose, no headers or bullet points.",
    ]
    if (focus) systemParts.push(`Pay special attention to: ${focus}`)
    if (pinned) {
      systemParts.push(
        "Pinned messages were excluded from compaction and remain available separately. Do not summarize them unless needed for continuity."
      )
    }

    const llm = buildLlmFromSettings(providerSettings)
    const result = await llm.invoke([
      new SystemMessage(systemParts.join(" ")),
      new HumanMessage(`CONVERSATION TRANSCRIPT:\n\n${transcript}`),
    ])

    const summary =
      typeof result.content === "string" ? result.content : JSON.stringify(result.content)

    return NextResponse.json({ summary })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Compact failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
