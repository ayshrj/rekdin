import { PuppeteerBlocker } from "@ghostery/adblocker-puppeteer"
import type { Browser, Page } from "puppeteer"
import puppeteer from "puppeteer-extra"
import RecaptchaPlugin from "puppeteer-extra-plugin-recaptcha"
import StealthPlugin from "puppeteer-extra-plugin-stealth"

import { storeArtifact } from "../../artifact-store"
import { getBrowserSessionManager } from "../../browser-session-manager"
import { getToolExecutionContext } from "../../tool-execution-context"

let browserPromise: Promise<Browser> | null = null
let stealthInitialized = false
let recaptchaInitialized = false
let adblockerPromise: Promise<PuppeteerBlocker | null> | null = null

export function isRecoverableBrowserError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  return (
    message.includes("Session closed") ||
    message.includes("Target closed") ||
    message.includes("Protocol error") ||
    message.includes("detached Frame") ||
    message.includes("Detached Frame") ||
    message.includes("Connection closed")
  )
}

export async function resetBrowserProcess() {
  const existing = await browserPromise?.catch(() => null)
  browserPromise = null
  const manager = getBrowserSessionManager() as { resetAll?: () => void }
  manager.resetAll?.()
  await existing?.close().catch(() => {})
}

/**
 * Registers Puppeteer stealth behavior once for the shared browser instance.
 * Browser tools keep running without stealth if the plugin cannot initialize.
 */
function ensureStealthPlugin() {
  if (stealthInitialized) return
  stealthInitialized = true
  try {
    puppeteer.use(StealthPlugin())
  } catch (err) {
    console.warn(
      "Failed to initialize puppeteer-extra-plugin-stealth, continuing without stealth mode.",
      err
    )
  }
}

/**
 * Lazily loads the Ghostery blocker used by browser tools to reduce ads and trackers.
 */
function getAdblocker() {
  if (!adblockerPromise) {
    adblockerPromise = PuppeteerBlocker.fromPrebuiltAdsAndTracking(fetch).catch((err) => {
      console.warn("Failed to initialize Ghostery adblocker, continuing without adblock.", err)
      return null
    })
  }
  return adblockerPromise
}

/**
 * Registers the reCAPTCHA helper once. Without a solver token it only detects challenges.
 */
function ensureRecaptchaPlugin() {
  if (recaptchaInitialized) return
  recaptchaInitialized = true
  try {
    const token = process.env.CAPTCHA_SOLVER_TOKEN || process.env.RECAPTCHA_SOLVER_TOKEN || ""
    // If no solver token is configured, still register the plugin to auto-detect challenges; user must provide token at runtime for solving.
    puppeteer.use(
      RecaptchaPlugin({
        provider: token ? { id: "2captcha", token } : { id: "none" },
        visualFeedback: false,
      })
    )
  } catch (err) {
    console.warn(
      "Failed to initialize puppeteer-extra-plugin-recaptcha, continuing without recaptcha helper.",
      err
    )
  }
}

/**
 * Returns the singleton headless Puppeteer browser used by all browser tools.
 */
export async function getBrowser() {
  if (browserPromise) {
    // If the previous browser process disconnected (e.g. after a hot-reload orphaned
    // the Puppeteer WebSocket), discard the stale promise and all sessions that used it.
    const existing = await browserPromise.catch(() => null)
    if (!existing?.isConnected()) {
      browserPromise = null
      const manager = getBrowserSessionManager() as { resetAll?: () => void }
      manager.resetAll?.()
    }
  }
  if (!browserPromise) {
    ensureStealthPlugin()
    ensureRecaptchaPlugin()
    browserPromise = puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    })
  }
  return browserPromise
}

/**
 * Runs a browser action against the session-scoped page when a chat session exists.
 * Falls back to a temporary page for tool calls outside an agent execution context.
 */
export async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const browser = await getBrowser()
  const sessionId = getToolExecutionContext()?.sessionId
  if (!sessionId) {
    const page = await browser.newPage()
    try {
      const adblocker = await getAdblocker()
      if (adblocker) {
        await adblocker.enableBlockingInPage(page)
      }
      return await fn(page)
    } finally {
      await page.close()
    }
  }

  const manager = getBrowserSessionManager()
  const runWithSessionPage = () =>
    manager.withPage(sessionId, getBrowser, async (page) => {
      if (!(page as Page & { __rekdinAdblockEnabled?: boolean }).__rekdinAdblockEnabled) {
        const adblocker = await getAdblocker()
        if (adblocker) {
          await adblocker.enableBlockingInPage(page)
        }
        ;(page as Page & { __rekdinAdblockEnabled?: boolean }).__rekdinAdblockEnabled = true
      }
      return fn(page)
    })

  try {
    return await runWithSessionPage()
  } catch (err) {
    if (!isRecoverableBrowserError(err)) throw err
    await resetBrowserProcess()
    return await runWithSessionPage()
  }
}

export async function withTemporaryPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const run = async () => {
    const browser = await getBrowser()
    const page = await browser.newPage()
    try {
      const adblocker = await getAdblocker()
      if (adblocker) {
        await adblocker.enableBlockingInPage(page)
      }
      return await fn(page)
    } finally {
      await page.close().catch(() => {})
    }
  }

  try {
    return await run()
  } catch (err) {
    if (!isRecoverableBrowserError(err)) throw err
    await resetBrowserProcess()
    return await run()
  }
}

/**
 * Navigates only when the current session page is not already at the requested URL.
 */
export async function goto(
  page: Page,
  url: string,
  waitUntil: "domcontentloaded" | "networkidle0" = "domcontentloaded"
) {
  if (page.url() === url && !url.startsWith("about:blank")) {
    return { status: null, url: page.url() }
  }
  const response = await page.goto(url, { waitUntil, timeout: 30000 })
  return { status: response?.status() ?? null, url: page.url() }
}

/**
 * Stores a browser screenshot as a Rekdin artifact and returns its artifact metadata.
 */
export async function screenshotArtifact(
  page: Page,
  fullPage = true,
  filename = "browser-screenshot.png"
) {
  const shot = (await page.screenshot({ fullPage, encoding: "binary" })) as Buffer
  return storeArtifact({
    filename,
    bytes: shot,
    mimeType: "image/png",
  })
}

/**
 * Captures a browser screenshot and returns the artifact URL used by tool renderers.
 */
export async function screenshotDataUrl(page: Page, fullPage = false) {
  const artifact = await screenshotArtifact(page, fullPage)
  return artifact.url
}

/**
 * Resolves a CSS selector to the center point used by pointer-based browser actions.
 */
export async function centerOfSelector(page: Page, selector: string) {
  const handle = await page.$(selector)
  if (!handle) return null
  const box = await handle.boundingBox()
  if (!box) return null
  return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) }
}
