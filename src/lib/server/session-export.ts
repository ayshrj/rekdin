import { ChatMessage, ChatSession } from "@/types/chat"

import { renderReplayHtml } from "./replay-store"
import { getReplayStore } from "./replay-store"
import { getSessionStore } from "./session-store"
import { getTraceStore } from "./trace-store"

function collectArtifactUrls(value: unknown, output: Set<string>) {
  if (!value) return
  if (typeof value === "string") {
    if (
      value.startsWith("/api/artifacts/") ||
      value.startsWith("/api/uploads/") ||
      value.startsWith("/api/pdf/") ||
      value.startsWith("https://")
    ) {
      output.add(value)
    }
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectArtifactUrls(item, output))
    return
  }
  if (typeof value === "object") {
    Object.values(value).forEach((item) => collectArtifactUrls(item, output))
  }
}

function extractArtifacts(session: ChatSession) {
  const urls = new Set<string>()
  session.messages.forEach((message: ChatMessage) => {
    message.attachments?.forEach((attachment) => collectArtifactUrls(attachment, urls))
    message.toolCalls?.forEach((call) => collectArtifactUrls(call.result, urls))
  })
  return Array.from(urls)
}

export async function buildSessionExportBundle(sessionId: string) {
  const session = await getSessionStore().getSession(sessionId)
  if (!session) return null

  const replay = await getReplayStore().getReplay(sessionId)
  const traces = await getTraceStore().list(sessionId)
  const artifacts = extractArtifacts(session)

  return {
    exportedAt: new Date().toISOString(),
    session,
    traces,
    artifacts,
    replay,
    replayHtml: replay ? renderReplayHtml(replay) : null,
  }
}
