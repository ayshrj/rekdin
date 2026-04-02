import { ReplayEvent, SessionReplayData } from "@/types/chat"

import { readJsonFile, withFileWriteLock, writeJsonFileAtomic } from "./json-store"
import { ensureWorkspaceDirs, getReplayFilePath } from "./workspace"

type EventType = ReplayEvent["type"]

class ReplayStore {
  private cache = new Map<string, ReplayEvent[]>()

  private async loadSessionEvents(sessionId: string) {
    const cached = this.cache.get(sessionId)
    if (cached) return cached
    await ensureWorkspaceDirs()
    const events = await readJsonFile<ReplayEvent[]>(getReplayFilePath(sessionId), [])
    this.cache.set(sessionId, events)
    return events
  }

  async record(sessionId: string, type: EventType, data: Record<string, unknown>) {
    const filePath = getReplayFilePath(sessionId)
    return withFileWriteLock(filePath, async () => {
      const existing = [...(await this.loadSessionEvents(sessionId))]
      const event: ReplayEvent = {
        id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        sessionId,
        type,
        data,
        timestamp: Date.now(),
      }
      const next = [...existing, event]
      await writeJsonFileAtomic(filePath, next)
      this.cache.set(sessionId, next)
      return event
    })
  }

  async getReplay(sessionId: string): Promise<SessionReplayData | null> {
    const events = await this.loadSessionEvents(sessionId)
    if (events.length === 0) return null
    const start = events[0]!.timestamp
    const end = events[events.length - 1]!.timestamp
    const totalMessages = events.filter(
      (event) => event.type === "user_message" || event.type === "assistant_message"
    ).length
    const totalToolCalls = events.filter((event) => event.type === "tool_call").length
    return {
      sessionId,
      startTime: start,
      endTime: end,
      events,
      metadata: {
        totalMessages,
        totalToolCalls,
      },
    }
  }

  async deleteReplay(sessionId: string) {
    this.cache.delete(sessionId)
    await writeJsonFileAtomic(getReplayFilePath(sessionId), [])
  }
}

declare global {
  var __REPLAY_STORE: ReplayStore | undefined
}

export function getReplayStore() {
  if (!globalThis.__REPLAY_STORE) {
    globalThis.__REPLAY_STORE = new ReplayStore()
  }
  return globalThis.__REPLAY_STORE
}

export function renderReplayHtml(data: SessionReplayData) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Session Replay - ${data.sessionId}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
    <style>
      body { font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 32px; }
      .container { max-width: 960px; margin: 0 auto; }
      .header { margin-bottom: 32px; }
      .events { display: grid; gap: 16px; }
      .card { background: #1e293b; border-radius: 16px; padding: 16px 20px; box-shadow: 0 15px 35px rgba(15,23,42,.35); }
      .event-type { font-weight: 600; text-transform: uppercase; font-size: 12px; letter-spacing: .08em; color: #38bdf8; }
      .timestamp { font-size: 12px; color: #94a3b8; }
      pre { background: #020617; padding: 16px; border-radius: 10px; overflow-x: auto; font-size: 13px; }
      .metadata { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 16px; }
      .pill { background: rgba(148,163,184,.2); color: #f8fafc; padding: 4px 10px; border-radius: 999px; font-size: 12px; }
    </style>
  </head>
  <body>
    <div class="container">
      <header class="header">
        <h1>Rekdin Session Replay</h1>
        <p>Session ID: ${data.sessionId}</p>
        <p>Events: ${data.events.length} · Messages: ${data.metadata.totalMessages} · Tool calls: ${data.metadata.totalToolCalls}</p>
      </header>
      <section class="events">
        ${data.events
          .map(
            (event) => `
          <article class="card">
            <div class="event-type">${event.type}</div>
            <div class="timestamp">${new Date(event.timestamp).toLocaleString()}</div>
            <pre>${JSON.stringify(event.data, null, 2)}</pre>
          </article>`
          )
          .join("")}
      </section>
    </div>
  </body>
</html>`
}
