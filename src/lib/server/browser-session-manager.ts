import type { Browser, Page } from "puppeteer"

type BrowserSession = {
  id: string
  page: Page
  lastUsedAt: number
}

class BrowserSessionManager {
  private sessions = new Map<string, BrowserSession>()

  async getOrCreate(sessionId: string, browserFactory: () => Promise<Browser>) {
    const existing = this.sessions.get(sessionId)
    if (existing) {
      existing.lastUsedAt = Date.now()
      return existing
    }
    const browser = await browserFactory()
    const page = await browser.newPage()
    const session: BrowserSession = {
      id: sessionId,
      page,
      lastUsedAt: Date.now(),
    }
    this.sessions.set(sessionId, session)
    return session
  }

  async withPage<T>(
    sessionId: string,
    browserFactory: () => Promise<Browser>,
    fn: (page: Page) => Promise<T>
  ) {
    const session = await this.getOrCreate(sessionId, browserFactory)
    session.lastUsedAt = Date.now()
    return fn(session.page)
  }

  async reset(sessionId: string) {
    const session = this.sessions.get(sessionId)
    if (!session) return
    await session.page.close().catch(() => {})
    this.sessions.delete(sessionId)
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
