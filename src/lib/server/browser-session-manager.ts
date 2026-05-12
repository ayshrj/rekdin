import type { Browser, Page } from "puppeteer"

type BrowserSession = {
  id: string
  page: Page
  lastUsedAt: number
}

class BrowserSessionManager {
  private sessions = new Map<string, BrowserSession>()

  private async create(sessionId: string, browserFactory: () => Promise<Browser>) {
    const browser = await browserFactory()
    const page = await browser.newPage()
    const session: BrowserSession = { id: sessionId, page, lastUsedAt: Date.now() }
    this.sessions.set(sessionId, session)
    return session
  }

  async getOrCreate(sessionId: string, browserFactory: () => Promise<Browser>) {
    const existing = this.sessions.get(sessionId)
    if (existing) {
      // Quick health probe — isClosed() misses detached frames; evaluate() catches both
      const healthy =
        !existing.page.isClosed() &&
        (await existing.page
          .evaluate(() => null)
          .then(() => true)
          .catch(() => false))
      if (healthy) {
        existing.lastUsedAt = Date.now()
        return existing
      }
      this.sessions.delete(sessionId)
    }
    return this.create(sessionId, browserFactory)
  }

  private static isRecoverable(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err)
    return (
      msg.includes("Session closed") ||
      msg.includes("Target closed") ||
      msg.includes("Protocol error") ||
      msg.includes("detached Frame") ||
      msg.includes("Detached Frame") ||
      msg.includes("Connection closed")
    )
  }

  async withPage<T>(
    sessionId: string,
    browserFactory: () => Promise<Browser>,
    fn: (page: Page) => Promise<T>
  ): Promise<T> {
    // Wrap the entire call including getOrCreate so errors from create() are also recovered
    try {
      const session = await this.getOrCreate(sessionId, browserFactory)
      session.lastUsedAt = Date.now()
      return await fn(session.page)
    } catch (err) {
      if (!BrowserSessionManager.isRecoverable(err)) throw err
      // Discard the stale session and retry once with a fresh page
      this.sessions.delete(sessionId)
      const fresh = await this.create(sessionId, browserFactory)
      return fn(fresh.page)
    }
  }

  async reset(sessionId: string) {
    const session = this.sessions.get(sessionId)
    if (!session) return
    await session.page.close().catch(() => {})
    this.sessions.delete(sessionId)
  }

  resetAll() {
    for (const session of this.sessions.values()) {
      session.page.close().catch(() => {})
    }
    this.sessions.clear()
  }
}

declare global {
  var __REKDIN_BROWSER_SESSION_MANAGER: BrowserSessionManager | undefined
}

export function getBrowserSessionManager() {
  if (!globalThis.__REKDIN_BROWSER_SESSION_MANAGER) {
    globalThis.__REKDIN_BROWSER_SESSION_MANAGER = new BrowserSessionManager()
  }
  return globalThis.__REKDIN_BROWSER_SESSION_MANAGER
}
