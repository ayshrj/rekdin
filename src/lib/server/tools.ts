import { PuppeteerBlocker } from "@ghostery/adblocker-puppeteer"
import { tool } from "@langchain/core/tools"
import { Readability } from "@mozilla/readability"
import { spawn } from "child_process"
import crypto from "crypto"
import { createPatch } from "diff"
import { unzipSync, zipSync } from "fflate"
import { mkdir, mkdtemp, readdir, readFile, rm, stat, unlink, writeFile } from "fs/promises"
import { JSDOM } from "jsdom"
import keywordExtractor from "keyword-extractor"
import os from "os"
import path from "path"
import type { Browser, Page } from "puppeteer"
import puppeteer from "puppeteer-extra"
import RecaptchaPlugin from "puppeteer-extra-plugin-recaptcha"
import StealthPlugin from "puppeteer-extra-plugin-stealth"
import { Project } from "ts-morph"
import TurndownService from "turndown"
import { pathToFileURL } from "url"
import { z } from "zod"

import {
  getProviderApiKey,
  getProviderLabel,
  getProviderModel,
  hasProviderCredentials as hasLlmProviderCredentials,
} from "@/lib/llm-providers"
import { getAllWorkflowPresets } from "@/lib/workflows"
import { ChatMessage, ReplayEvent, ToolCall } from "@/types/chat"
import { ArtifactRef, BackgroundJob, ServerSettings, TurnTrace } from "@/types/runtime"

import { storeArtifact } from "./artifact-store"
import { getBackgroundJobStore } from "./background-job-store"
import { getBrowserSessionManager } from "./browser-session-manager"
import { getReplayStore } from "./replay-store"
import { getSessionStore } from "./session-store"
import {
  getSettingsStore,
  hasProviderCredentials as settingsHaveProviderCredentials,
} from "./settings-store"
import { estimateTokens } from "./token-budget"
import { getToolExecutionContext } from "./tool-execution-context"
import { getTraceStore } from "./trace-store"
import { searchPublicWeb } from "./web-search"
import {
  assertWorkspacePathAllowed,
  BLOCKED_WORKSPACE_DIRECTORIES,
  ensureWorkspaceDirs,
  findBlockedWorkspaceDirectoryReference,
  findBlockedWorkspacePathSegment,
  getArtifactsDir,
  getWorkspaceRoot,
  isBlockedWorkspaceDirectoryName,
  protectedWorkspaceAccessAllowed,
  resolveWorkspacePath,
} from "./workspace"

const turndown = new TurndownService({ headingStyle: "atx" })

let browserPromise: Promise<Browser> | null = null
let stealthInitialized = false
let recaptchaInitialized = false
let adblockerPromise: Promise<PuppeteerBlocker | null> | null = null
let latexJsStylesPromise: Promise<string> | null = null

function isRecoverableBrowserError(err: unknown) {
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

async function resetBrowserProcess() {
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
async function getBrowser() {
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
async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
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

async function withTemporaryPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
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
async function goto(
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
async function screenshotArtifact(
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
async function screenshotDataUrl(page: Page, fullPage = false) {
  const artifact = await screenshotArtifact(page, fullPage)
  return artifact.url
}

/**
 * Resolves a CSS selector to the center point used by pointer-based browser actions.
 */
async function centerOfSelector(page: Page, selector: string) {
  const handle = await page.$(selector)
  if (!handle) return null
  const box = await handle.boundingBox()
  if (!box) return null
  return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) }
}

/**
 * Limits large text values before sending them back to the model or UI.
 */
function truncateString(value: string, max = 4000) {
  if (value.length <= max) return value
  return `${value.slice(0, max)}\n\n...(truncated, ${value.length} chars total)`
}

function boundedLimit(value: unknown, fallback: number, max: number) {
  const parsed = typeof value === "number" ? Math.floor(value) : Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, max)
}

function previewString(value: unknown, max = 300) {
  const text = typeof value === "string" ? value : value == null ? "" : String(value)
  const normalized = text.replace(/\s+/g, " ").trim()
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max)}...`
}

function hashUnknown(value: unknown) {
  let text: string
  try {
    text = typeof value === "string" ? value : JSON.stringify(value)
  } catch {
    text = String(value)
  }
  return crypto
    .createHash("sha256")
    .update(text ?? "")
    .digest("hex")
    .slice(0, 16)
}

function getMessageToolCalls(message: ChatMessage) {
  return Array.isArray(message.toolCalls) ? message.toolCalls : []
}

function compactToolCall(call: ToolCall) {
  return {
    id: call.id,
    name: call.name,
    status: call.status,
    timestamp: call.timestamp,
    duration: call.duration,
    argumentKeys: Object.keys(call.arguments ?? {}),
    resultType:
      call.result && typeof call.result === "object" && typeof call.result.type === "string"
        ? call.result.type
        : undefined,
    error: call.error ? previewString(call.error, 240) : undefined,
  }
}

function compactMessage(message: ChatMessage) {
  const toolCalls = getMessageToolCalls(message)
  return {
    id: message.id,
    role: message.role,
    timestamp: message.timestamp,
    contentPreview: previewString(message.content, 500),
    contentChars: message.content.length,
    attachmentsCount: message.attachments?.length ?? 0,
    toolCallCount: toolCalls.length,
    toolCalls: toolCalls.slice(0, 12).map(compactToolCall),
    omittedToolCalls: Math.max(toolCalls.length - 12, 0),
    metadata: {
      tokens: message.metadata?.tokens,
      agentType: message.metadata?.agentType,
      model: message.metadata?.model,
      toolPolicy: message.metadata?.toolPolicy,
      workflowId: message.metadata?.workflowId,
      backgroundJobId: message.metadata?.backgroundJobId,
      errorCode: message.metadata?.errorCode,
    },
  }
}

function replayToolCall(event: ReplayEvent) {
  const data = event.data ?? {}
  const toolCall = data.toolCall
  return toolCall && typeof toolCall === "object" ? (toolCall as Record<string, unknown>) : null
}

function replayEventText(event: ReplayEvent) {
  try {
    return JSON.stringify(event)
  } catch {
    return `${event.type} ${event.id}`
  }
}

function compactReplayEvent(event: ReplayEvent) {
  const toolCall = replayToolCall(event)
  return {
    id: event.id,
    type: event.type,
    timestamp: event.timestamp,
    toolName: typeof toolCall?.name === "string" ? toolCall.name : undefined,
    status: typeof toolCall?.status === "string" ? toolCall.status : undefined,
    duration: typeof toolCall?.duration === "number" ? toolCall.duration : undefined,
    dataPreview: previewString(replayEventText(event), 700),
    dataHash: hashUnknown(event.data),
  }
}

function compactTrace(trace: TurnTrace) {
  return {
    id: trace.id,
    startedAt: trace.startedAt,
    completedAt: trace.completedAt,
    mode: trace.mode,
    toolPolicy: trace.toolPolicy,
    provider: trace.provider,
    model: trace.model,
    workflowId: trace.workflowId,
    success: trace.success,
    toolCount: trace.toolCount,
    totalToolDurationMs: trace.totalToolDurationMs,
    retryCount: trace.retryCount,
    responseSchemaApplied: trace.responseSchemaApplied,
    warnings: trace.warnings.slice(0, 8).map((warning) => previewString(warning, 240)),
    omittedWarnings: Math.max(trace.warnings.length - 8, 0),
    error: trace.error ? previewString(trace.error, 300) : undefined,
    tokenUsageEstimate: trace.tokenUsageEstimate,
  }
}

function aggregateTokenUsage(traces: TurnTrace[]) {
  return traces.reduce(
    (total, trace) => {
      const usage = trace.tokenUsageEstimate
      if (!usage) return total
      total.systemPromptTokens += usage.systemPromptTokens
      total.historyTokens += usage.historyTokens
      total.toolSchemaTokens += usage.toolSchemaTokens
      total.toolResultTokens += usage.toolResultTokens
      total.originalToolResultTokens += usage.originalToolResultTokens
      total.savedToolResultTokens += usage.savedToolResultTokens
      total.completionTokens += usage.completionTokens
      total.totalPromptTokens += usage.totalPromptTokens
      total.totalTokens += usage.totalTokens
      total.tracesWithUsage += 1
      return total
    },
    {
      tracesWithUsage: 0,
      systemPromptTokens: 0,
      historyTokens: 0,
      toolSchemaTokens: 0,
      toolResultTokens: 0,
      originalToolResultTokens: 0,
      savedToolResultTokens: 0,
      completionTokens: 0,
      totalPromptTokens: 0,
      totalTokens: 0,
    }
  )
}

function compactBackgroundJob(job: BackgroundJob) {
  return {
    id: job.id,
    sessionId: job.sessionId,
    status: job.status,
    mode: job.mode,
    toolPolicy: job.toolPolicy,
    workflowId: job.workflowId,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    resultMessageId: job.resultMessageId,
    promptPreview: previewString(job.prompt, 360),
    promptChars: job.prompt.length,
    responseSchemaApplied: Boolean(job.responseSchema),
    errorPreview: job.error ? previewString(job.error, 360) : undefined,
  }
}

function configuredProviderSummary(settings: ServerSettings) {
  const providers = ["openrouter", "openai", "gemini", "claude", "grok", "azure_openai"] as const
  return providers.map((provider) => ({
    provider,
    label: getProviderLabel(provider),
    selected: settings.llmProvider === provider,
    configured: hasLlmProviderCredentials(provider, settings),
    hasApiKey: Boolean(getProviderApiKey(provider, settings)),
    modelConfigured: Boolean(getProviderModel(provider, settings)),
    model: getProviderModel(provider, settings) || undefined,
    endpointConfigured:
      provider === "azure_openai" ? Boolean(settings.azureOpenAIEndpoint) : undefined,
  }))
}

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1
    return counts
  }, {})
}

function lastDefined<T>(values: T[], predicate: (value: T) => boolean) {
  return [...values].reverse().find(predicate)
}

function assertNoBlockedDirectoryReference(value: string) {
  if (protectedWorkspaceAccessAllowed()) return
  const blockedDirectory = findBlockedWorkspaceDirectoryReference(value)
  if (!blockedDirectory) return
  throw new Error(
    `Access to protected workspace directory "${blockedDirectory}" is blocked. Use a narrower project path and never inspect generated dependency/build folders.`
  )
}

/**
 * Runs a shell command inside the configured Rekdin workspace boundary.
 */
async function runCommand(command: string, cwd?: string, timeoutMs = 30000) {
  await ensureWorkspaceDirs()
  const workingDir = cwd ? resolveWorkspacePath(cwd) : getWorkspaceRoot()
  return await new Promise<{ stdout: string; stderr: string; exitCode: number; duration: number }>(
    (resolve) => {
      const child = spawn(command, {
        shell: os.platform() === "win32" ? "powershell.exe" : "bash",
        cwd: workingDir,
        env: process.env,
      })
      const start = Date.now()
      let stdout = ""
      let stderr = ""
      let finished = false

      child.stdout.on("data", (chunk) => (stdout += chunk.toString()))
      child.stderr.on("data", (chunk) => (stderr += chunk.toString()))

      const timer = setTimeout(() => {
        if (finished) return
        child.kill("SIGTERM")
      }, timeoutMs)

      child.on("close", (code) => {
        finished = true
        clearTimeout(timer)
        resolve({ stdout, stderr, exitCode: code ?? 0, duration: Date.now() - start })
      })
    }
  )
}

/**
 * Runs a shell command without forcing Rekdin workspace path resolution.
 * This is used for host-level discovery such as git and local executable checks.
 */
async function runCommandUnsafe(command: string, cwd?: string, timeoutMs = 30000) {
  return await new Promise<{ stdout: string; stderr: string; exitCode: number; duration: number }>(
    (resolve) => {
      const child = spawn(command, {
        shell: os.platform() === "win32" ? "powershell.exe" : "bash",
        cwd,
        env: process.env,
      })
      const start = Date.now()
      let stdout = ""
      let stderr = ""
      let finished = false

      child.stdout.on("data", (chunk) => (stdout += chunk.toString()))
      child.stderr.on("data", (chunk) => (stderr += chunk.toString()))

      const timer = setTimeout(() => {
        if (finished) return
        child.kill("SIGTERM")
      }, timeoutMs)

      child.on("close", (code) => {
        finished = true
        clearTimeout(timer)
        resolve({ stdout, stderr, exitCode: code ?? 0, duration: Date.now() - start })
      })
    }
  )
}

const LATEX_ENGINES = ["tectonic", "pdflatex", "xelatex", "lualatex"]

/**
 * Produces a filesystem-safe PDF base filename.
 */
function sanitizePdfBaseName(name?: string) {
  const base = path.basename(name ?? "document").replace(/\.pdf$/i, "")
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, "_")
  return safe.length > 0 ? safe : "document"
}

/**
 * Checks whether a generated or referenced file exists.
 */
async function fileExists(filePath: string) {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Finds the first locally available LaTeX engine for native PDF compilation.
 */
async function findLatexEngine() {
  for (const engine of LATEX_ENGINES) {
    const res = await runCommandUnsafe(`${engine} --version`, undefined, 5000)
    if (res.exitCode === 0) return engine
  }
  return null
}

type CloudinaryConfig = { cloudName: string; apiKey: string; apiSecret: string }

/**
 * Reads Cloudinary credentials from tool headers first, then server environment.
 */
function parseCloudinaryConfig(headers?: HeadersInit): CloudinaryConfig | null {
  const get = (key: string) => {
    if (!headers) return ""
    if (headers instanceof Headers) return headers.get(key) ?? ""
    if (Array.isArray(headers)) {
      const match = headers.find(([k]) => k.toLowerCase() === key.toLowerCase())
      return match ? (match[1] ?? "") : ""
    }
    const record = headers as Record<string, string>
    return record[key] ?? ""
  }

  const cloudName =
    get("x-cloudinary-cloud-name") ||
    process.env.CLOUDINARY_CLOUD_NAME ||
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    ""
  const apiKey = get("x-cloudinary-api-key") || process.env.CLOUDINARY_API_KEY || ""
  const apiSecret = get("x-cloudinary-api-secret") || process.env.CLOUDINARY_API_SECRET || ""

  if (!cloudName || !apiKey || !apiSecret) return null
  return { cloudName: cloudName.trim(), apiKey: apiKey.trim(), apiSecret: apiSecret.trim() }
}

/**
 * Reads a UTF-8 file after resolving it against the Rekdin workspace root.
 */
async function readWorkspaceText(filePath: string) {
  await ensureWorkspaceDirs()
  const resolved = resolveWorkspacePath(filePath)
  return await readFile(resolved, "utf-8")
}

/**
 * Writes UTF-8 content after resolving the path against the Rekdin workspace root.
 */
async function writeWorkspaceText(filePath: string, content: string) {
  await ensureWorkspaceDirs()
  const resolved = resolveWorkspacePath(filePath)
  await writeFile(resolved, content, "utf-8")
  return resolved
}

/**
 * Parses a JSON Pointer path into unescaped path segments for JSON/YAML patching.
 */
function parseJsonPointer(pointer: string) {
  const parts = pointer.split("/").slice(1)
  return parts.map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"))
}

/**
 * Applies one add, replace, or remove operation to an in-memory JSON-compatible value.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyOperation(target: any, op: { op: string; path: string; value?: any }) {
  const tokens = parseJsonPointer(op.path)
  if (tokens.length === 0) {
    if (op.op === "replace" || op.op === "add") return op.value
    if (op.op === "remove") return undefined
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let curr: any = target
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const key = tokens[i]
    if (curr[key] == null) {
      curr[key] = Number.isInteger(Number(tokens[i + 1])) ? [] : {}
    }
    curr = curr[key]
  }
  const last = tokens[tokens.length - 1]

  if (op.op === "add" || op.op === "replace") {
    if (Array.isArray(curr)) {
      const index = last === "-" ? curr.length : Number(last)
      if (op.op === "add") {
        curr.splice(index, 0, op.value)
      } else {
        curr[index] = op.value
      }
    } else {
      curr[last] = op.value
    }
    return target
  }

  if (op.op === "remove") {
    if (Array.isArray(curr)) {
      const index = Number(last)
      if (!Number.isNaN(index)) curr.splice(index, 1)
    } else {
      delete curr[last]
    }
    return target
  }

  throw new Error(`Unsupported op: ${op.op}`)
}

/**
 * Applies the subset of JSON Patch operations supported by Rekdin's patch tools.
 */
function applyJsonPatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  document: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  operations: Array<{ op: string; path: string; value?: any }>
) {
  let target = JSON.parse(JSON.stringify(document))
  for (const op of operations) {
    target = applyOperation(target, op)
  }
  return target
}

/**
 * Loads the optional YAML dependency only when a YAML patch tool call needs it.
 */
async function loadYamlModule() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("yaml")
    return mod
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = await import("yaml" as any)
      return mod
    } catch {
      return null
    }
  }
}

/**
 * Converts a URL or data URL into bytes for image/document helper tools.
 */
async function fetchBuffer(source: string): Promise<Buffer> {
  if (/^data:/i.test(source)) {
    const base64 = source.split(",")[1] ?? ""
    return Buffer.from(base64, "base64")
  }
  const res = await fetch(source)
  if (!res.ok) throw new Error(`Failed to fetch resource (${res.status})`)
  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * Decodes inline data as data URL, base64, or plain UTF-8 bytes.
 */
function decodeDataInput(data: string): Buffer {
  if (/^data:/i.test(data)) {
    const base64 = data.split(",")[1] ?? ""
    return Buffer.from(base64, "base64")
  }
  if (/^[A-Za-z0-9+/=\\n\\r]+$/.test(data.trim())) {
    try {
      return Buffer.from(data.trim(), "base64")
    } catch {
      // fall through to utf-8 buffer
    }
  }
  return Buffer.from(data)
}

/**
 * Loads the optional sharp dependency only for image metadata/conversion tools.
 */
async function loadSharp() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("sharp")
    return mod
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = await import("sharp" as any)
      return mod
    } catch {
      return null
    }
  }
}

/**
 * Loads OCR support only when requested. Tesseract is intentionally optional
 * because most Rekdin installs do not need the worker payload on the hot path.
 */
async function loadTesseract() {
  try {
    // Keep this dynamic so the app can build without bundling OCR workers.
    const dynamicImport = new Function("specifier", "return import(specifier)")
    return await dynamicImport("tesseract.js")
  } catch {
    return null
  }
}

/**
 * Escapes text before inserting it into generated export HTML.
 */
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * Wraps rendered markup in printable HTML used by PDF generation tools.
 */
function buildPrintableHtmlDocument(
  title: string,
  bodyMarkup: string,
  note?: string,
  extraStyles = ""
) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      body {
        margin: 0;
        padding: 40px 48px;
        color: #171717;
        background: #ffffff;
        line-height: 1.6;
        font-size: 14px;
      }
      .page {
        max-width: 760px;
        margin: 0 auto;
      }
      .note {
        margin-bottom: 20px;
        padding: 12px 14px;
        border: 1px solid rgba(99, 102, 241, 0.18);
        background: rgba(99, 102, 241, 0.06);
        border-radius: 12px;
        color: #312e81;
        font-size: 12px;
      }
      h1, h2, h3, h4, h5, h6 {
        line-height: 1.25;
        margin: 1.2em 0 0.5em;
      }
      h1 { font-size: 28px; }
      h2 { font-size: 22px; }
      h3 { font-size: 18px; }
      p, ul, ol, pre, blockquote, table {
        margin: 0.75em 0;
      }
      ul, ol {
        padding-left: 1.4em;
      }
      a {
        color: #2563eb;
        text-decoration: underline;
      }
      img {
        max-width: 100%;
        height: auto;
        border-radius: 10px;
      }
      pre, code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }
      pre {
        background: #f5f5f5;
        border: 1px solid #e5e5e5;
        border-radius: 12px;
        padding: 14px;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      blockquote {
        border-left: 3px solid #d4d4d8;
        padding-left: 12px;
        color: #52525b;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        border: 1px solid #e5e7eb;
        padding: 8px 10px;
        text-align: left;
        vertical-align: top;
      }
      ${extraStyles}
    </style>
  </head>
  <body>
    <main class="page">
      ${note ? `<div class="note">${escapeHtml(note)}</div>` : ""}
      ${bodyMarkup}
    </main>
  </body>
</html>`
}

/**
 * Renders a minimal inline Markdown subset for PDF/export HTML generation.
 */
function renderInlineMarkdown(markdown: string) {
  return escapeHtml(markdown)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g, (_, alt, src, title) => {
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : ""
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${titleAttr} />`
    })
    .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g, (_, text, href, title) => {
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : ""
      return `<a href="${escapeHtml(href)}"${titleAttr}>${escapeHtml(text)}</a>`
    })
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
}

/**
 * Renders a deterministic Markdown subset without depending on the React renderer.
 */
function renderMarkdownHtml(markdown: string) {
  const normalized = markdown.replace(/\r\n/g, "\n").trim()
  if (!normalized) {
    return "<p></p>"
  }

  const blocks = normalized.split(/\n{2,}/)
  const htmlBlocks = blocks.map((block) => {
    const trimmed = block.trim()
    if (!trimmed) return ""

    if (/^```/.test(trimmed)) {
      const code = trimmed.replace(/^```[^\n]*\n?/, "").replace(/\n?```$/, "")
      return `<pre><code>${escapeHtml(code)}</code></pre>`
    }

    const lines = trimmed.split("\n")

    if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
      return `<ul>${lines
        .map((line) => `<li>${renderInlineMarkdown(line.replace(/^\s*[-*]\s+/, ""))}</li>`)
        .join("")}</ul>`
    }

    if (lines.every((line) => /^\s*\d+\.\s+/.test(line))) {
      return `<ol>${lines
        .map((line) => `<li>${renderInlineMarkdown(line.replace(/^\s*\d+\.\s+/, ""))}</li>`)
        .join("")}</ol>`
    }

    if (lines.every((line) => /^\s*>/.test(line))) {
      return `<blockquote>${lines
        .map((line) => renderInlineMarkdown(line.replace(/^\s*>\s?/, "")))
        .join("<br />")}</blockquote>`
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      return `<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`
    }

    if (
      /^\|.+\|$/.test(lines[0] ?? "") &&
      lines.length >= 2 &&
      /^\|?(\s*:?-+:?\s*\|)+\s*$/.test(lines[1] ?? "")
    ) {
      const parseRow = (row: string) =>
        row
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((cell) => cell.trim())
      const header = parseRow(lines[0]!)
      const body = lines.slice(2).map(parseRow)
      return `<table><thead><tr>${header
        .map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`)
        .join("")}</tr></thead><tbody>${body
        .map(
          (row) =>
            `<tr>${row.map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`).join("")}</tr>`
        )
        .join("")}</tbody></table>`
    }

    return `<p>${lines.map((line) => renderInlineMarkdown(line)).join("<br />")}</p>`
  })

  return htmlBlocks.filter(Boolean).join("\n")
}

/**
 * Loads latex.js CSS and rewrites relative assets to file URLs for PDF rendering.
 */
async function getLatexJsStyles() {
  if (!latexJsStylesPromise) {
    latexJsStylesPromise = (async () => {
      const latexEntryPath = require.resolve("latex.js")
      const latexDistDir = path.dirname(latexEntryPath)
      const cssDir = path.join(latexDistDir, "css")
      const baseUrl = `${pathToFileURL(latexDistDir).href.replace(/\/$/, "")}/`
      const styleFiles = ["katex.css", "base.css", "article.css"]
      const styles = await Promise.all(
        styleFiles.map(async (filename) => {
          const css = await readFile(path.join(cssDir, filename), "utf-8")
          return css.replace(
            /url\((['"]?)(?!data:|https?:|file:)([^)'"]+)\1\)/g,
            (_, quote, assetPath) => {
              const absoluteUrl = new URL(assetPath, baseUrl).href
              const q = quote || '"'
              return `url(${q}${absoluteUrl}${q})`
            }
          )
        })
      )
      return styles.join("\n\n")
    })()
  }
  return latexJsStylesPromise
}

/**
 * Renders LaTeX content to standalone HTML through latex.js.
 */
async function renderLatexJsHtml(texContent: string) {
  const previousWindow = global.window
  const previousDocument = global.document

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createHTMLWindow } = require("svgdom")
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { HtmlGenerator, parse } = require("latex.js")

    global.window = createHTMLWindow()
    global.document = global.window.document

    const generator = parse(texContent, {
      generator: new HtmlGenerator({ hyphenate: false }),
    })
    const container = global.document.createElement("div")
    container.appendChild(generator.domFragment().cloneNode(true))

    return {
      bodyMarkup: `<section class="latex-fallback">${container.innerHTML}</section>`,
      extraStyles: await getLatexJsStyles(),
    }
  } finally {
    global.window = previousWindow
    global.document = previousDocument
  }
}

/**
 * Builds a readable HTML fallback when latex.js cannot render the source cleanly.
 */
async function buildLatexFallbackHtml(
  safeBase: string,
  texContent: string,
  note: string,
  compilerOutput?: string
) {
  try {
    const rendered = await renderLatexJsHtml(texContent)
    const bodyMarkup = [
      `<h1>${escapeHtml(safeBase)}</h1>`,
      `<p>Rekdin rendered this preview from the LaTeX source because a full TeX compilation path was unavailable.</p>`,
      rendered.bodyMarkup,
      compilerOutput ? `<h2>Compiler output</h2><pre>${escapeHtml(compilerOutput)}</pre>` : "",
    ]
      .filter(Boolean)
      .join("")

    return buildPrintableHtmlDocument(safeBase, bodyMarkup, note, rendered.extraStyles)
  } catch (error) {
    const errorMessage =
      error instanceof Error ? escapeHtml(error.message) : "Unknown latex.js fallback error"
    return buildPrintableHtmlDocument(
      safeBase,
      `<h1>${escapeHtml(safeBase)}</h1><p>Rekdin could not render this document with a full TeX engine, and the LaTeX preview renderer also failed. Showing the source instead.</p><pre>${escapeHtml(texContent)}</pre>${compilerOutput ? `<h2>Compiler output</h2><pre>${escapeHtml(compilerOutput)}</pre>` : ""}<h2>Fallback renderer error</h2><pre>${errorMessage}</pre>`,
      note
    )
  }
}

/**
 * Writes generated PDF bytes into Rekdin's artifact store.
 */
async function persistPdfBuffer(
  pdfBuffer: Buffer,
  safeBase: string,
  cloudinaryConfig?: CloudinaryConfig
) {
  let uploadedUrl: string | null = null
  let artifact: ArtifactRef | null = null

  if (cloudinaryConfig) {
    const publicId = `latex/${safeBase}-${Date.now()}`
    uploadedUrl = await uploadPdfToCloudinary(pdfBuffer, publicId, cloudinaryConfig)
  } else {
    artifact = await storeArtifact({
      filename: `${safeBase}.pdf`,
      bytes: pdfBuffer,
      mimeType: "application/pdf",
    })
  }

  return {
    uploadedUrl,
    artifact,
    artifactUrl: artifact?.url,
  }
}

/**
 * Prints HTML to PDF through the session browser and optionally uploads it to Cloudinary.
 */
async function renderHtmlToPdf(
  html: string,
  baseName: string,
  cloudinaryConfig?: CloudinaryConfig
) {
  const started = Date.now()
  const safeBase = sanitizePdfBaseName(baseName)
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 })
    const pdfBuffer = Buffer.from(
      await page.pdf({
        format: "A4",
        margin: { top: "18mm", right: "14mm", bottom: "18mm", left: "14mm" },
        printBackground: true,
      })
    )
    const persisted = await persistPdfBuffer(pdfBuffer, safeBase, cloudinaryConfig)
    return {
      success: true,
      pdfGenerated: true,
      degraded: false,
      filename: safeBase,
      engine: "puppeteer-html",
      duration: Date.now() - started,
      cloudinaryUrl: persisted.uploadedUrl ?? undefined,
      artifact: persisted.artifact,
      artifactUrl: persisted.artifactUrl,
      output: "Rendered PDF using the built-in browser renderer.",
    }
  } finally {
    await page.close()
  }
}

/**
 * Uploads generated PDF bytes to Cloudinary when upload credentials are configured.
 */
async function uploadPdfToCloudinary(
  pdf: Buffer,
  publicId: string,
  config: CloudinaryConfig
): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = crypto
    .createHash("sha1")
    .update(`public_id=${publicId}&timestamp=${timestamp}${config.apiSecret}`)
    .digest("hex")

  const form = new FormData()
  const base64 = pdf.toString("base64")
  form.append("file", `data:application/pdf;base64,${base64}`)
  form.append("api_key", config.apiKey)
  form.append("timestamp", String(timestamp))
  form.append("signature", signature)
  form.append("public_id", publicId)

  const endpoint = `https://api.cloudinary.com/v1_1/${config.cloudName}/raw/upload`
  const res = await fetch(endpoint, { method: "POST", body: form })
  const data = (await res.json().catch(() => ({}))) as {
    secure_url?: string
    url?: string
    error?: unknown
  }
  if (!res.ok) {
    const message =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      typeof data?.error === "object" && data?.error && "message" in (data.error as any)
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data.error as any).message
        : JSON.stringify(data).slice(0, 500) || "Unknown Cloudinary error"
    throw new Error(`Cloudinary upload failed (${res.status}): ${message}`)
  }
  const url = data.secure_url || data.url
  if (!url) throw new Error("Cloudinary response missing URL")
  return url
}

/**
 * Compiles LaTeX with a native engine when available, otherwise falls back to browser PDF rendering.
 */
async function compileLatexToPdf(
  texContent: string,
  baseName: string,
  cloudinaryConfig?: CloudinaryConfig
) {
  const started = Date.now()
  const safeBase = sanitizePdfBaseName(baseName)
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "latex-"))
  const texFilename = "document.tex"
  const texPath = path.join(tempDir, texFilename)
  const pdfTempPath = path.join(tempDir, "document.pdf")

  let engine: string | null = null
  let uploadedUrl: string | null = null
  let artifact: ArtifactRef | null = null

  try {
    await writeFile(texPath, texContent, "utf-8")
    engine = await findLatexEngine()
    if (!engine) {
      const fallbackHtml = await buildLatexFallbackHtml(
        `${safeBase}.pdf`,
        texContent,
        "Fallback preview: generated from LaTeX source because no TeX engine was available on this deployment."
      )
      const fallback = await renderHtmlToPdf(fallbackHtml, safeBase, cloudinaryConfig)
      return {
        ...fallback,
        degraded: true,
        filename: safeBase,
        texContent,
        error:
          "No LaTeX engine was available, so Rekdin generated a readable source-preview PDF instead of a fully typeset LaTeX PDF.",
      }
    }

    const command =
      engine === "tectonic"
        ? `${engine} -o . ${texFilename}`
        : `${engine} -interaction=nonstopmode -halt-on-error -output-directory=. ${texFilename}`

    const res = await runCommandUnsafe(command, tempDir, 60000)
    const pdfExists = await fileExists(pdfTempPath)
    const duration = Date.now() - started

    if (!pdfExists || res.exitCode !== 0) {
      const output = truncateString(
        [res.stdout, res.stderr].filter(Boolean).join("\n\n").trim() || "No output captured",
        4000
      )
      const fallbackHtml = await buildLatexFallbackHtml(
        `${safeBase}.pdf`,
        texContent,
        "Fallback preview: generated from LaTeX source because the TeX compilation step failed.",
        output
      )
      const fallback = await renderHtmlToPdf(fallbackHtml, safeBase, cloudinaryConfig)
      return {
        ...fallback,
        degraded: true,
        filename: safeBase,
        texContent,
        engine,
        duration,
        error: `LaTeX compilation failed using ${engine} (exit code ${res.exitCode}). Generated a source-preview PDF instead.`,
        output,
      }
    }

    const pdfBuffer = await readFile(pdfTempPath)
    const persisted = await persistPdfBuffer(pdfBuffer, safeBase, cloudinaryConfig)
    uploadedUrl = persisted.uploadedUrl
    artifact = persisted.artifact

    return {
      success: true,
      pdfGenerated: true,
      degraded: false,
      filename: safeBase,
      texContent,
      engine,
      duration,
      cloudinaryUrl: uploadedUrl ?? undefined,
      artifact,
      artifactUrl: artifact?.url,
      output: truncateString(
        res.stdout.trim() || res.stderr.trim() || "LaTeX compilation succeeded.",
        4000
      ),
    }
  } catch (err) {
    const duration = Date.now() - started
    const message = err instanceof Error ? err.message : "Unknown error"
    return {
      success: false,
      pdfGenerated: false,
      filename: safeBase,
      texContent,
      engine,
      duration,
      cloudinaryUrl: uploadedUrl ?? undefined,
      artifact,
      artifactUrl: artifact?.url,
      error: message,
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}

/**
 * Fetches JSON from a public API with the Rekdin user agent.
 */
async function fetchJson<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": "Rekdin/NextJS" } })
  if (!res.ok) throw new Error(`Failed request (${res.status})`)
  return (await res.json()) as T
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items))
}

function safeShellArg(value: string) {
  return `'${value.replace(/'/g, "'\"'\"'")}'`
}

function isReadOnlySql(query: string) {
  return /^\s*(select|with|pragma)\b/i.test(query) && !/;\s*\S/.test(query.trim())
}

function parseSimpleCsv(input: string, delimiter = ",", maxRows = 50) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    const next = input[index + 1]
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
      continue
    }
    if (char === '"') {
      quoted = true
      continue
    }
    if (char === delimiter) {
      row.push(cell)
      cell = ""
      continue
    }
    if (char === "\n") {
      row.push(cell)
      rows.push(row)
      if (rows.length >= maxRows) return rows
      row = []
      cell = ""
      continue
    }
    if (char !== "\r") cell += char
  }
  row.push(cell)
  if (row.length > 1 || row[0]) rows.push(row)
  return rows
}

function getJsonPath(value: unknown, query: string) {
  if (!query || query === "$") return value
  const normalized = query.startsWith("$.") ? query.slice(2) : query.replace(/^\//, "")
  const parts = normalized.split(/[./]/).flatMap((part) => {
    const tokens: string[] = []
    const re = /([^[\]]+)|\[(\d+)\]/g
    for (const match of part.matchAll(re)) tokens.push(match[1] ?? match[2] ?? "")
    return tokens.filter(Boolean)
  })
  let cursor = value as unknown
  for (const part of parts) {
    if (Array.isArray(cursor)) {
      cursor = cursor[Number(part)]
    } else if (cursor && typeof cursor === "object") {
      cursor = (cursor as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return cursor
}

function parseFrontmatter(markdown: string) {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/)
  if (!match) return { frontmatter: null, body: markdown }
  const body = markdown.slice(match[0].length)
  const raw = match[1]
  const frontmatter: Record<string, string | string[]> = {}
  for (const line of raw.split(/\r?\n/)) {
    const separator = line.indexOf(":")
    if (separator <= 0) continue
    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    if (value.startsWith("[") && value.endsWith("]")) {
      frontmatter[key] = value
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean)
    } else {
      frontmatter[key] = value.replace(/^["']|["']$/g, "")
    }
  }
  return { frontmatter, body }
}

async function collectWorkspaceFiles(options?: {
  path?: string
  maxFiles?: number
  extensions?: string[]
  includeHidden?: boolean
}) {
  const root = options?.path ? resolveWorkspacePath(options.path) : getWorkspaceRoot()
  const relRoot = options?.path?.replace(/^\.\//, "") ?? ""
  const maxFiles = Math.min(Math.max(options?.maxFiles ?? 500, 1), 5000)
  const extensions = options?.extensions
    ? new Set(options.extensions.map((ext) => ext.toLowerCase()))
    : null
  const files: Array<{ path: string; abs: string; size: number; modified: string }> = []
  const skipped: Array<{ path: string; reason: string }> = []

  async function visit(absPath: string, relPath: string) {
    if (files.length >= maxFiles) return
    assertWorkspacePathAllowed(absPath)
    const info = await stat(absPath)
    if (info.isDirectory()) {
      const entries = await readdir(absPath, { withFileTypes: true })
      for (const entry of entries) {
        if (files.length >= maxFiles) break
        if (!options?.includeHidden && entry.name.startsWith(".") && entry.name !== ".env") {
          continue
        }
        const childRel = relPath ? `${relPath}/${entry.name}` : entry.name
        if (entry.isDirectory() && isBlockedWorkspaceDirectoryName(entry.name)) {
          skipped.push({ path: childRel, reason: "Protected generated dependency/build directory" })
          continue
        }
        if (entry.isSymbolicLink()) {
          skipped.push({ path: childRel, reason: "Symlink skipped" })
          continue
        }
        await visit(path.join(absPath, entry.name), childRel)
      }
      return
    }
    if (!info.isFile()) return
    const ext = path.extname(absPath).toLowerCase()
    if (extensions && !extensions.has(ext)) return
    files.push({
      path: relPath || path.basename(absPath),
      abs: absPath,
      size: info.size,
      modified: info.mtime.toISOString(),
    })
  }

  await visit(root, relRoot)
  return { files, skipped, truncated: files.length >= maxFiles }
}

function codeSymbolSummary(sourcePath: string, content: string) {
  const project = new Project({ useInMemoryFileSystem: true, skipFileDependencyResolution: true })
  const sourceFile = project.createSourceFile(sourcePath, content, { overwrite: true })
  const functions = sourceFile
    .getFunctions()
    .map((node) => ({ name: node.getName() ?? "(anonymous)", line: node.getStartLineNumber() }))
  const classes = sourceFile
    .getClasses()
    .map((node) => ({ name: node.getName() ?? "(anonymous)", line: node.getStartLineNumber() }))
  const interfaces = sourceFile
    .getInterfaces()
    .map((node) => ({ name: node.getName(), line: node.getStartLineNumber() }))
  const typeAliases = sourceFile
    .getTypeAliases()
    .map((node) => ({ name: node.getName(), line: node.getStartLineNumber() }))
  const variables = sourceFile
    .getVariableDeclarations()
    .map((node) => ({ name: node.getName(), line: node.getStartLineNumber() }))
  return {
    imports: sourceFile.getImportDeclarations().map((decl) => decl.getModuleSpecifierValue()),
    exports: Array.from(sourceFile.getExportedDeclarations().keys()),
    symbols: { functions, classes, interfaces, typeAliases, variables: variables.slice(0, 100) },
  }
}

async function readPackageJson() {
  try {
    return JSON.parse(await readWorkspaceText("package.json")) as Record<string, unknown>
  } catch {
    return null
  }
}

async function runPackageCommand(script: string, timeoutMs = 120000) {
  const pkg = await readPackageJson()
  const scripts =
    pkg?.scripts && typeof pkg.scripts === "object" ? (pkg.scripts as Record<string, string>) : {}
  if (!scripts[script]) throw new Error(`package.json script not found: ${script}`)
  if (!/^[\w:.-]+$/.test(script)) throw new Error("Script name contains unsupported characters")
  return runCommandUnsafe(`npm run ${script}`, getWorkspaceRoot(), timeoutMs)
}

const DEV_SERVERS = new Map<
  string,
  {
    child: ReturnType<typeof spawn>
    startedAt: string
    command: string
    port?: number
    cwd: string
  }
>()

function parseArtifactName(value: string) {
  const cleaned = value.startsWith("/api/artifacts/") ? value.split("/api/artifacts/")[1] : value
  return path.basename(decodeURIComponent(cleaned))
}

export const fileStatTool = tool(
  async ({ path: filePath }) => {
    await ensureWorkspaceDirs()
    const resolved = resolveWorkspacePath(filePath)
    const info = await stat(resolved)
    return {
      type: "file_stat",
      path: filePath,
      kind: info.isDirectory() ? "directory" : info.isFile() ? "file" : "other",
      size: info.size,
      modified: info.mtime.toISOString(),
      created: info.birthtime.toISOString(),
    }
  },
  {
    name: "file_stat",
    description: "Return metadata for a workspace file or directory.",
    schema: z.object({ path: z.string().min(1) }),
  }
)

export const workspaceStatsTool = tool(
  async ({ path: inputPath, maxFiles }) => {
    const { files, skipped, truncated } = await collectWorkspaceFiles({
      path: inputPath,
      maxFiles: maxFiles ?? 2000,
      includeHidden: true,
    })
    const byExtension: Record<string, number> = {}
    let totalBytes = 0
    for (const file of files) {
      totalBytes += file.size
      const ext = path.extname(file.path).toLowerCase() || "(none)"
      byExtension[ext] = (byExtension[ext] ?? 0) + 1
    }
    return {
      type: "workspace_stats",
      path: inputPath ?? ".",
      fileCount: files.length,
      totalBytes,
      byExtension,
      largestFiles: files
        .slice()
        .sort((a, b) => b.size - a.size)
        .slice(0, 25)
        .map(({ path, size }) => ({ path, size })),
      skipped,
      truncated,
    }
  },
  {
    name: "workspace_stats",
    description: "Summarize workspace file counts, sizes, extensions, and largest files.",
    schema: z.object({
      path: z.string().optional(),
      maxFiles: z.number().int().min(1).max(5000).optional(),
    }),
  }
)

export const fileHeadTailTool = tool(
  async ({ path: filePath, head, tail }) => {
    const content = await readWorkspaceText(filePath)
    const lines = content.split(/\r?\n/)
    const headCount = Math.min(Math.max(head ?? 40, 0), 500)
    const tailCount = Math.min(Math.max(tail ?? 40, 0), 500)
    return {
      type: "file_head_tail",
      path: filePath,
      lineCount: lines.length,
      head: lines.slice(0, headCount).map((text, index) => ({ line: index + 1, text })),
      tail: lines
        .slice(Math.max(lines.length - tailCount, 0))
        .map((text, index) => ({ line: Math.max(lines.length - tailCount, 0) + index + 1, text })),
    }
  },
  {
    name: "file_head_tail",
    description: "Read only the beginning and end of a workspace text file.",
    schema: z.object({
      path: z.string().min(1),
      head: z.number().int().min(0).max(500).optional(),
      tail: z.number().int().min(0).max(500).optional(),
    }),
  }
)

export const fileOutlineTool = tool(
  async ({ path: filePath }) => {
    const content = await readWorkspaceText(filePath)
    return { type: "file_outline", path: filePath, ...codeSymbolSummary(filePath, content) }
  },
  {
    name: "file_outline",
    description: "Return imports, exports, and top-level symbols for a TypeScript/JavaScript file.",
    schema: z.object({ path: z.string().min(1) }),
  }
)

export const symbolSearchTool = tool(
  async ({ query, path: inputPath, maxResults }) => {
    const { files, skipped } = await collectWorkspaceFiles({
      path: inputPath,
      maxFiles: 1000,
      extensions: [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"],
    })
    const q = query.toLowerCase()
    const limit = Math.min(Math.max(maxResults ?? 50, 1), 200)
    const results: Array<Record<string, unknown>> = []
    for (const file of files) {
      if (results.length >= limit) break
      const content = await readFile(file.abs, "utf-8").catch(() => "")
      if (!content) continue
      const outline = codeSymbolSummary(file.path, content)
      for (const [kind, values] of Object.entries(outline.symbols)) {
        for (const value of values as Array<{ name: string; line: number }>) {
          if (String(value.name).toLowerCase().includes(q)) {
            results.push({ path: file.path, kind, name: value.name, line: value.line })
            if (results.length >= limit) break
          }
        }
      }
    }
    return { type: "symbol_search", query, results, skipped, truncated: results.length >= limit }
  },
  {
    name: "symbol_search",
    description: "Search TypeScript/JavaScript symbols by name without reading full files.",
    schema: z.object({
      query: z.string().min(1),
      path: z.string().optional(),
      maxResults: z.number().int().min(1).max(200).optional(),
    }),
  }
)

export const symbolReferencesTool = tool(
  async ({ symbol, path: searchPath, maxResults }) => {
    const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const result = (await fileSearchTool.invoke({
      query: `\\b${escaped}\\b`,
      path: searchPath,
      maxResults: maxResults ?? 100,
    })) as Record<string, unknown>
    return { ...result, type: "symbol_references", symbol }
  },
  {
    name: "symbol_references",
    description: "Find textual references to a symbol in workspace files.",
    schema: z.object({
      symbol: z.string().min(1),
      path: z.string().optional(),
      maxResults: z.number().int().min(1).max(1000).optional(),
    }),
  }
)

export const dependencyGraphTool = tool(
  async ({ path: inputPath, maxFiles }) => {
    const { files, skipped, truncated } = await collectWorkspaceFiles({
      path: inputPath,
      maxFiles: maxFiles ?? 250,
      extensions: [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"],
    })
    const nodes = files.map((file) => file.path)
    const nodeSet = new Set(nodes)
    const edges: Array<{ from: string; to: string; specifier: string; external: boolean }> = []
    for (const file of files) {
      const content = await readFile(file.abs, "utf-8").catch(() => "")
      if (!content) continue
      const outline = codeSymbolSummary(file.path, content)
      for (const specifier of outline.imports) {
        const external = !specifier.startsWith(".") && !specifier.startsWith("@/")
        let target = specifier
        if (specifier.startsWith(".")) {
          const joined = path.normalize(path.join(path.dirname(file.path), specifier))
          target =
            nodes.find((candidate) => candidate === joined || candidate.startsWith(`${joined}.`)) ??
            joined
        } else if (specifier.startsWith("@/")) {
          const joined = specifier.replace(/^@\//, "src/")
          target =
            nodes.find((candidate) => candidate === joined || candidate.startsWith(`${joined}.`)) ??
            joined
        }
        edges.push({
          from: file.path,
          to: target,
          specifier,
          external: external || !nodeSet.has(target),
        })
      }
    }
    return {
      type: "dependency_graph",
      path: inputPath ?? ".",
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodes: nodes.slice(0, 300),
      edges: edges.slice(0, 800),
      skipped,
      truncated,
    }
  },
  {
    name: "dependency_graph",
    description: "Build a bounded import dependency graph for JS/TS files.",
    schema: z.object({
      path: z.string().optional(),
      maxFiles: z.number().int().min(1).max(500).optional(),
    }),
  }
)

export const routeMapTool = tool(
  async () => {
    const { files } = await collectWorkspaceFiles({
      maxFiles: 1000,
      extensions: [".ts", ".tsx", ".js", ".jsx"],
      includeHidden: false,
    })
    const routes = files
      .filter((file) =>
        /(^|\/)(page|layout|route|loading|error|template)\.[tj]sx?$/.test(file.path)
      )
      .map((file) => {
        const appMatch = file.path.match(
          /^src\/app\/(.+)\/(page|route|layout|loading|error|template)\.[tj]sx?$/
        )
        const kind = path.basename(file.path).split(".")[0]
        const route = appMatch
          ? `/${appMatch[1]
              .replace(/\([^)]*\)\//g, "")
              .replace(/\/?page$/, "")
              .replace(/\/route$/, "")}`.replace(/\/+/g, "/")
          : null
        return { path: file.path, kind, route: route === "/." ? "/" : route }
      })
    return { type: "route_map", routes }
  },
  {
    name: "route_map",
    description: "Map Next.js app route files to route-like paths.",
    schema: z.object({}),
  }
)

export const testMapTool = tool(
  async () => {
    const { files } = await collectWorkspaceFiles({
      maxFiles: 2000,
      extensions: [".ts", ".tsx", ".js", ".jsx"],
    })
    const tests = files
      .filter((file) => /(^|\/)__tests__\/|[.-](test|spec)\.[tj]sx?$/.test(file.path))
      .map((file) => ({ path: file.path, size: file.size }))
    return {
      type: "test_map",
      testCount: tests.length,
      tests,
      scripts: ((await readPackageJson())?.scripts as Record<string, string> | undefined) ?? {},
    }
  },
  {
    name: "test_map",
    description: "List test files and package test scripts.",
    schema: z.object({}),
  }
)

export const configInventoryTool = tool(
  async () => {
    const configPattern =
      /(^|\/)(package\.json|tsconfig.*\.json|next\.config\.[cm]?[tj]s|vite\.config\.[cm]?[tj]s|vitest\.config\.[cm]?[tj]s|tailwind\.config\.[cm]?[tj]s|postcss\.config\.[cm]?[tj]s|eslint\.config\.[cm]?[tj]s|\.prettierrc.*|components\.json)$/
    const { files } = await collectWorkspaceFiles({ maxFiles: 2000, includeHidden: true })
    return {
      type: "config_inventory",
      configs: files
        .filter((file) => configPattern.test(file.path))
        .map(({ path, size, modified }) => ({ path, size, modified })),
    }
  },
  {
    name: "config_inventory",
    description: "List common project configuration files.",
    schema: z.object({}),
  }
)

export const envInventoryTool = tool(
  async () => {
    const { files } = await collectWorkspaceFiles({ maxFiles: 200, includeHidden: true })
    const envFiles = files.filter((file) => /(^|\/)\.env($|\.)/.test(file.path))
    const entries = await Promise.all(
      envFiles.map(async (file) => {
        const content = await readFile(file.abs, "utf-8").catch(() => "")
        return {
          path: file.path,
          keys: content
            .split(/\r?\n/)
            .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1])
            .filter(Boolean),
        }
      })
    )
    return { type: "env_inventory", files: entries }
  },
  {
    name: "env_inventory",
    description: "List .env files and variable names only; never returns secret values.",
    schema: z.object({}),
  }
)

export const lockfileSummaryTool = tool(
  async () => {
    const lockfiles = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb"]
    const found = []
    for (const file of lockfiles) {
      const resolved = path.join(getWorkspaceRoot(), file)
      if (!(await fileExists(resolved))) continue
      const info = await stat(resolved)
      let packageCount: number | undefined
      if (file === "package-lock.json") {
        const parsed = JSON.parse(await readFile(resolved, "utf-8")) as { packages?: object }
        packageCount = Object.keys(parsed.packages ?? {}).length
      }
      found.push({ path: file, size: info.size, modified: info.mtime.toISOString(), packageCount })
    }
    return { type: "lockfile_summary", lockfiles: found }
  },
  { name: "lockfile_summary", description: "Summarize dependency lockfiles.", schema: z.object({}) }
)

export const duplicateCodeCandidatesTool = tool(
  async ({ minBytes }) => {
    const { files } = await collectWorkspaceFiles({
      maxFiles: 2000,
      extensions: [".ts", ".tsx", ".js", ".jsx", ".css", ".md"],
    })
    const groups = new Map<string, Array<{ path: string; size: number }>>()
    for (const file of files) {
      if (file.size < (minBytes ?? 80)) continue
      const content = await readFile(file.abs, "utf-8").catch(() => "")
      const normalized = content.replace(/\s+/g, " ").trim()
      if (!normalized) continue
      const hash = crypto.createHash("sha1").update(normalized).digest("hex")
      groups.set(hash, [...(groups.get(hash) ?? []), { path: file.path, size: file.size }])
    }
    return {
      type: "duplicate_code_candidates",
      groups: Array.from(groups.entries())
        .filter(([, entries]) => entries.length > 1)
        .map(([hash, entries]) => ({ hash, entries }))
        .slice(0, 50),
    }
  },
  {
    name: "duplicate_code_candidates",
    description: "Find exact normalized duplicate text/code files as refactor candidates.",
    schema: z.object({ minBytes: z.number().int().min(1).max(10000).optional() }),
  }
)

export const deadCodeCandidatesTool = tool(
  async ({ path: inputPath }) => {
    const { files } = await collectWorkspaceFiles({
      path: inputPath,
      maxFiles: 1000,
      extensions: [".ts", ".tsx", ".js", ".jsx"],
    })
    const contents = await Promise.all(
      files.map(async (file) => ({
        file,
        content: await readFile(file.abs, "utf-8").catch(() => ""),
      }))
    )
    const allText = contents.map((entry) => entry.content).join("\n")
    const candidates: Array<Record<string, unknown>> = []
    for (const { file, content } of contents) {
      if (!content) continue
      const outline = codeSymbolSummary(file.path, content)
      for (const exported of outline.exports) {
        const count = (
          allText.match(
            new RegExp(`\\b${exported.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g")
          ) ?? []
        ).length
        if (count <= 1)
          candidates.push({ path: file.path, export: exported, referenceCount: count })
      }
    }
    return { type: "dead_code_candidates", candidates: candidates.slice(0, 100) }
  },
  {
    name: "dead_code_candidates",
    description: "Best-effort exported symbol list with few/no textual references.",
    schema: z.object({ path: z.string().optional() }),
  }
)

/**
 * Searches the public web for current information and source candidates.
 */
export const webSearchTool = tool(
  async ({ query, maxResults, domains, excludeDomains }) => {
    return await searchPublicWeb(query, {
      maxResults,
      domains,
      excludeDomains,
    })
  },
  {
    name: "web_search",
    description: "Search the public web for answers and recent information.",
    schema: z.object({
      query: z.string(),
      maxResults: z.number().int().min(1).max(25).default(10),
      domains: z.array(z.string()).optional(),
      excludeDomains: z.array(z.string()).optional(),
    }),
  }
)

/**
 * Fetches a web page and converts its readable article content into Markdown.
 */
export const visitUrlTool = tool(
  async ({ url }) => {
    const response = await fetch(url, { headers: { "User-Agent": "Rekdin/NextJS" } })
    if (!response.ok) return { url, error: `Failed to fetch (${response.status})` }
    const html = await response.text()
    const dom = new JSDOM(html, { url })
    const reader = new Readability(dom.window.document)
    const article = reader.parse()
    const markdown = article?.content ? turndown.turndown(article.content) : turndown.turndown(html)
    return {
      url,
      title: article?.title ?? dom.window.document.title ?? "Untitled",
      excerpt: article?.excerpt ?? "",
      markdown,
      type: "visit_link",
    }
  },
  {
    name: "visit_link",
    description: "Fetch and summarize the readable content from a web page.",
    schema: z.object({ url: z.string().url() }),
  }
)

/**
 * Navigates the session browser to a URL and returns load metadata for the timeline.
 */
export const browserNavigateTool = tool(
  async ({ url }) => {
    const steps: Array<Record<string, unknown>> = []
    const result = await withPage(async (page) => {
      const started = Date.now()
      steps.push({ label: "Start", detail: `Navigating to ${url}`, at: new Date().toISOString() })
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 })
      const title = await page.title()
      steps.push({
        label: "Loaded",
        detail: `DOM content loaded (status ${response?.status() ?? "n/a"})`,
        at: new Date().toISOString(),
      })
      return {
        url: page.url(),
        status: response?.status() ?? null,
        title,
        duration: Date.now() - started,
        type: "browser_navigate",
        steps,
      }
    })
    return result
  },
  {
    name: "browser_navigate",
    description: "Navigate a headless browser to a URL.",
    schema: z.object({ url: z.string().url() }),
  }
)

/**
 * Loads a page in the browser and extracts readable Markdown from the rendered DOM.
 */
export const browserGetMarkdownTool = tool(
  async ({ url, pageNumber }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      const steps: Array<Record<string, unknown>> = []
      steps.push({ label: "Start", detail: `Loading ${url}`, at: new Date().toISOString() })
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 })
      steps.push({
        label: "Loaded",
        detail: "DOM ready, extracting readable content",
        at: new Date().toISOString(),
      })
      const html = await page.content()
      const dom = new JSDOM(html, { url })
      const reader = new Readability(dom.window.document)
      const article = reader.parse()
      const markdown = article?.content
        ? turndown.turndown(article.content)
        : turndown.turndown(html)
      const content = markdown
      return {
        url: page.url(),
        title: article?.title ?? dom.window.document.title ?? "Untitled",
        markdown: content,
        type: "browser_get_markdown",
        duration: Date.now() - started,
        pageNumber: pageNumber ?? 1,
        steps,
      }
    })
  },
  {
    name: "browser_get_markdown",
    description: "Get readable markdown from the current page.",
    schema: z.object({ url: z.string().url(), pageNumber: z.number().int().optional() }),
  }
)

/**
 * Captures a viewport screenshot after a page reaches network idle.
 */
export const browserScreenshotTool = tool(
  async ({ url }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      const steps: Array<Record<string, unknown>> = []
      steps.push({ label: "Start", detail: `Loading ${url}`, at: new Date().toISOString() })
      await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 })
      steps.push({
        label: "Loaded",
        detail: "Network idle, capturing screenshot",
        at: new Date().toISOString(),
      })
      const screenshot = await screenshotDataUrl(page, false)
      const title = await page.title()
      return {
        url: page.url(),
        title,
        screenshot,
        type: "browser_screenshot",
        duration: Date.now() - started,
        steps,
      }
    })
  },
  {
    name: "browser_screenshot",
    description: "Capture a viewport screenshot of a page.",
    schema: z.object({ url: z.string().url() }),
  }
)

/**
 * Clicks a page element by CSS selector or coordinates and returns a screenshot.
 */
export const browserClickTool = tool(
  async ({ url, selector, x, y, button, clickCount }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      await goto(page, url, "domcontentloaded")
      let clickX = typeof x === "number" ? x : null
      let clickY = typeof y === "number" ? y : null
      if ((!clickX || !clickY) && selector) {
        const center = await centerOfSelector(page, selector)
        clickX = center?.x ?? null
        clickY = center?.y ?? null
      }
      if (typeof clickX === "number" && typeof clickY === "number") {
        await page.mouse.click(clickX, clickY, {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          button: (button ?? "left") as any,
          clickCount: clickCount ?? 1,
        })
      } else if (selector) {
        await page.click(selector, {
          clickCount: clickCount ?? 1,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          button: (button ?? "left") as any,
        })
      }
      const shot = await screenshotDataUrl(page, true)
      return {
        url: page.url(),
        title: await page.title(),
        screenshot: shot,
        x: clickX,
        y: clickY,
        status: "success",
        type: "browser_click",
        duration: Date.now() - started,
      }
    })
  },
  {
    name: "browser_click",
    description: "Click an element in a headless browser using a selector or coordinates.",
    schema: z.object({
      url: z.string().url(),
      selector: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      button: z.enum(["left", "right", "middle"]).optional(),
      clickCount: z.number().int().min(1).max(3).optional(),
    }),
  }
)

/**
 * Compatibility wrapper that performs a double click through the standard click tool.
 */
export const browserDoubleClickTool = tool(
  async (args) => {
    return await browserClickTool.invoke({ ...args, clickCount: 2 })
  },
  {
    name: "browser_double_click",
    description: "Double click an element in a headless browser.",
    schema: z.object({
      url: z.string().url(),
      selector: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
    }),
  }
)

/**
 * Compatibility wrapper that performs a right click through the standard click tool.
 */
export const browserRightClickTool = tool(
  async (args) => {
    return await browserClickTool.invoke({ ...args, button: "right", clickCount: 1 })
  },
  {
    name: "browser_right_click",
    description: "Right click an element in a headless browser.",
    schema: z.object({
      url: z.string().url(),
      selector: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
    }),
  }
)

/**
 * Moves the browser pointer over a selector or coordinate and captures the page state.
 */
export const browserHoverTool = tool(
  async ({ url, selector, x, y }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      await goto(page, url, "domcontentloaded")
      let hoverX = typeof x === "number" ? x : null
      let hoverY = typeof y === "number" ? y : null
      if ((!hoverX || !hoverY) && selector) {
        const center = await centerOfSelector(page, selector)
        hoverX = center?.x ?? null
        hoverY = center?.y ?? null
      }
      if (typeof hoverX === "number" && typeof hoverY === "number") {
        await page.mouse.move(hoverX, hoverY)
      } else if (selector) {
        await page.hover(selector)
      }
      const shot = await screenshotDataUrl(page, true)
      return {
        url: page.url(),
        title: await page.title(),
        screenshot: shot,
        x: hoverX,
        y: hoverY,
        status: "success",
        type: "browser_hover",
        duration: Date.now() - started,
      }
    })
  },
  {
    name: "browser_hover",
    description: "Hover an element in a headless browser using a selector or coordinates.",
    schema: z.object({
      url: z.string().url(),
      selector: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
    }),
  }
)

/**
 * Scrolls the session browser by wheel deltas and captures the resulting page state.
 */
export const browserScrollTool = tool(
  async ({ url, deltaY, deltaX }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      await goto(page, url, "domcontentloaded")
      await page.mouse.wheel({ deltaY: deltaY ?? 800, deltaX: deltaX ?? 0 })
      const shot = await screenshotDataUrl(page, true)
      return {
        url: page.url(),
        title: await page.title(),
        screenshot: shot,
        action: "scroll",
        status: "success",
        type: "browser_scroll",
        duration: Date.now() - started,
      }
    })
  },
  {
    name: "browser_scroll",
    description: "Scroll the page in a headless browser.",
    schema: z.object({
      url: z.string().url(),
      deltaY: z.number().optional(),
      deltaX: z.number().optional(),
    }),
  }
)

/**
 * Types text into a browser input, optionally clearing the field first.
 */
export const browserTypeTool = tool(
  async ({ url, selector, text, clear }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      await goto(page, url, "domcontentloaded")
      if (clear) {
        await page.focus(selector)
        await page.keyboard.down(os.platform() === "darwin" ? "Meta" : "Control")
        await page.keyboard.press("A")
        await page.keyboard.up(os.platform() === "darwin" ? "Meta" : "Control")
        await page.keyboard.press("Backspace")
      }
      await page.type(selector, text, { delay: 10 })
      const shot = await screenshotDataUrl(page, true)
      return {
        url: page.url(),
        title: await page.title(),
        screenshot: shot,
        status: "success",
        type: "browser_type",
        duration: Date.now() - started,
      }
    })
  },
  {
    name: "browser_type",
    description: "Type into an input element in a headless browser.",
    schema: z.object({
      url: z.string().url(),
      selector: z.string().min(1),
      text: z.string(),
      clear: z.boolean().optional(),
    }),
  }
)

/**
 * Fills one form field by delegating to the browser typing tool.
 */
export const browserFormFillTool = tool(
  async ({ url, selector, value, clear }) => {
    return await browserTypeTool.invoke({ url, selector, text: value, clear })
  },
  {
    name: "browser_form_input_fill",
    description: "Fill a form input in a headless browser.",
    schema: z.object({
      url: z.string().url(),
      selector: z.string().min(1),
      value: z.string(),
      clear: z.boolean().optional(),
    }),
  }
)

/**
 * Fills several form fields on one page visit and returns a screenshot of the result.
 */
export const browserFormFillBatchTool = tool(
  async ({ url, fields }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      await goto(page, url, "domcontentloaded")
      for (const field of fields) {
        if (field.clear) {
          await page.focus(field.selector)
          await page.keyboard.down(os.platform() === "darwin" ? "Meta" : "Control")
          await page.keyboard.press("A")
          await page.keyboard.up(os.platform() === "darwin" ? "Meta" : "Control")
          await page.keyboard.press("Backspace")
        }
        await page.type(field.selector, field.value, { delay: 10 })
      }
      const shot = await screenshotDataUrl(page, true)
      return {
        url: page.url(),
        title: await page.title(),
        screenshot: shot,
        filled: fields.map((f) => f.selector),
        status: "success",
        type: "browser_form_fill_batch",
        duration: Date.now() - started,
      }
    })
  },
  {
    name: "browser_form_fill_batch",
    description: "Fill multiple form fields on a page (best-effort).",
    schema: z.object({
      url: z.string().url(),
      fields: z
        .array(
          z.object({
            selector: z.string().min(1),
            value: z.string(),
            clear: z.boolean().optional(),
          })
        )
        .min(1),
    }),
  }
)

/**
 * Waits for a fixed delay after loading a page and captures the current state.
 */
export const browserWaitTool = tool(
  async ({ url, duration, condition }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      await goto(page, url, "domcontentloaded")
      if (typeof duration === "number") {
        await new Promise((r) => setTimeout(r, duration * 1000))
      }
      const shot = await screenshotDataUrl(page, true)
      return {
        url: page.url(),
        title: await page.title(),
        screenshot: shot,
        condition: condition ?? null,
        status: "success",
        type: "browser_wait",
        duration: Date.now() - started,
      }
    })
  },
  {
    name: "browser_wait",
    description: "Wait for some time after loading a page (simple delay).",
    schema: z.object({
      url: z.string().url(),
      duration: z.number().optional(),
      condition: z.string().optional(),
    }),
  }
)

/**
 * Waits for a selector or page function to become true before capturing the state.
 */
export const browserWaitForTool = tool(
  async ({ url, selector, script, timeoutMs }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      await goto(page, url, "domcontentloaded")
      try {
        if (selector) {
          await page.waitForSelector(selector, { timeout: timeoutMs ?? 15000 })
        } else if (script) {
          await page.waitForFunction(script, { timeout: timeoutMs ?? 15000 })
        } else {
          throw new Error("Provide `selector` or `script`")
        }
      } catch (err) {
        const shot = await screenshotDataUrl(page, true)
        return {
          url: page.url(),
          title: await page.title(),
          screenshot: shot,
          status: "timeout",
          waitedFor: selector ?? "function",
          error: err instanceof Error ? err.message : "Wait failed",
          type: "browser_wait_for",
          duration: Date.now() - started,
        }
      }
      const shot = await screenshotDataUrl(page, true)
      return {
        url: page.url(),
        title: await page.title(),
        screenshot: shot,
        status: "success",
        waitedFor: selector ?? "function",
        type: "browser_wait_for",
        duration: Date.now() - started,
      }
    })
  },
  {
    name: "browser_wait_for",
    description: "Wait for a selector or page function to succeed, then capture a screenshot.",
    schema: z
      .object({
        url: z.string().url(),
        selector: z.string().optional(),
        script: z.string().optional(),
        timeoutMs: z.number().int().min(1000).max(60000).optional(),
      })
      .refine((v) => v.selector || v.script, { message: "Provide selector or script" }),
  }
)

/**
 * Extracts text or an attribute from a selected element in the rendered page.
 */
export const browserExtractTool = tool(
  async ({ url, selector, attribute }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      await goto(page, url, "domcontentloaded")
      const extractedData = await page.$eval(
        selector,
        (el, attr) => {
          if (!attr) return (el as HTMLElement).innerText || (el as HTMLElement).textContent || ""
          return (el as HTMLElement).getAttribute(attr) || ""
        },
        attribute ?? null
      )
      const shot = await screenshotDataUrl(page, true)
      return {
        url: page.url(),
        title: await page.title(),
        screenshot: shot,
        extractedData,
        status: "success",
        type: "browser_extract",
        duration: Date.now() - started,
      }
    })
  },
  {
    name: "browser_extract",
    description: "Extract text or an attribute from a CSS selector on a page.",
    schema: z.object({
      url: z.string().url(),
      selector: z.string().min(1),
      attribute: z.string().optional(),
    }),
  }
)

/**
 * Extracts text from the whole page or from a specific selector.
 */
export const browserGetTextTool = tool(
  async ({ url, selector }) => {
    return await browserExtractTool.invoke({ url, selector: selector ?? "body" })
  },
  {
    name: "browser_get_text",
    description: "Extract readable text from the page (or a selector).",
    schema: z.object({
      url: z.string().url(),
      selector: z.string().optional(),
    }),
  }
)

/**
 * Lists links from the rendered page for navigation and extraction workflows.
 */
export const browserGetLinksTool = tool(
  async ({ url }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      await goto(page, url, "domcontentloaded")
      const extractedData = await page.$$eval("a[href]", (anchors) =>
        anchors
          .map((a) => ({
            text: (a as HTMLAnchorElement).innerText?.trim() ?? "",
            href: (a as HTMLAnchorElement).href,
          }))
          .filter((a) => a.href)
          .slice(0, 200)
      )
      const shot = await screenshotDataUrl(page, true)
      return {
        url: page.url(),
        title: await page.title(),
        screenshot: shot,
        extractedData,
        status: "success",
        type: "browser_get_links",
        duration: Date.now() - started,
      }
    })
  },
  {
    name: "browser_get_links",
    description: "Extract links from a page.",
    schema: z.object({ url: z.string().url() }),
  }
)

/**
 * Lists likely clickable elements so the model can choose stable interaction targets.
 */
export const browserGetClickableElementsTool = tool(
  async ({ url }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      await goto(page, url, "domcontentloaded")
      const extractedData = await page.$$eval(
        "a[href],button,[role='button'],input[type='button'],input[type='submit']",
        (els) =>
          els
            .map((el) => {
              const tag = (el as HTMLElement).tagName.toLowerCase()
              const text =
                (el as HTMLElement).innerText?.trim() ||
                (el as HTMLInputElement).value?.trim() ||
                ""
              const href = (el as HTMLAnchorElement).href || ""
              const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : ""
              const cls = (el as HTMLElement).className
                ? `.${String((el as HTMLElement).className)
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .join(".")}`
                : ""
              const selector = id || cls || tag
              return { tag, text, href, selector }
            })
            .filter((x) => x.text || x.href)
            .slice(0, 200)
      )
      const shot = await screenshotDataUrl(page, true)
      return {
        url: page.url(),
        title: await page.title(),
        screenshot: shot,
        extractedData,
        status: "success",
        type: "browser_get_clickable_elements",
        duration: Date.now() - started,
      }
    })
  },
  {
    name: "browser_get_clickable_elements",
    description: "List clickable elements on a page (best-effort).",
    schema: z.object({ url: z.string().url() }),
  }
)

/**
 * Drags from a source selector to a target selector using pointer coordinates.
 */
export const browserDragAndDropTool = tool(
  async ({ url, sourceSelector, targetSelector }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      await goto(page, url, "domcontentloaded")
      const src = await centerOfSelector(page, sourceSelector)
      const tgt = await centerOfSelector(page, targetSelector)
      if (src && tgt) {
        await page.mouse.move(src.x, src.y)
        await page.mouse.down()
        await page.mouse.move(tgt.x, tgt.y, { steps: 15 })
        await page.mouse.up()
      }
      const shot = await screenshotDataUrl(page, true)
      return {
        url: page.url(),
        title: await page.title(),
        screenshot: shot,
        sourceX: src?.x ?? null,
        sourceY: src?.y ?? null,
        targetX: tgt?.x ?? null,
        targetY: tgt?.y ?? null,
        status: "success",
        type: "browser_drag_and_drop",
        duration: Date.now() - started,
      }
    })
  },
  {
    name: "browser_drag_and_drop",
    description: "Drag from a source selector to a target selector.",
    schema: z.object({
      url: z.string().url(),
      sourceSelector: z.string().min(1),
      targetSelector: z.string().min(1),
    }),
  }
)

/**
 * Alias for drag-and-drop interactions used by older tool policies/renderers.
 */
export const browserDragTool = tool(
  async ({ url, sourceSelector, targetSelector }) => {
    return await browserDragAndDropTool.invoke({ url, sourceSelector, targetSelector })
  },
  {
    name: "browser_drag",
    description: "Drag from source to target (alias).",
    schema: z.object({
      url: z.string().url(),
      sourceSelector: z.string().min(1),
      targetSelector: z.string().min(1),
    }),
  }
)

/**
 * Sends a single keyboard key press to the active browser page.
 */
export const browserKeyPressTool = tool(
  async ({ url, key }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      await goto(page, url, "domcontentloaded")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.keyboard.press(key as any)
      const shot = await screenshotDataUrl(page, true)
      return {
        url: page.url(),
        title: await page.title(),
        screenshot: shot,
        action: `key_press:${key}`,
        status: "success",
        type: "browser_key_press",
        duration: Date.now() - started,
      }
    })
  },
  {
    name: "browser_key_press",
    description: "Press a key on the page.",
    schema: z.object({ url: z.string().url(), key: z.string().min(1) }),
  }
)

/**
 * Sends a multi-key browser shortcut such as Ctrl+K or Meta+A.
 */
export const browserHotkeyTool = tool(
  async ({ url, keys }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      await goto(page, url, "domcontentloaded")
      for (const key of keys) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await page.keyboard.down(key as any)
      }
      for (const key of [...keys].reverse()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await page.keyboard.up(key as any)
      }
      const shot = await screenshotDataUrl(page, true)
      return {
        url: page.url(),
        title: await page.title(),
        screenshot: shot,
        action: `hotkey:${keys.join("+")}`,
        status: "success",
        type: "browser_hotkey",
        duration: Date.now() - started,
      }
    })
  },
  {
    name: "browser_hotkey",
    description: "Trigger a keyboard shortcut (best-effort).",
    schema: z.object({ url: z.string().url(), keys: z.array(z.string().min(1)).min(1).max(5) }),
  }
)

/**
 * Evaluates JavaScript inside the current browser page and captures the page state.
 */
export const browserEvaluateTool = tool(
  async ({ url, script }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      await goto(page, url, "domcontentloaded")
      const result = await page.evaluate(script)
      const shot = await screenshotDataUrl(page, true)
      return {
        url: page.url(),
        title: await page.title(),
        screenshot: shot,
        result,
        status: "success",
        type: "browser_evaluate",
        duration: Date.now() - started,
      }
    })
  },
  {
    name: "browser_evaluate",
    description: "Run JavaScript in the browser page and return the result.",
    schema: z.object({ url: z.string().url(), script: z.string().min(1) }),
  }
)

export const browserAccessibilitySnapshotTool = tool(
  async ({ url }) => {
    return await withPage(async (page) => {
      await goto(page, url, "domcontentloaded")
      const snapshot = await page.accessibility.snapshot({ interestingOnly: true })
      return {
        type: "browser_accessibility_snapshot",
        url: page.url(),
        title: await page.title(),
        snapshot,
      }
    })
  },
  {
    name: "browser_accessibility_snapshot",
    description: "Return Puppeteer accessibility tree snapshot for a page.",
    schema: z.object({ url: z.string().url() }),
  }
)

export const browserConsoleLogsTool = tool(
  async ({ url, waitMs }) => {
    return await withPage(async (page) => {
      const logs: Array<{ type: string; text: string }> = []
      const handler = (msg: { type: () => string; text: () => string }) => {
        logs.push({ type: msg.type(), text: truncateString(msg.text(), 1000) })
      }
      page.on("console", handler)
      try {
        await goto(page, url, "domcontentloaded")
        if (waitMs) await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, 10000)))
        return {
          type: "browser_console_logs",
          url: page.url(),
          title: await page.title(),
          logs: logs.slice(0, 200),
        }
      } finally {
        page.off("console", handler)
      }
    })
  },
  {
    name: "browser_console_logs",
    description: "Load a page and capture browser console logs.",
    schema: z.object({
      url: z.string().url(),
      waitMs: z.number().int().min(0).max(10000).optional(),
    }),
  }
)

export const browserNetworkLogTool = tool(
  async ({ url, waitMs }) => {
    return await withPage(async (page) => {
      const requests: Array<Record<string, unknown>> = []
      const onResponse = (res: {
        url: () => string
        status: () => number
        request: () => { method: () => string; resourceType: () => string }
      }) => {
        requests.push({
          url: res.url(),
          status: res.status(),
          method: res.request().method(),
          resourceType: res.request().resourceType(),
        })
      }
      page.on("response", onResponse)
      try {
        await goto(page, url, "domcontentloaded")
        if (waitMs) await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, 10000)))
        return {
          type: "browser_network_log",
          url: page.url(),
          title: await page.title(),
          requests: requests.slice(0, 300),
        }
      } finally {
        page.off("response", onResponse)
      }
    })
  },
  {
    name: "browser_network_log",
    description: "Load a page and capture response status metadata.",
    schema: z.object({
      url: z.string().url(),
      waitMs: z.number().int().min(0).max(10000).optional(),
    }),
  }
)

export const browserStorageSnapshotTool = tool(
  async ({ url }) => {
    return await withPage(async (page) => {
      await goto(page, url, "domcontentloaded")
      const cookies = await page.cookies()
      const storage = await page.evaluate(() => ({
        localStorage: Object.keys(window.localStorage),
        sessionStorage: Object.keys(window.sessionStorage),
      }))
      return {
        type: "browser_storage_snapshot",
        url: page.url(),
        title: await page.title(),
        cookies: cookies.map((cookie) => ({
          name: cookie.name,
          domain: cookie.domain,
          path: cookie.path,
          expires: cookie.expires,
        })),
        storage,
      }
    })
  },
  {
    name: "browser_storage_snapshot",
    description: "Read cookie metadata and storage keys for a page, without values.",
    schema: z.object({ url: z.string().url() }),
  }
)

export const browserSetViewportTool = tool(
  async ({ url, width, height, deviceScaleFactor }) => {
    return await withPage(async (page) => {
      await page.setViewport({ width, height, deviceScaleFactor: deviceScaleFactor ?? 1 })
      await goto(page, url, "domcontentloaded")
      const screenshot = await screenshotDataUrl(page, true)
      return {
        type: "browser_set_viewport",
        url: page.url(),
        title: await page.title(),
        width,
        height,
        screenshot,
      }
    })
  },
  {
    name: "browser_set_viewport",
    description: "Set browser viewport dimensions and capture the page.",
    schema: z.object({
      url: z.string().url(),
      width: z.number().int().min(100).max(3840),
      height: z.number().int().min(100).max(3840),
      deviceScaleFactor: z.number().min(0.1).max(4).optional(),
    }),
  }
)

export const browserSelectorScreenshotTool = tool(
  async ({ url, selector }) => {
    return await withPage(async (page) => {
      await goto(page, url, "domcontentloaded")
      const element = await page.$(selector)
      if (!element) throw new Error(`Selector not found: ${selector}`)
      const shot = (await element.screenshot({ encoding: "binary" })) as Buffer
      const artifact = await storeArtifact({
        filename: "selector-screenshot.png",
        bytes: shot,
        mimeType: "image/png",
      })
      return {
        type: "browser_selector_screenshot",
        url: page.url(),
        title: await page.title(),
        selector,
        screenshot: artifact.url,
        artifact,
      }
    })
  },
  {
    name: "browser_selector_screenshot",
    description: "Capture a screenshot of a specific page element.",
    schema: z.object({ url: z.string().url(), selector: z.string().min(1) }),
  }
)

export const browserFullPageScreenshotTool = tool(
  async ({ url }) => {
    return await withTemporaryPage(async (page) => {
      await goto(page, url, "networkidle0")
      const artifact = await screenshotArtifact(page, true, "full-page-screenshot.png")
      return {
        type: "browser_full_page_screenshot",
        url: page.url(),
        title: await page.title(),
        screenshot: artifact.url,
        artifact,
      }
    })
  },
  {
    name: "browser_full_page_screenshot",
    description: "Capture a full-page browser screenshot.",
    schema: z.object({ url: z.string().url() }),
  }
)

export const browserPrintPdfTool = tool(
  async ({ url, filename }) => {
    return await withPage(async (page) => {
      await goto(page, url, "networkidle0")
      const pdf = Buffer.from(await page.pdf({ format: "A4", printBackground: true }))
      const artifact = await storeArtifact({
        filename: filename ?? "browser-page.pdf",
        bytes: pdf,
        mimeType: "application/pdf",
      })
      return {
        type: "browser_print_pdf",
        url: page.url(),
        title: await page.title(),
        artifact,
        artifactUrl: artifact.url,
      }
    })
  },
  {
    name: "browser_print_pdf",
    description: "Print a web page to PDF artifact.",
    schema: z.object({ url: z.string().url(), filename: z.string().optional() }),
  }
)

export const browserDownloadsTool = tool(
  async ({ url, selector, waitMs, maxBytes }) => {
    const downloadDir = await mkdtemp(path.join(os.tmpdir(), "rekdin-browser-downloads-"))
    try {
      return await withPage(async (page) => {
        const client = await page.target().createCDPSession()
        await client.send("Page.setDownloadBehavior", {
          behavior: "allow",
          downloadPath: downloadDir,
        })

        await goto(page, url, "domcontentloaded")
        if (selector) {
          await page.click(selector)
        }
        await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs ?? 5000, 20000)))

        const entries = await readdir(downloadDir, { withFileTypes: true }).catch(() => [])
        const files = []
        const pending = []
        for (const entry of entries) {
          if (!entry.isFile()) continue
          const filePath = path.join(downloadDir, entry.name)
          const info = await stat(filePath)
          if (entry.name.endsWith(".crdownload")) {
            pending.push({ name: entry.name, size: info.size })
            continue
          }

          const limit = maxBytes ?? 15_000_000
          if (info.size > limit) {
            files.push({
              name: entry.name,
              size: info.size,
              stored: false,
              omittedReason: `File exceeds maxBytes (${limit}).`,
            })
            continue
          }

          const bytes = await readFile(filePath)
          const artifact = await storeArtifact({
            filename: entry.name,
            bytes,
            mimeType: "application/octet-stream",
          })
          files.push({ name: entry.name, size: info.size, stored: true, artifact })
        }

        return {
          type: "browser_downloads",
          url: page.url(),
          title: await page.title(),
          selector: selector ?? null,
          files,
          pending,
        }
      })
    } finally {
      await rm(downloadDir, { recursive: true, force: true })
    }
  },
  {
    name: "browser_downloads",
    description: "Capture browser-triggered downloads as bounded Rekdin artifacts.",
    schema: z.object({
      url: z.string().url(),
      selector: z.string().min(1).optional(),
      waitMs: z.number().int().min(0).max(20000).optional(),
      maxBytes: z.number().int().min(1024).max(50_000_000).optional(),
    }),
  }
)

export const browserFormSchemaTool = tool(
  async ({ url }) => {
    return await withPage(async (page) => {
      await goto(page, url, "domcontentloaded")
      const forms = await page.$$eval("form", (formEls) =>
        formEls.map((form, formIndex) => ({
          index: formIndex,
          action: (form as HTMLFormElement).action,
          method: (form as HTMLFormElement).method,
          fields: Array.from(form.querySelectorAll("input, textarea, select")).map((field) => {
            const el = field as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
            return {
              tag: el.tagName.toLowerCase(),
              name: el.getAttribute("name"),
              id: el.id,
              type: (el as HTMLInputElement).type,
              placeholder: el.getAttribute("placeholder"),
              required: el.hasAttribute("required"),
            }
          }),
        }))
      )
      return { type: "browser_form_schema", url: page.url(), title: await page.title(), forms }
    })
  },
  {
    name: "browser_form_schema",
    description: "Extract forms and field metadata from a page.",
    schema: z.object({ url: z.string().url() }),
  }
)

export const browserTableExtractTool = tool(
  async ({ url }) => {
    return await withPage(async (page) => {
      await goto(page, url, "domcontentloaded")
      const tables = await page.$$eval("table", (tableEls) =>
        tableEls.slice(0, 20).map((table, index) => ({
          index,
          rows: Array.from(table.querySelectorAll("tr"))
            .slice(0, 200)
            .map((row) =>
              Array.from(row.querySelectorAll("th,td")).map((cell) =>
                (cell.textContent ?? "").trim()
              )
            ),
        }))
      )
      return { type: "browser_table_extract", url: page.url(), title: await page.title(), tables }
    })
  },
  {
    name: "browser_table_extract",
    description: "Extract HTML tables from a rendered page.",
    schema: z.object({ url: z.string().url() }),
  }
)

/**
 * Searches workspace files with ripgrep, falling back to grep when rg is unavailable.
 */
export const fileSearchTool = tool(
  async ({ query, path: searchPath, maxResults }) => {
    await ensureWorkspaceDirs()
    if (searchPath) resolveWorkspacePath(searchPath)
    const escapedQuery = query.replace(/'/g, "'\"'\"'")
    const targetPath = searchPath ? searchPath.replace(/'/g, "'\"'\"'") : "."
    const limit = Math.min(Math.max(maxResults ?? 200, 1), 1000)
    const searchTargetsProtectedDirectory =
      Boolean(searchPath && findBlockedWorkspacePathSegment(searchPath)) &&
      protectedWorkspaceAccessAllowed()
    const rgExcludes = searchTargetsProtectedDirectory
      ? ""
      : BLOCKED_WORKSPACE_DIRECTORIES.flatMap((directoryName) => [
          `--glob '!${directoryName}/**'`,
          `--glob '!**/${directoryName}/**'`,
        ]).join(" ")
    const grepExcludes = searchTargetsProtectedDirectory
      ? ""
      : BLOCKED_WORKSPACE_DIRECTORIES.map(
          (directoryName) => `--exclude-dir='${directoryName}'`
        ).join(" ")
    let res = await runCommand(
      `rg ${rgExcludes} --line-number --no-heading --color=never -m ${limit} '${escapedQuery}' '${targetPath}'`,
      undefined,
      20000
    )
    // Fall back to grep when rg is not installed (exit code 127 = command not found)
    if (res.exitCode === 127) {
      res = await runCommand(
        `grep -rn ${grepExcludes} --color=never -m ${limit} '${escapedQuery}' '${targetPath}'`,
        undefined,
        20000
      )
    }
    if (res.exitCode !== 0 && res.stdout.trim().length === 0) {
      return {
        type: "file_search",
        query,
        path: searchPath ?? ".",
        matches: [],
        exitCode: res.exitCode,
        error: res.stderr.trim() || "Search failed. Check that the path and pattern are valid.",
      }
    }
    const matches = res.stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const firstColon = line.indexOf(":")
        const secondColon = line.indexOf(":", firstColon + 1)
        const file = line.slice(0, firstColon)
        const lineNumber = Number(line.slice(firstColon + 1, secondColon))
        const text = line.slice(secondColon + 1)
        return { file, line: lineNumber, text }
      })
    return {
      type: "file_search",
      query,
      path: searchPath ?? ".",
      matches,
      exitCode: res.exitCode,
    }
  },
  {
    name: "file_search",
    description: "Search within workspace files using ripgrep (rg) or grep as a fallback.",
    schema: z.object({
      query: z.string().min(1),
      path: z.string().optional(),
      maxResults: z.number().int().min(1).max(1000).optional(),
    }),
  }
)

/**
 * Sends an HTTP request and returns status, headers, text, and parsed JSON when possible.
 */
export const httpRequestTool = tool(
  async ({ url, method, headers, body, timeoutMs }) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs ?? 20000, 60000))
    try {
      const res = await fetch(url, {
        method: method ?? "GET",
        headers: headers ?? {},
        body: body ?? undefined,
        signal: controller.signal,
      })
      const rawText = await res.text().catch(() => "")
      let json: unknown = null
      try {
        json = JSON.parse(rawText)
      } catch {
        json = null
      }
      return {
        type: "http_request",
        url,
        method: method ?? "GET",
        status: res.status,
        ok: res.ok,
        headers: Object.fromEntries(res.headers.entries()),
        bodyText: truncateString(rawText, 6000),
        json,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed"
      return {
        type: "http_request",
        url,
        method: method ?? "GET",
        error: message,
      }
    } finally {
      clearTimeout(timer)
    }
  },
  {
    name: "http_request",
    description: "Make an HTTP request (for APIs or fetching raw content).",
    schema: z.object({
      url: z.string().url(),
      method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]).optional(),
      headers: z.record(z.string(), z.string()).optional(),
      body: z.string().optional(),
      timeoutMs: z.number().int().min(1000).max(60000).optional(),
    }),
  }
)

/**
 * Fetches a small binary resource and returns it as base64 for follow-up processing.
 */
export const downloadFetchTool = tool(
  async ({ url, headers, timeoutMs }) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs ?? 20000, 60000))
    try {
      const res = await fetch(url, { headers: headers ?? {}, signal: controller.signal })
      const arrayBuffer = await res.arrayBuffer()
      const buf = Buffer.from(arrayBuffer)
      const sizeLimit = 5 * 1024 * 1024
      if (buf.length > sizeLimit) {
        return {
          type: "download_fetch",
          url,
          status: res.status,
          ok: res.ok,
          size: buf.length,
          contentType: res.headers.get("content-type") || "",
          error: `File too large (${buf.length} bytes, limit ${sizeLimit})`,
        }
      }
      return {
        type: "download_fetch",
        url,
        status: res.status,
        ok: res.ok,
        size: buf.length,
        contentType: res.headers.get("content-type") || "",
        base64: buf.toString("base64"),
      }
    } catch (err) {
      return {
        type: "download_fetch",
        url,
        error: err instanceof Error ? err.message : "Download failed",
      }
    } finally {
      clearTimeout(timer)
    }
  },
  {
    name: "download_fetch",
    description: "Fetch a binary file and return base64 (max ~5MB).",
    schema: z.object({
      url: z.string().url(),
      headers: z.record(z.string(), z.string()).optional(),
      timeoutMs: z.number().int().min(1000).max(60000).optional(),
    }),
  }
)

export const fetchManyTool = tool(
  async ({ urls, timeoutMs }) => {
    const limit = Math.min(urls.length, 10)
    const results = await Promise.all(
      urls.slice(0, limit).map(async (url) => {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs ?? 15000)
        try {
          const res = await fetch(url, {
            signal: controller.signal,
            headers: { "User-Agent": "Rekdin/NextJS" },
          })
          const text = await res.text().catch(() => "")
          return {
            url,
            status: res.status,
            ok: res.ok,
            contentType: res.headers.get("content-type"),
            textPreview: truncateString(text, 2000),
          }
        } catch (err) {
          return { url, error: err instanceof Error ? err.message : "Fetch failed" }
        } finally {
          clearTimeout(timer)
        }
      })
    )
    return { type: "fetch_many", results, omittedUrls: Math.max(urls.length - limit, 0) }
  },
  {
    name: "fetch_many",
    description: "Fetch up to 10 URLs and return compact text previews.",
    schema: z.object({
      urls: z.array(z.string().url()).min(1).max(25),
      timeoutMs: z.number().int().min(1000).max(60000).optional(),
    }),
  }
)

export const searchBatchTool = tool(
  async ({ queries, maxResults }) => {
    const results = await Promise.all(
      queries.slice(0, 8).map(async (query) => ({
        query,
        results: await searchPublicWeb(query, { maxResults: Math.min(maxResults ?? 5, 10) }),
      }))
    )
    return { type: "search_batch", results, omittedQueries: Math.max(queries.length - 8, 0) }
  },
  {
    name: "search_batch",
    description: "Run several public web searches at once.",
    schema: z.object({
      queries: z.array(z.string().min(1)).min(1).max(20),
      maxResults: z.number().int().min(1).max(10).optional(),
    }),
  }
)

export const robotsTxtTool = tool(
  async ({ origin }) => {
    const url = new URL("/robots.txt", origin).href
    const res = await fetch(url, { headers: { "User-Agent": "Rekdin/NextJS" } })
    const text = await res.text().catch(() => "")
    return { type: "robots_txt", url, status: res.status, content: truncateString(text, 8000) }
  },
  {
    name: "robots_txt",
    description: "Fetch robots.txt for an origin.",
    schema: z.object({ origin: z.string().url() }),
  }
)

export const sitemapFetchTool = tool(
  async ({ url, maxUrls }) => {
    const res = await fetch(url, { headers: { "User-Agent": "Rekdin/NextJS" } })
    const xml = await res.text()
    const dom = new JSDOM(xml, { contentType: "text/xml" })
    const limit = Math.min(maxUrls ?? 100, 500)
    const urls = Array.from(dom.window.document.querySelectorAll("url > loc, sitemap > loc"))
      .map((node) => node.textContent?.trim())
      .filter(Boolean)
      .slice(0, limit)
    return { type: "sitemap_fetch", url, status: res.status, urls, truncated: urls.length >= limit }
  },
  {
    name: "sitemap_fetch",
    description: "Fetch and parse sitemap XML URLs.",
    schema: z.object({
      url: z.string().url(),
      maxUrls: z.number().int().min(1).max(500).optional(),
    }),
  }
)

export const rssFetchTool = tool(
  async ({ url, maxItems }) => {
    const res = await fetch(url, { headers: { "User-Agent": "Rekdin/NextJS" } })
    const xml = await res.text()
    const dom = new JSDOM(xml, { contentType: "text/xml" })
    const limit = Math.min(maxItems ?? 20, 100)
    const items = Array.from(dom.window.document.querySelectorAll("item, entry"))
      .slice(0, limit)
      .map((item) => ({
        title: item.querySelector("title")?.textContent?.trim() ?? "",
        link:
          item.querySelector("link")?.textContent?.trim() ||
          item.querySelector("link")?.getAttribute("href") ||
          "",
        date: item.querySelector("pubDate, updated, published")?.textContent?.trim() ?? "",
        summary: truncateString(
          item.querySelector("description, summary, content")?.textContent?.trim() ?? "",
          1000
        ),
      }))
    return { type: "rss_fetch", url, status: res.status, items }
  },
  {
    name: "rss_fetch",
    description: "Fetch and parse RSS/Atom feed items.",
    schema: z.object({
      url: z.string().url(),
      maxItems: z.number().int().min(1).max(100).optional(),
    }),
  }
)

export const pageMetadataBatchTool = tool(
  async ({ urls }) => {
    const results = await Promise.all(
      urls.slice(0, 10).map((url) => linkPreviewTool.invoke({ url }))
    )
    return { type: "page_metadata_batch", results, omittedUrls: Math.max(urls.length - 10, 0) }
  },
  {
    name: "page_metadata_batch",
    description: "Fetch metadata for several pages.",
    schema: z.object({ urls: z.array(z.string().url()).min(1).max(25) }),
  }
)

export const pageDiffSnapshotTool = tool(
  async ({ beforeUrl, afterUrl }) => {
    const before = (await visitUrlTool.invoke({ url: beforeUrl })) as {
      markdown?: string
      title?: string
    }
    const after = (await visitUrlTool.invoke({ url: afterUrl })) as {
      markdown?: string
      title?: string
    }
    return {
      type: "page_diff_snapshot",
      beforeUrl,
      afterUrl,
      beforeTitle: before.title,
      afterTitle: after.title,
      diff: truncateString(
        createPatch("page.md", before.markdown ?? "", after.markdown ?? "", "before", "after"),
        16000
      ),
    }
  },
  {
    name: "page_diff_snapshot",
    description: "Fetch two pages and return a markdown diff.",
    schema: z.object({ beforeUrl: z.string().url(), afterUrl: z.string().url() }),
  }
)

export const citationMetadataTool = tool(
  async ({ url }) => {
    const preview = (await linkPreviewTool.invoke({ url })) as Record<string, unknown>
    const visited = (await visitUrlTool.invoke({ url })) as Record<string, unknown>
    return {
      type: "citation_metadata",
      url,
      title: preview.title ?? visited.title,
      description: preview.description,
      excerpt: visited.excerpt,
      accessedAt: new Date().toISOString(),
    }
  },
  {
    name: "citation_metadata",
    description: "Create compact citation metadata for a URL.",
    schema: z.object({ url: z.string().url() }),
  }
)

export const domainInfoTool = tool(
  async ({ domain }) => {
    const dns = await import("dns/promises")
    const [addresses, mx, txt] = await Promise.all([
      dns.resolve4(domain).catch(() => []),
      dns.resolveMx(domain).catch(() => []),
      dns.resolveTxt(domain).catch(() => []),
    ])
    return { type: "domain_info", domain, addresses, mx, txt: txt.slice(0, 20) }
  },
  {
    name: "domain_info",
    description: "Resolve basic DNS information for a domain.",
    schema: z.object({ domain: z.string().min(1) }),
  }
)

export const githubRepoInfoTool = tool(
  async ({ owner, repo }) => {
    const data = await fetchJson<Record<string, unknown>>(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
    )
    return {
      type: "github_repo_info",
      owner,
      repo,
      name: data.full_name,
      description: data.description,
      stars: data.stargazers_count,
      forks: data.forks_count,
      openIssues: data.open_issues_count,
      license: (data.license as Record<string, unknown> | null)?.spdx_id ?? null,
      updatedAt: data.updated_at,
      defaultBranch: data.default_branch,
    }
  },
  {
    name: "github_repo_info",
    description: "Fetch public GitHub repository metadata.",
    schema: z.object({ owner: z.string().min(1), repo: z.string().min(1) }),
  }
)

export const packageCompareTool = tool(
  async ({ names }) => {
    const packages = await Promise.all(
      names.slice(0, 8).map((name) => npmPackageInfoTool.invoke({ name }))
    )
    return { type: "package_compare", packages, omittedPackages: Math.max(names.length - 8, 0) }
  },
  {
    name: "package_compare",
    description: "Compare npm metadata for several packages.",
    schema: z.object({ names: z.array(z.string().min(1)).min(1).max(20) }),
  }
)

/**
 * Records a lightweight browser control step with a screenshot for visual timelines.
 */
export const browserControlTool = tool(
  async ({ url, action, thought, x, y }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      await goto(page, url, "domcontentloaded")
      const shot = await screenshotDataUrl(page, true)
      return {
        url: page.url(),
        title: await page.title(),
        screenshot: shot,
        thought: thought ?? "",
        step: action ?? "",
        action: action ?? "",
        x: x ?? null,
        y: y ?? null,
        status: "success",
        type: "browser_control",
        duration: Date.now() - started,
      }
    })
  },
  {
    name: "browser_control",
    description: "Report a browser control step (lightweight visual step for progress).",
    schema: z.object({
      url: z.string().url(),
      action: z.string().optional(),
      thought: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
    }),
  }
)

/**
 * Compatibility wrapper for visual browser-control steps with pointer coordinates.
 */
export const browserVisionControlTool = tool(
  async ({ url, thought, x, y }) => {
    return await browserControlTool.invoke({ url, thought, x, y, action: "vision_control" })
  },
  {
    name: "browser_vision_control",
    description: "Provide a screenshot + cursor position for a visual browser step (compat).",
    schema: z.object({
      url: z.string().url(),
      thought: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
    }),
  }
)

/**
 * Compatibility wrapper for named browser action steps.
 */
export const browserActionTool = tool(
  async ({ url, action, thought }) => {
    return await browserControlTool.invoke({ url, action, thought })
  },
  {
    name: "browser_action",
    description: "Record a browser action step (compat).",
    schema: z.object({
      url: z.string().url(),
      action: z.string().min(1),
      thought: z.string().optional(),
    }),
  }
)

/**
 * Runs JavaScript with Node.js in a temporary file and returns process output.
 */
export const nodeExecuteTool = tool(
  async ({ code }) => {
    assertNoBlockedDirectoryReference(code)
    const dir = await mkdtemp(path.join(os.tmpdir(), "Rekdin-node-"))
    const filePath = path.join(dir, "script.js")
    await writeFile(filePath, code, "utf-8")
    const res = await runCommand(`node ${filePath}`)
    return {
      type: "node_execute",
      script: code,
      interpreter: "node",
      stdout: res.stdout,
      stderr: res.stderr,
      exitCode: res.exitCode,
      duration: res.duration,
    }
  },
  {
    name: "node_execute",
    description: "Execute JavaScript using Node.js and return stdout/stderr.",
    schema: z.object({ code: z.string().min(1) }),
  }
)

/**
 * Runs Python with python3 in a temporary file and returns process output.
 */
export const pythonExecuteTool = tool(
  async ({ code }) => {
    assertNoBlockedDirectoryReference(code)
    const dir = await mkdtemp(path.join(os.tmpdir(), "Rekdin-python-"))
    const filePath = path.join(dir, "script.py")
    await writeFile(filePath, code, "utf-8")
    const res = await runCommand(`python3 ${filePath}`)
    return {
      type: "python_execute",
      script: code,
      interpreter: "python3",
      stdout: res.stdout,
      stderr: res.stderr,
      exitCode: res.exitCode,
      duration: res.duration,
    }
  },
  {
    name: "python_execute",
    description: "Execute Python code using python3 and return stdout/stderr.",
    schema: z.object({ code: z.string().min(1) }),
  }
)

/**
 * Executes Node.js code in the CodeAct result shape expected by the UI.
 */
export const nodeCodeActTool = tool(
  async ({ code, filename }) => {
    const started = Date.now()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = (await nodeExecuteTool.invoke({ code })) as any
    return {
      type: "node_codeact",
      success: (res?.exitCode ?? 0) === 0,
      output: res?.stdout ?? "",
      error: res?.stderr ?? "",
      duration: Date.now() - started,
      filename: filename ?? "code.js",
    }
  },
  {
    name: "node_codeact",
    description: "Execute Node.js code (CodeAct-style).",
    schema: z.object({ code: z.string().min(1), filename: z.string().optional() }),
  }
)

/**
 * Executes Python code in the CodeAct result shape expected by the UI.
 */
export const pythonCodeActTool = tool(
  async ({ code, filename }) => {
    const started = Date.now()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = (await pythonExecuteTool.invoke({ code })) as any
    return {
      type: "python_codeact",
      success: (res?.exitCode ?? 0) === 0,
      output: res?.stdout ?? "",
      error: res?.stderr ?? "",
      duration: Date.now() - started,
      filename: filename ?? "code.py",
    }
  },
  {
    name: "python_codeact",
    description: "Execute Python code (CodeAct-style).",
    schema: z.object({ code: z.string().min(1), filename: z.string().optional() }),
  }
)

/**
 * Executes shell code in the CodeAct result shape expected by the UI.
 */
export const shellCodeActTool = tool(
  async ({ code, filename }) => {
    assertNoBlockedDirectoryReference(code)
    const started = Date.now()
    const dir = await mkdtemp(path.join(os.tmpdir(), "Rekdin-shell-"))
    const filePath = path.join(dir, filename ?? "code.sh")
    await writeFile(filePath, code, "utf-8")
    const res = await runCommand(`bash ${filePath}`)
    return {
      type: "shell_codeact",
      success: res.exitCode === 0,
      output: res.stdout,
      error: res.stderr,
      duration: Date.now() - started,
      filename: filename ?? "code.sh",
    }
  },
  {
    name: "shell_codeact",
    description: "Execute shell code (CodeAct-style).",
    schema: z.object({ code: z.string().min(1), filename: z.string().optional() }),
  }
)

/**
 * Compatibility alias for workspace shell execution.
 */
export const shellExecuteTool = tool(
  async ({ command, cwd, timeout }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = (await executeCommandTool.invoke({ command, cwd, timeout })) as any
    return {
      ...(typeof res === "object" && res ? res : {}),
      type: "shell_execute",
    }
  },
  {
    name: "shell_execute",
    description: "Alias for execute_command for compatibility with Rekdin renderers.",
    schema: z.object({
      command: z.string().min(1),
      cwd: z.string().optional(),
      timeout: z.number().optional(),
    }),
  }
)

/**
 * Performs find-and-replace edits in a workspace text file.
 */
export const fileReplaceTool = tool(
  async ({ path: filePath, find, replace, regex, ignoreCase, maxReplacements }) => {
    const content = await readWorkspaceText(filePath)
    const flags = `${regex ? "g" : "g"}${ignoreCase ? "i" : ""}`
    let matcher: RegExp
    try {
      matcher = regex
        ? new RegExp(find, flags)
        : new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags)
    } catch (err) {
      return {
        type: "file_replace",
        path: filePath,
        error: err instanceof Error ? err.message : "Invalid pattern",
      }
    }
    let replacements = 0
    const updated = content.replace(matcher, (match) => {
      if (maxReplacements && replacements >= maxReplacements) return match
      replacements += 1
      return replace
    })
    if (replacements === 0) {
      return {
        type: "file_replace",
        path: filePath,
        replacements: 0,
        changed: false,
        message: "No matches found",
      }
    }
    await writeWorkspaceText(filePath, updated)
    return {
      type: "file_replace",
      path: filePath,
      replacements,
      changed: true,
      preview: truncateString(updated.slice(0, 1000)),
    }
  },
  {
    name: "file_replace",
    description: "Find and replace text in a workspace file (ripgrep-style).",
    schema: z.object({
      path: z.string(),
      find: z.string().min(1),
      replace: z.string(),
      regex: z.boolean().optional(),
      ignoreCase: z.boolean().optional(),
      maxReplacements: z.number().int().min(1).optional(),
    }),
  }
)

/**
 * Applies add, remove, and replace JSON Patch operations to a workspace JSON file.
 */
export const jsonPatchTool = tool(
  async ({ path: filePath, operations }) => {
    const raw = await readWorkspaceText(filePath)
    const data = JSON.parse(raw)
    const patched = applyJsonPatch(data, operations)
    await writeWorkspaceText(filePath, JSON.stringify(patched, null, 2))
    return {
      type: "json_patch",
      path: filePath,
      operations,
      changed: true,
    }
  },
  {
    name: "json_patch",
    description: "Apply RFC-6902 style JSON Patch operations to a JSON file.",
    schema: z.object({
      path: z.string(),
      operations: z.array(
        z.object({
          op: z.enum(["add", "remove", "replace"]),
          path: z.string().min(1),
          value: z.any().optional(),
        })
      ),
    }),
  }
)

/**
 * Applies add, remove, and replace patch operations to a workspace YAML file.
 */
export const yamlPatchTool = tool(
  async ({ path: filePath, operations }) => {
    const yamlMod = await loadYamlModule()
    if (!yamlMod) {
      return {
        type: "yaml_patch",
        path: filePath,
        changed: false,
        error: "YAML support requires the `yaml` package. Install with `npm install yaml`.",
      }
    }
    const raw = await readWorkspaceText(filePath)
    const parsed = yamlMod.parse(raw)
    const patched = applyJsonPatch(parsed, operations)
    const output = yamlMod.stringify(patched)
    await writeWorkspaceText(filePath, output)
    return { type: "yaml_patch", path: filePath, operations, changed: true }
  },
  {
    name: "yaml_patch",
    description: "Apply JSON Patch operations to a YAML file (requires `yaml` package).",
    schema: z.object({
      path: z.string(),
      operations: z.array(
        z.object({
          op: z.enum(["add", "remove", "replace"]),
          path: z.string().min(1),
          value: z.any().optional(),
        })
      ),
    }),
  }
)

/**
 * Creates a zip artifact from workspace files or directories.
 */
export const archiveCreateTool = tool(
  async ({ paths, archiveName }) => {
    await ensureWorkspaceDirs()
    if (!Array.isArray(paths) || paths.length === 0) {
      return { type: "archive_create", error: "No paths provided", success: false }
    }
    const files: Record<string, Uint8Array> = {}
    let totalBytes = 0

    const addFile = async (zipPath: string, absPath: string) => {
      const buf = await readFile(absPath)
      totalBytes += buf.length
      if (totalBytes > 10 * 1024 * 1024) {
        throw new Error("Archive too large (max 10MB)")
      }
      files[zipPath] = new Uint8Array(buf)
    }

    const addTree = async (absPath: string, zipPrefix: string) => {
      assertWorkspacePathAllowed(absPath)
      const info = await stat(absPath)
      if (info.isDirectory()) {
        const entries = await readdir(absPath, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.isDirectory() && isBlockedWorkspaceDirectoryName(entry.name)) continue
          const childAbs = path.join(absPath, entry.name)
          const childZip = zipPrefix ? `${zipPrefix}/${entry.name}` : entry.name
          if (entry.isDirectory()) {
            await addTree(childAbs, childZip)
          } else if (entry.isFile()) {
            await addFile(childZip, childAbs)
          }
        }
        return
      }
      if (info.isFile()) {
        const name = zipPrefix || path.basename(absPath)
        await addFile(name, absPath)
      }
    }

    for (const p of paths) {
      const safeRel = p.replace(/^(\.\.(\/|\\|$))+/, "").replace(/^[\\/]/, "")
      const abs = resolveWorkspacePath(safeRel)
      await addTree(abs, safeRel.replace(/\\/g, "/"))
    }

    if (Object.keys(files).length === 0) {
      return { type: "archive_create", success: false, error: "No files found to archive" }
    }

    const buf = Buffer.from(zipSync(files, { level: 6 }))
    const zipName = sanitizePdfBaseName(archiveName || "archive")
    const artifact = await storeArtifact({
      filename: `${zipName}.zip`,
      bytes: buf,
      mimeType: "application/zip",
    })
    return {
      type: "archive_create",
      success: true,
      archiveName: `${zipName}.zip`,
      size: buf.length,
      artifact,
      artifactUrl: artifact.url,
    }
  },
  {
    name: "archive_create",
    description: "Create a zip archive from workspace files/folders (returned as data URL).",
    schema: z.object({
      paths: z.array(z.string().min(1)).min(1),
      archiveName: z.string().optional(),
    }),
  }
)

/**
 * Extracts a zip archive into the workspace with path and size limits.
 */
export const archiveExtractTool = tool(
  async ({ data, outputDir }) => {
    try {
      const buf = decodeDataInput(data)
      if (buf.length > 10 * 1024 * 1024) {
        return { type: "archive_extract", success: false, error: "Archive too large (max 10MB)" }
      }
      const extracted = unzipSync(buf)
      const written: string[] = []
      let total = 0
      const targetRoot = outputDir ?? "."
      for (const [name, content] of Object.entries(extracted)) {
        const safeName = name.replace(/^(\.\.(\/|\\|$))+/, "").replace(/^[\\/]/, "")
        if (!safeName) continue
        total += content.length
        if (total > 10 * 1024 * 1024) {
          return { type: "archive_extract", success: false, error: "Extracted data exceeds 10MB" }
        }
        const relPath = path.join(targetRoot, safeName)
        const absPath = resolveWorkspacePath(relPath)
        await mkdir(path.dirname(absPath), { recursive: true })
        await writeFile(absPath, Buffer.from(content))
        written.push(relPath.replace(/\\/g, "/"))
      }
      return { type: "archive_extract", success: true, outputDir: targetRoot, entries: written }
    } catch (err) {
      return {
        type: "archive_extract",
        success: false,
        error: err instanceof Error ? err.message : "Failed to extract archive",
      }
    }
  },
  {
    name: "archive_extract",
    description: "Extract a zip archive (data/base64) into the workspace.",
    schema: z.object({
      data: z.string().min(1),
      outputDir: z.string().optional(),
    }),
  }
)

/**
 * Encodes plain text as base64.
 */
export const base64EncodeTool = tool(
  async ({ text }) => {
    const encoded = Buffer.from(text, "utf-8").toString("base64")
    return { type: "base64_encode", text, encoded }
  },
  {
    name: "base64_encode",
    description: "Base64-encode text.",
    schema: z.object({ text: z.string().min(1) }),
  }
)

/**
 * Decodes base64 text as UTF-8.
 */
export const base64DecodeTool = tool(
  async ({ encoded }) => {
    const decoded = Buffer.from(encoded, "base64").toString("utf-8")
    return { type: "base64_decode", decoded }
  },
  {
    name: "base64_decode",
    description: "Decode base64-encoded text.",
    schema: z.object({ encoded: z.string().min(1) }),
  }
)

/**
 * Computes a cryptographic hash for inline text or a workspace file.
 */
export const hashTool = tool(
  async ({ input, algorithm, path: filePath }) => {
    let data = input
    if (!data && !filePath) {
      return { type: "hash", error: "Provide `input` or `path`" }
    }
    if (filePath) {
      data = await readWorkspaceText(filePath)
    }
    const hash = crypto
      .createHash(algorithm)
      .update(data ?? "")
      .digest("hex")
    return { type: "hash", algorithm, hash, source: filePath ?? "inline" }
  },
  {
    name: "hash",
    description: "Compute a hash (md5/sha1/sha256/sha512) for inline text or a workspace file.",
    schema: z.object({
      input: z.string().optional(),
      path: z.string().optional(),
      algorithm: z.enum(["md5", "sha1", "sha256", "sha512"]).default("sha256"),
    }),
  }
)

/**
 * Produces a deterministic short summary by returning the first chunk of text.
 */
export const textSummarizeTool = tool(
  async ({ text, path: filePath }) => {
    if (!text && filePath) {
      text = await readWorkspaceText(filePath)
    }
    const words = (text || "").split(/\s+/).filter(Boolean)
    const summary = words.slice(0, 120).join(" ") + (words.length > 120 ? " ..." : "")
    return { type: "text_summarize", length: words.length, summary }
  },
  {
    name: "text_summarize",
    description: "Lightweight extractive summarization (first ~120 words).",
    schema: z.object({ text: z.string().optional(), path: z.string().optional() }),
  }
)

/**
 * Rewrites text into a simple bullet-list format.
 */
export const textRewriteTool = tool(
  async ({ text, path: filePath, style }) => {
    if (!text && filePath) {
      text = await readWorkspaceText(filePath)
    }
    const paragraphs = (text || "")
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
    const rewritten = paragraphs.map((p) => `- ${p}`).join("\n")
    return { type: "text_rewrite", style: style ?? "bulletize", output: rewritten }
  },
  {
    name: "text_rewrite",
    description: "Simple rewrite to bullets (deterministic).",
    schema: z.object({
      text: z.string().optional(),
      path: z.string().optional(),
      style: z.string().optional(),
    }),
  }
)

const TODO_SCAN_EXTENSIONS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "c",
  "cpp",
  "h",
  "cs",
  "swift",
  "kt",
  "php",
  "sh",
  "css",
  "scss",
  "html",
  "vue",
  "svelte",
  "yaml",
  "yml",
  "toml",
  "sql",
  "md",
  "txt",
  "json",
  "graphql",
  "gql",
])
const TODO_KEYWORD_RE = /\b(TODO|FIXME|HACK|XXX|BUG|NOTE)\b/i

/**
 * Finds TODO-style markers in one text buffer.
 */
function scanTextForTodos(content: string, relFile?: string) {
  return content.split(/\r?\n/).flatMap((line, i) => {
    const match = line.match(TODO_KEYWORD_RE)
    if (!match) return []
    return [{ file: relFile, line: i + 1, text: line.trim(), type: match[1].toUpperCase() }]
  })
}

/**
 * Recursively scans supported workspace files for TODO-style markers.
 */
async function walkDirForTodos(
  dirPath: string,
  baseDir: string
): Promise<{ file?: string; line?: number; text: string; type: string }[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const results: { file?: string; line?: number; text: string; type: string }[] = []
  for (const entry of entries) {
    if (entry.name.startsWith(".") || isBlockedWorkspaceDirectoryName(entry.name)) continue
    const fullPath = path.join(dirPath, entry.name)
    assertWorkspacePathAllowed(fullPath)
    if (entry.isDirectory()) {
      results.push(...(await walkDirForTodos(fullPath, baseDir)))
    } else {
      const ext = entry.name.split(".").pop()?.toLowerCase() ?? ""
      if (!TODO_SCAN_EXTENSIONS.has(ext)) continue
      const content = await readFile(fullPath, "utf-8").catch(() => "")
      results.push(...scanTextForTodos(content, path.relative(baseDir, fullPath)))
    }
  }
  return results
}

/**
 * Extracts TODO, FIXME, HACK, XXX, BUG, and NOTE markers from text, files, or folders.
 */
export const extractTodosTool = tool(
  async ({ text, path: inputPath }) => {
    await ensureWorkspaceDirs()
    let todos: { file?: string; line?: number; text: string; type: string }[] = []
    if (text) {
      todos = scanTextForTodos(text)
    } else if (inputPath) {
      const resolved = resolveWorkspacePath(inputPath)
      const s = await stat(resolved)
      if (s.isDirectory()) {
        todos = await walkDirForTodos(resolved, resolved)
      } else {
        const content = await readFile(resolved, "utf-8")
        todos = scanTextForTodos(content, inputPath)
      }
    }
    return { type: "extract_todos", count: todos.length, todos }
  },
  {
    name: "extract_todos",
    description:
      "Extract TODO/FIXME/HACK-style comments from a workspace file or directory (scanned recursively).",
    schema: z.object({ text: z.string().optional(), path: z.string().optional() }),
  }
)

export const pdfExtractTextTool = tool(
  async ({ path: filePath, source, maxChars }) => {
    const bytes = filePath
      ? await readFile(resolveWorkspacePath(filePath))
      : await fetchBuffer(source!)
    const { PDFParse } = await import("pdf-parse")
    const parser = new PDFParse({ data: new Uint8Array(bytes) })
    try {
      const result = await parser.getText()
      const text = result.text ?? ""
      return {
        type: "pdf_extract_text",
        path: filePath,
        source,
        pages: result.pages?.length ?? undefined,
        text: truncateString(text, maxChars ?? 12000),
        chars: text.length,
      }
    } finally {
      await parser.destroy()
    }
  },
  {
    name: "pdf_extract_text",
    description: "Extract text from a PDF workspace file, URL, or data URL.",
    schema: z
      .object({
        path: z.string().optional(),
        source: z.string().optional(),
        maxChars: z.number().int().min(100).max(50000).optional(),
      })
      .refine((value) => value.path || value.source, { message: "Provide path or source" }),
  }
)

export const docxExtractTextTool = tool(
  async ({ path: filePath, maxChars }) => {
    const bytes = await readFile(resolveWorkspacePath(filePath))
    const files = unzipSync(bytes)
    const documentXml = files["word/document.xml"]
    if (!documentXml) throw new Error("DOCX missing word/document.xml")
    const xml = Buffer.from(documentXml).toString("utf-8")
    const dom = new JSDOM(xml, { contentType: "text/xml" })
    const text = Array.from(dom.window.document.querySelectorAll("w\\:t, t"))
      .map((node) => node.textContent ?? "")
      .join("")
    return {
      type: "docx_extract_text",
      path: filePath,
      text: truncateString(text, maxChars ?? 12000),
      chars: text.length,
    }
  },
  {
    name: "docx_extract_text",
    description: "Extract plain text from a DOCX workspace file.",
    schema: z.object({
      path: z.string().min(1),
      maxChars: z.number().int().min(100).max(50000).optional(),
    }),
  }
)

export const csvPreviewTool = tool(
  async ({ path: filePath, delimiter, maxRows }) => {
    const content = await readWorkspaceText(filePath)
    const rows = parseSimpleCsv(content, delimiter ?? ",", Math.min(maxRows ?? 25, 200))
    return {
      type: "csv_preview",
      path: filePath,
      rowCountPreviewed: rows.length,
      headers: rows[0] ?? [],
      rows: rows.slice(1),
    }
  },
  {
    name: "csv_preview",
    description: "Preview rows from a CSV workspace file.",
    schema: z.object({
      path: z.string().min(1),
      delimiter: z.string().length(1).optional(),
      maxRows: z.number().int().min(1).max(200).optional(),
    }),
  }
)

export const csvQueryTool = tool(
  async ({ path: filePath, delimiter, whereColumn, whereEquals, columns, maxRows }) => {
    const content = await readWorkspaceText(filePath)
    const rows = parseSimpleCsv(content, delimiter ?? ",", 5000)
    const headers = rows[0] ?? []
    const selectedColumns = columns?.length ? columns : headers
    const whereIndex = whereColumn ? headers.indexOf(whereColumn) : -1
    const selectedIndexes = selectedColumns
      .map((column) => headers.indexOf(column))
      .filter((index) => index >= 0)
    const resultRows = rows
      .slice(1)
      .filter((row) => whereIndex < 0 || row[whereIndex] === whereEquals)
      .slice(0, Math.min(maxRows ?? 50, 500))
      .map((row) =>
        Object.fromEntries(selectedIndexes.map((index) => [headers[index], row[index] ?? ""]))
      )
    return {
      type: "csv_query",
      path: filePath,
      headers,
      rows: resultRows,
      truncated: resultRows.length >= (maxRows ?? 50),
    }
  },
  {
    name: "csv_query",
    description: "Filter and project rows from a CSV workspace file.",
    schema: z.object({
      path: z.string().min(1),
      delimiter: z.string().length(1).optional(),
      whereColumn: z.string().optional(),
      whereEquals: z.string().optional(),
      columns: z.array(z.string()).optional(),
      maxRows: z.number().int().min(1).max(500).optional(),
    }),
  }
)

export const jsonQueryTool = tool(
  async ({ path: filePath, query }) => {
    const parsed = JSON.parse(await readWorkspaceText(filePath))
    return {
      type: "json_query",
      path: filePath,
      query: query ?? "$",
      value: getJsonPath(parsed, query ?? "$"),
    }
  },
  {
    name: "json_query",
    description: "Read a JSON file and return a simple path query result.",
    schema: z.object({ path: z.string().min(1), query: z.string().optional() }),
  }
)

export const yamlQueryTool = tool(
  async ({ path: filePath, query }) => {
    const yaml = await loadYamlModule()
    if (!yaml) throw new Error("YAML module unavailable")
    const parsed = yaml.parse(await readWorkspaceText(filePath))
    return {
      type: "yaml_query",
      path: filePath,
      query: query ?? "$",
      value: getJsonPath(parsed, query ?? "$"),
    }
  },
  {
    name: "yaml_query",
    description: "Read a YAML file and return a simple path query result.",
    schema: z.object({ path: z.string().min(1), query: z.string().optional() }),
  }
)

export const sqliteQueryTool = tool(
  async ({ path: filePath, query }) => {
    if (!isReadOnlySql(query))
      throw new Error("Only a single read-only SELECT/WITH/PRAGMA query is allowed")
    const safePath = path.relative(getWorkspaceRoot(), resolveWorkspacePath(filePath))
    const res = await runCommandUnsafe(
      `sqlite3 -json ${safeShellArg(safePath)} ${safeShellArg(query)}`,
      getWorkspaceRoot(),
      15000
    )
    let rows: unknown = res.stdout
    try {
      rows = JSON.parse(res.stdout || "[]")
    } catch {
      // keep raw stdout
    }
    return {
      type: "sqlite_query",
      path: filePath,
      query,
      rows,
      exitCode: res.exitCode,
      stderr: truncateString(res.stderr, 2000),
    }
  },
  {
    name: "sqlite_query",
    description: "Run one read-only sqlite3 query against a workspace database file.",
    schema: z.object({ path: z.string().min(1), query: z.string().min(1) }),
  }
)

export const htmlTableExtractTool = tool(
  async ({ html, url }) => {
    const content = html ?? (await fetch(url!).then((res) => res.text()))
    const dom = new JSDOM(content, url ? { url } : undefined)
    const tables = Array.from(dom.window.document.querySelectorAll("table"))
      .slice(0, 20)
      .map((table, index) => ({
        index,
        rows: Array.from(table.querySelectorAll("tr"))
          .slice(0, 200)
          .map((row) =>
            Array.from(row.querySelectorAll("th,td")).map((cell) => cell.textContent?.trim() ?? "")
          ),
      }))
    return { type: "html_table_extract", url, tables }
  },
  {
    name: "html_table_extract",
    description: "Extract tables from raw HTML or a URL.",
    schema: z
      .object({ html: z.string().optional(), url: z.string().url().optional() })
      .refine((value) => value.html || value.url, { message: "Provide html or url" }),
  }
)

export const markdownFrontmatterTool = tool(
  async ({ path: filePath, markdown }) => {
    const content = markdown ?? (await readWorkspaceText(filePath!))
    const parsed = parseFrontmatter(content)
    return {
      type: "markdown_frontmatter",
      path: filePath,
      frontmatter: parsed.frontmatter,
      bodyPreview: truncateString(parsed.body, 4000),
    }
  },
  {
    name: "markdown_frontmatter",
    description: "Parse YAML-like frontmatter from Markdown.",
    schema: z
      .object({ path: z.string().optional(), markdown: z.string().optional() })
      .refine((value) => value.path || value.markdown, { message: "Provide path or markdown" }),
  }
)

export const tokenCountTool = tool(
  async ({ text }) => ({ type: "token_count", tokens: estimateTokens(text), chars: text.length }),
  {
    name: "token_count",
    description: "Estimate tokenizer token count for text.",
    schema: z.object({ text: z.string() }),
  }
)

export const textKeywordsTool = tool(
  async ({ text, maxKeywords }) => ({
    type: "text_keywords",
    keywords: keywordExtractor
      .extract(text, { language: "english", remove_duplicates: true })
      .slice(0, maxKeywords ?? 50),
  }),
  {
    name: "text_keywords",
    description: "Extract keywords from text without using an LLM.",
    schema: z.object({
      text: z.string(),
      maxKeywords: z.number().int().min(1).max(200).optional(),
    }),
  }
)

export const textEntitiesTool = tool(
  async ({ text }) => {
    const urls = unique(text.match(/https?:\/\/[^\s)]+/g) ?? [])
    const emails = unique(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [])
    const capitalizedPhrases = unique(
      text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4}\b/g) ?? []
    ).slice(0, 100)
    return { type: "text_entities", urls, emails, capitalizedPhrases }
  },
  {
    name: "text_entities",
    description: "Extract simple URLs, emails, and capitalized phrase entities from text.",
    schema: z.object({ text: z.string() }),
  }
)

const SECRET_PATTERNS = [
  { type: "openai_key", pattern: /sk-[A-Za-z0-9_-]{20,}/g },
  {
    type: "generic_api_key",
    pattern: /\b(api[_-]?key|secret|token|password)\s*[:=]\s*["']?([A-Za-z0-9_./+=-]{16,})/gi,
  },
  { type: "aws_access_key", pattern: /AKIA[0-9A-Z]{16}/g },
  { type: "private_key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
]

export const secretScanTool = tool(
  async ({ path: inputPath, maxFiles }) => {
    const { files, skipped } = await collectWorkspaceFiles({
      path: inputPath,
      maxFiles: maxFiles ?? 1000,
      includeHidden: true,
    })
    const findings: Array<Record<string, unknown>> = []
    for (const file of files) {
      const content = await readFile(file.abs, "utf-8").catch(() => "")
      const lines = content.split(/\r?\n/)
      lines.forEach((line, index) => {
        for (const { type, pattern } of SECRET_PATTERNS) {
          pattern.lastIndex = 0
          if (pattern.test(line))
            findings.push({
              type,
              file: file.path,
              line: index + 1,
              preview: line.replace(/([:=]\s*["']?).{4,}/, "$1[redacted]"),
            })
        }
      })
    }
    return { type: "secret_scan", findings: findings.slice(0, 200), skipped }
  },
  {
    name: "secret_scan",
    description: "Scan workspace text files for likely secrets without returning secret values.",
    schema: z.object({
      path: z.string().optional(),
      maxFiles: z.number().int().min(1).max(5000).optional(),
    }),
  }
)

export const dependencyAuditTool = tool(
  async () => {
    const res = await runCommandUnsafe("npm audit --json", getWorkspaceRoot(), 120000)
    let parsed: Record<string, unknown> | null = null
    try {
      parsed = JSON.parse(res.stdout || "{}") as Record<string, unknown>
    } catch {
      parsed = null
    }
    return {
      type: "dependency_audit",
      exitCode: res.exitCode,
      audit: parsed,
      stderr: truncateString(res.stderr, 4000),
    }
  },
  {
    name: "dependency_audit",
    description: "Run npm audit and return JSON vulnerability metadata.",
    schema: z.object({}),
  }
)

export const licenseSummaryTool = tool(
  async () => {
    const lockPath = resolveWorkspacePath("package-lock.json")
    const lock = JSON.parse(await readFile(lockPath, "utf-8")) as {
      packages?: Record<string, { license?: string }>
    }
    const counts: Record<string, number> = {}
    for (const pkg of Object.values(lock.packages ?? {})) {
      const license = pkg.license ?? "UNKNOWN"
      counts[license] = (counts[license] ?? 0) + 1
    }
    return { type: "license_summary", licenses: counts }
  },
  {
    name: "license_summary",
    description: "Summarize package-lock license fields.",
    schema: z.object({}),
  }
)

export const sbomGenerateTool = tool(
  async () => {
    const lock = JSON.parse(await readWorkspaceText("package-lock.json")) as {
      packages?: Record<string, { version?: string; resolved?: string; license?: string }>
    }
    const components = Object.entries(lock.packages ?? {})
      .filter(([name]) => name.startsWith("node_modules/"))
      .map(([name, info]) => ({
        type: "library",
        name: name.replace(/^node_modules\//, ""),
        version: info.version,
        licenses: info.license ? [{ license: { id: info.license } }] : undefined,
        purl: `pkg:npm/${name.replace(/^node_modules\//, "")}@${info.version ?? ""}`,
      }))
    return {
      type: "sbom_generate",
      format: "cyclonedx-lite",
      componentCount: components.length,
      bom: { bomFormat: "CycloneDX", specVersion: "1.5", components: components.slice(0, 2000) },
    }
  },
  {
    name: "sbom_generate",
    description: "Generate a lightweight CycloneDX-style SBOM from package-lock.",
    schema: z.object({}),
  }
)

export const lockfileRiskSummaryTool = tool(
  async () => {
    const lock = JSON.parse(await readWorkspaceText("package-lock.json")) as {
      packages?: Record<
        string,
        { version?: string; resolved?: string; integrity?: string; dev?: boolean }
      >
    }
    const packages = Object.entries(lock.packages ?? {}).filter(([name]) =>
      name.startsWith("node_modules/")
    )
    return {
      type: "lockfile_risk_summary",
      packageCount: packages.length,
      missingIntegrity: packages
        .filter(([, info]) => !info.integrity)
        .map(([name]) => name)
        .slice(0, 100),
      gitResolved: packages
        .filter(([, info]) => String(info.resolved ?? "").startsWith("git"))
        .map(([name, info]) => ({ name, resolved: info.resolved }))
        .slice(0, 100),
      devCount: packages.filter(([, info]) => info.dev).length,
    }
  },
  {
    name: "lockfile_risk_summary",
    description: "Summarize package-lock supply-chain risk signals.",
    schema: z.object({}),
  }
)

export const semgrepScanTool = tool(
  async ({ config }) => {
    const res = await runCommandUnsafe(
      `semgrep --json --config ${safeShellArg(config ?? "auto")} .`,
      getWorkspaceRoot(),
      120000
    )
    let findings: unknown = res.stdout
    try {
      findings = JSON.parse(res.stdout || "{}")
    } catch {
      // keep raw output
    }
    return {
      type: "semgrep_scan",
      exitCode: res.exitCode,
      findings,
      stderr: truncateString(res.stderr, 4000),
    }
  },
  {
    name: "semgrep_scan",
    description: "Run semgrep if installed and return JSON findings.",
    schema: z.object({ config: z.string().optional() }),
  }
)

export const dockerfileScanTool = tool(
  async () => {
    const { files } = await collectWorkspaceFiles({ maxFiles: 1000, includeHidden: true })
    const dockerfiles = files.filter((file) => /(^|\/)(Dockerfile|.*\.Dockerfile)$/.test(file.path))
    const findings = []
    for (const file of dockerfiles) {
      const content = await readFile(file.abs, "utf-8").catch(() => "")
      if (/FROM\s+[^:\s]+(?=\s|$)/i.test(content))
        findings.push({ path: file.path, issue: "Base image has no explicit tag" })
      if (/USER\s+root/i.test(content) || !/\nUSER\s+/i.test(content))
        findings.push({ path: file.path, issue: "Container may run as root" })
      if (/ADD\s+https?:/i.test(content))
        findings.push({ path: file.path, issue: "Remote ADD detected" })
    }
    return { type: "dockerfile_scan", dockerfiles: dockerfiles.map((file) => file.path), findings }
  },
  {
    name: "dockerfile_scan",
    description: "Run lightweight Dockerfile safety checks.",
    schema: z.object({}),
  }
)

export const urlSafetyCheckTool = tool(
  async ({ url }) => {
    const parsed = new URL(url)
    const warnings = []
    if (parsed.protocol !== "https:") warnings.push("URL is not HTTPS")
    if (/(\d{1,3}\.){3}\d{1,3}/.test(parsed.hostname)) warnings.push("URL uses a raw IPv4 address")
    if (parsed.username || parsed.password) warnings.push("URL contains credentials")
    if (parsed.hostname === "localhost" || parsed.hostname.endsWith(".local"))
      warnings.push("URL targets a local hostname")
    return {
      type: "url_safety_check",
      url,
      hostname: parsed.hostname,
      protocol: parsed.protocol,
      warnings,
    }
  },
  {
    name: "url_safety_check",
    description: "Check URL syntax and simple safety signals.",
    schema: z.object({ url: z.string().url() }),
  }
)

export const workspacePermissionsScanTool = tool(
  async ({ path: inputPath }) => {
    const { files } = await collectWorkspaceFiles({
      path: inputPath,
      maxFiles: 3000,
      includeHidden: true,
    })
    const executable = []
    const worldWritable = []
    for (const file of files) {
      const info = await stat(file.abs)
      if ((info.mode & 0o111) !== 0) executable.push(file.path)
      if ((info.mode & 0o002) !== 0) worldWritable.push(file.path)
    }
    return {
      type: "workspace_permissions_scan",
      executable: executable.slice(0, 200),
      worldWritable: worldWritable.slice(0, 200),
    }
  },
  {
    name: "workspace_permissions_scan",
    description: "Find executable and world-writable files.",
    schema: z.object({ path: z.string().optional() }),
  }
)

/**
 * Creates a Markdown-to-PDF tool with request-specific Cloudinary credentials.
 */
function createMarkdownToPdfTool(context?: { headers?: HeadersInit }) {
  const cloudinaryConfig = parseCloudinaryConfig(context?.headers)
  return tool(
    async ({ markdown, filename }) => {
      const bodyMarkup = renderMarkdownHtml(markdown)
      const html = buildPrintableHtmlDocument(filename ?? "document", bodyMarkup)
      const result = await renderHtmlToPdf(
        html,
        filename ?? "document",
        cloudinaryConfig ?? undefined
      )
      return { type: "markdown_to_pdf", ...result }
    },
    {
      name: "markdown_to_pdf",
      description: "Convert Markdown text to PDF (via LaTeX) and return URL/data.",
      schema: z.object({ markdown: z.string().min(1), filename: z.string().optional() }),
    }
  )
}

/**
 * Reads basic image metadata such as width, height, format, and byte size.
 */
export const imageInfoTool = tool(
  async ({ source }) => {
    const sharp = await loadSharp()
    if (!sharp) {
      return {
        type: "image_info",
        error: "Image tooling requires `sharp`. Install with `npm install sharp`.",
      }
    }
    const buf = await fetchBuffer(source)
    const meta = await sharp(buf).metadata()
    return {
      type: "image_info",
      width: meta.width,
      height: meta.height,
      format: meta.format,
      size: buf.length,
    }
  },
  {
    name: "image_info",
    description: "Get basic image metadata (requires `sharp`).",
    schema: z.object({ source: z.string().min(1) }),
  }
)

/**
 * Converts an image to PNG, JPEG, or WebP and stores the result as an artifact.
 */
export const imageConvertTool = tool(
  async ({ source, format }) => {
    const sharp = await loadSharp()
    if (!sharp) {
      return {
        type: "image_convert",
        error: "Image tooling requires `sharp`. Install with `npm install sharp`.",
      }
    }
    const buf = await fetchBuffer(source)
    const converted = await sharp(buf)[format as "png" | "jpeg" | "webp"]().toBuffer()
    const extension = format === "jpeg" ? "jpg" : format
    const artifact = await storeArtifact({
      filename: `image-convert-${Date.now()}.${extension}`,
      bytes: converted,
      mimeType: `image/${format}`,
    })
    return {
      type: "image_convert",
      format,
      size: converted.length,
      artifact,
      artifactUrl: artifact.url,
    }
  },
  {
    name: "image_convert",
    description: "Convert an image to png/jpg/webp (requires `sharp`).",
    schema: z.object({ source: z.string().min(1), format: z.enum(["png", "jpeg", "webp"]) }),
  }
)

export const imageExifTool = tool(
  async ({ source }) => {
    const sharp = await loadSharp()
    if (!sharp) return { type: "image_exif", error: "Image tooling requires `sharp`." }
    const buf = await fetchBuffer(source)
    const meta = await sharp(buf).metadata()
    return {
      type: "image_exif",
      width: meta.width,
      height: meta.height,
      format: meta.format,
      space: meta.space,
      density: meta.density,
      hasAlpha: meta.hasAlpha,
      orientation: meta.orientation,
      exifBytes: meta.exif?.length ?? 0,
      iccBytes: meta.icc?.length ?? 0,
    }
  },
  {
    name: "image_exif",
    description: "Read image metadata and EXIF/ICC byte presence.",
    schema: z.object({ source: z.string().min(1) }),
  }
)

export const imageOcrTool = tool(
  async ({ source, language }) => {
    const tesseract = await loadTesseract()
    if (!tesseract?.createWorker) {
      return {
        type: "image_ocr",
        error: "OCR tooling requires optional dependency `tesseract.js`.",
      }
    }

    const worker = await tesseract.createWorker(language ?? "eng")
    try {
      const bytes = await fetchBuffer(source)
      const result = await worker.recognize(bytes)
      const data = result?.data ?? {}
      return {
        type: "image_ocr",
        language: language ?? "eng",
        confidence: data.confidence ?? null,
        text: truncateString(String(data.text ?? ""), 12000),
        lines: Array.isArray(data.lines)
          ? data.lines.slice(0, 80).map((line: { text?: string; confidence?: number }) => ({
              text: truncateString(String(line.text ?? ""), 500),
              confidence: line.confidence ?? null,
            }))
          : [],
      }
    } finally {
      await worker.terminate()
    }
  },
  {
    name: "image_ocr",
    description:
      "Extract text from a remote or data URL image using optional local OCR support (`tesseract.js`).",
    schema: z.object({
      source: z.string().min(1),
      language: z.string().min(2).max(20).optional(),
    }),
  }
)

export const imageDiffTool = tool(
  async ({ before, after }) => {
    const sharp = await loadSharp()
    if (!sharp) return { type: "image_diff", error: "Image tooling requires `sharp`." }
    const beforeImage = sharp(await fetchBuffer(before))
      .resize(256, 256, { fit: "contain", background: "white" })
      .raw()
    const afterImage = sharp(await fetchBuffer(after))
      .resize(256, 256, { fit: "contain", background: "white" })
      .raw()
    const [beforeBuffer, afterBuffer] = await Promise.all([
      beforeImage.toBuffer(),
      afterImage.toBuffer(),
    ])
    const length = Math.min(beforeBuffer.length, afterBuffer.length)
    let changed = 0
    let totalDelta = 0
    for (let index = 0; index < length; index += 1) {
      const delta = Math.abs(beforeBuffer[index] - afterBuffer[index])
      totalDelta += delta
      if (delta > 12) changed += 1
    }
    return {
      type: "image_diff",
      comparedBytes: length,
      changedBytes: changed,
      changedRatio: length ? changed / length : 0,
      averageDelta: length ? totalDelta / length : 0,
    }
  },
  {
    name: "image_diff",
    description: "Compute a lightweight pixel difference between two images.",
    schema: z.object({ before: z.string().min(1), after: z.string().min(1) }),
  }
)

export const svgOptimizeTool = tool(
  async ({ path: filePath, svg }) => {
    const input = svg ?? (await readWorkspaceText(filePath!))
    const optimized = input
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/>\s+</g, "><")
      .replace(/\s{2,}/g, " ")
      .trim()
    return {
      type: "svg_optimize",
      path: filePath,
      originalBytes: Buffer.byteLength(input),
      optimizedBytes: Buffer.byteLength(optimized),
      optimized,
    }
  },
  {
    name: "svg_optimize",
    description: "Minify SVG text without changing files.",
    schema: z
      .object({ path: z.string().optional(), svg: z.string().optional() })
      .refine((value) => value.path || value.svg, { message: "Provide path or svg" }),
  }
)

export const assetManifestTool = tool(
  async ({ path: inputPath }) => {
    const { files } = await collectWorkspaceFiles({
      path: inputPath,
      maxFiles: 3000,
      extensions: [
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".gif",
        ".svg",
        ".ico",
        ".woff",
        ".woff2",
        ".ttf",
        ".otf",
      ],
    })
    return {
      type: "asset_manifest",
      assets: files.map(({ path, size, modified }) => ({ path, size, modified })).slice(0, 1000),
      count: files.length,
    }
  },
  {
    name: "asset_manifest",
    description: "List image/font/static assets in the workspace.",
    schema: z.object({ path: z.string().optional() }),
  }
)

export const artifactListTool = tool(
  async () => {
    await ensureWorkspaceDirs()
    const dir = getArtifactsDir()
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
    const artifacts = await Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .slice(0, 500)
        .map(async (entry) => {
          const info = await stat(path.join(dir, entry.name))
          return {
            name: entry.name,
            url: `/api/artifacts/${entry.name}`,
            size: info.size,
            modified: info.mtime.toISOString(),
          }
        })
    )
    return { type: "artifact_list", artifacts }
  },
  { name: "artifact_list", description: "List stored Rekdin artifacts.", schema: z.object({}) }
)

export const artifactReadTool = tool(
  async ({ artifact }) => {
    const name = parseArtifactName(artifact)
    const artifactsDir = getArtifactsDir()
    const fullPath = path.join(artifactsDir, name)
    const relative = path.relative(path.resolve(artifactsDir), path.resolve(fullPath))
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("Artifact path escapes artifact directory")
    }
    const info = await stat(fullPath)
    const bytes = await readFile(fullPath)
    const textLike = /\.(txt|md|json|csv|html|xml|svg)$/i.test(name)
    return {
      type: "artifact_read",
      artifact,
      name,
      size: info.size,
      content: textLike ? truncateString(bytes.toString("utf-8"), 12000) : undefined,
      base64: textLike ? undefined : bytes.toString("base64").slice(0, 12000),
      truncated: !textLike && bytes.length > 9000,
    }
  },
  {
    name: "artifact_read",
    description: "Read a stored artifact by URL or filename.",
    schema: z.object({ artifact: z.string().min(1) }),
  }
)

export const artifactDeleteTool = tool(
  async ({ artifact }) => {
    const name = parseArtifactName(artifact)
    const artifactsDir = getArtifactsDir()
    const fullPath = path.join(artifactsDir, name)
    const relative = path.relative(path.resolve(artifactsDir), path.resolve(fullPath))
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("Artifact path escapes artifact directory")
    }
    await unlink(fullPath)
    return { type: "artifact_delete", artifact, deleted: true }
  },
  {
    name: "artifact_delete",
    description: "Delete a stored Rekdin artifact.",
    schema: z.object({ artifact: z.string().min(1) }),
  }
)

/**
 * Fetches Open Graph and meta tag data for a URL preview.
 */
export const linkPreviewTool = tool(
  async ({ url }) => {
    const res = await fetch(url, { headers: { "User-Agent": "Rekdin/NextJS" } })
    if (!res.ok) {
      return { type: "link_preview", url, error: `Failed to fetch (${res.status})` }
    }
    const html = await res.text()
    const dom = new JSDOM(html, { url })
    const doc = dom.window.document
    const title =
      doc.querySelector("meta[property='og:title']")?.getAttribute("content") || doc.title
    const description =
      doc.querySelector("meta[property='og:description']")?.getAttribute("content") ||
      doc.querySelector("meta[name='description']")?.getAttribute("content") ||
      ""
    const image =
      doc.querySelector("meta[property='og:image']")?.getAttribute("content") ||
      doc.querySelector("meta[name='twitter:image']")?.getAttribute("content") ||
      ""
    return { type: "link_preview", url, title, description, image }
  },
  {
    name: "link_preview",
    description: "Fetch lightweight metadata (title/description/image) for a URL.",
    schema: z.object({ url: z.string().url() }),
  }
)

/**
 * Looks up npm registry metadata and recent download counts for a package.
 */
export const npmPackageInfoTool = tool(
  async ({ name }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await fetchJson<any>(`https://registry.npmjs.org/${encodeURIComponent(name)}`)
    const latest = data["dist-tags"]?.latest
    const latestInfo = latest ? data.versions?.[latest] : null
    const weekly =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await fetchJson<any>(
        `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name)}`
      )
    return {
      type: "npm_package_info",
      name,
      latest,
      license: latestInfo?.license ?? latestInfo?.licenses ?? null,
      description: latestInfo?.description ?? data.description ?? "",
      homepage: latestInfo?.homepage ?? data.homepage ?? "",
      downloadsLastWeek: weekly?.downloads ?? null,
      repository: latestInfo?.repository ?? data.repository ?? null,
    }
  },
  {
    name: "npm_package_info",
    description: "Fetch npm package metadata (version, license, downloads).",
    schema: z.object({ name: z.string().min(1) }),
  }
)

/**
 * Returns recent git commits in compact one-line form.
 */
export const gitLogSummaryTool = tool(
  async ({ limit }) => {
    const count = Math.min(Math.max(limit ?? 10, 1), 50)
    const res = await runCommandUnsafe(`git log -${count} --oneline`, getWorkspaceRoot(), 10000)
    return {
      type: "git_log_summary",
      limit: count,
      output: res.stdout.trim(),
      exitCode: res.exitCode,
    }
  },
  {
    name: "git_log_summary",
    description: "Show recent git commits (oneline).",
    schema: z.object({ limit: z.number().int().min(1).max(50).optional() }),
  }
)

/**
 * Lists local and remote git branches for repository inspection.
 */
export const gitBranchesTool = tool(
  async () => {
    const res = await runCommandUnsafe("git branch --all", getWorkspaceRoot(), 10000)
    return { type: "git_branches", output: res.stdout.trim(), exitCode: res.exitCode }
  },
  {
    name: "git_branches",
    description: "List local and remote git branches.",
    schema: z.object({}),
  }
)

/**
 * Returns git status and diff, or the patch for a specific commit/ref.
 */
export const gitDiffSummaryTool = tool(
  async ({ path: filePath, commit }) => {
    if (commit) {
      // Show a specific commit's changes with full diff
      const safeCommit = commit.replace(/[^a-zA-Z0-9_.~^-]/g, "")
      const show = await runCommandUnsafe(
        `git show ${safeCommit} --stat --patch`,
        getWorkspaceRoot(),
        15000
      )
      const firstLine = show.stdout.indexOf("\n")
      return {
        type: "git_diff_summary",
        status: show.stdout.slice(0, firstLine).trim(), // commit header as status
        diff: show.stdout.slice(firstLine + 1).trim(),
        commit: safeCommit,
      }
    }
    const safePath = filePath
      ? path.relative(getWorkspaceRoot(), resolveWorkspacePath(filePath))
      : ""
    const escapedPath = safePath.replace(/'/g, "'\"'\"'")
    const pathArg = escapedPath ? ` -- '${escapedPath}'` : ""
    const status = await runCommandUnsafe("git status --short" + pathArg, getWorkspaceRoot(), 10000)
    const diff = await runCommandUnsafe("git diff" + pathArg, getWorkspaceRoot(), 10000)
    return {
      type: "git_diff_summary",
      status: status.stdout.trim(),
      diff: diff.stdout.trim(),
    }
  },
  {
    name: "git_diff_summary",
    description:
      "Show git status and diff for the working directory. Pass `path` to scope to a file. Pass `commit` (hash or ref) to show a specific commit's changes via git show.",
    schema: z.object({
      path: z.string().optional(),
      commit: z.string().optional(),
    }),
  }
)

/**
 * Parses git blame porcelain output into structured per-line authorship data.
 */
export const gitBlameTool = tool(
  async ({ path: filePath }) => {
    const safe = path
      .relative(getWorkspaceRoot(), resolveWorkspacePath(filePath))
      .replace(/'/g, "'\"'\"'")
    const res = await runCommandUnsafe(
      `git blame --line-porcelain -- '${safe}'`,
      getWorkspaceRoot(),
      15000
    )
    if (res.exitCode !== 0) {
      return { type: "git_blame", path: filePath, lines: [], error: res.stderr.trim() }
    }
    // Parse porcelain output into structured lines
    const lines: { hash: string; author: string; date: string; lineNo: number; text: string }[] = []
    const chunks = res.stdout.split(/^([0-9a-f]{40}) /m).slice(1)
    for (let i = 0; i < chunks.length; i += 2) {
      const hash = chunks[i]?.trim().slice(0, 7) ?? ""
      const block = chunks[i + 1] ?? ""
      const blockLines = block.split("\n")
      const author = blockLines.find((l) => l.startsWith("author "))?.slice(7) ?? ""
      const epoch = blockLines.find((l) => l.startsWith("author-time "))?.slice(12) ?? ""
      const date = epoch ? new Date(Number(epoch) * 1000).toISOString().slice(0, 10) : ""
      const lineNoLine = blockLines.find((l) => /^\d+ \d+ \d+/.test(l)) ?? ""
      const lineNo = Number(lineNoLine.split(" ")[1] ?? "0")
      const text = blockLines.find((l) => l.startsWith("\t"))?.slice(1) ?? ""
      lines.push({ hash, author, date, lineNo, text })
    }
    return { type: "git_blame", path: filePath, lines }
  },
  {
    name: "git_blame",
    description: "Show who last modified each line of a file (git blame).",
    schema: z.object({ path: z.string().min(1) }),
  }
)

/**
 * Shows the commit history for a file, following renames.
 */
export const gitFileHistoryTool = tool(
  async ({ path: filePath, limit }) => {
    const safe = path
      .relative(getWorkspaceRoot(), resolveWorkspacePath(filePath))
      .replace(/'/g, "'\"'\"'")
    const n = Math.min(Math.max(limit ?? 20, 1), 100)
    const res = await runCommandUnsafe(
      `git log --follow --oneline -n ${n} -- '${safe}'`,
      getWorkspaceRoot(),
      10000
    )
    return {
      type: "git_file_history",
      path: filePath,
      output: res.stdout.trim(),
      exitCode: res.exitCode,
    }
  },
  {
    name: "git_file_history",
    description:
      "Show the commit history for a specific file, following renames (git log --follow).",
    schema: z.object({
      path: z.string().min(1),
      limit: z.number().int().min(1).max(100).optional(),
    }),
  }
)

export const gitStatusTool = tool(
  async () => {
    const res = await runCommandUnsafe("git status --short --branch", getWorkspaceRoot(), 10000)
    return { type: "git_status", output: res.stdout.trim(), exitCode: res.exitCode }
  },
  {
    name: "git_status",
    description: "Show compact git branch and working tree status.",
    schema: z.object({}),
  }
)

export const gitChangedFilesTool = tool(
  async () => {
    const res = await runCommandUnsafe("git status --porcelain=v1", getWorkspaceRoot(), 10000)
    const files = res.stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => ({ status: line.slice(0, 2), path: line.slice(3).trim() }))
    return { type: "git_changed_files", files, exitCode: res.exitCode }
  },
  {
    name: "git_changed_files",
    description: "List changed files with porcelain status codes.",
    schema: z.object({}),
  }
)

export const gitStagedDiffTool = tool(
  async ({ path: filePath }) => {
    const safePath = filePath
      ? path.relative(getWorkspaceRoot(), resolveWorkspacePath(filePath))
      : ""
    const pathArg = safePath ? ` -- ${safeShellArg(safePath)}` : ""
    const res = await runCommandUnsafe(`git diff --cached${pathArg}`, getWorkspaceRoot(), 15000)
    return {
      type: "git_staged_diff",
      path: filePath,
      diff: truncateString(res.stdout, 12000),
      exitCode: res.exitCode,
    }
  },
  {
    name: "git_staged_diff",
    description: "Show staged git diff, optionally scoped to a file.",
    schema: z.object({ path: z.string().optional() }),
  }
)

export const gitShowTool = tool(
  async ({ ref, path: filePath }) => {
    const safeRef = ref.replace(/[^a-zA-Z0-9_.~^:/-]/g, "")
    const safePath = filePath
      ? path.relative(getWorkspaceRoot(), resolveWorkspacePath(filePath))
      : ""
    const pathArg = safePath ? ` -- ${safeShellArg(safePath)}` : ""
    const res = await runCommandUnsafe(
      `git show --stat --patch ${safeRef}${pathArg}`,
      getWorkspaceRoot(),
      15000
    )
    return {
      type: "git_show",
      ref: safeRef,
      path: filePath,
      output: truncateString(res.stdout, 16000),
      exitCode: res.exitCode,
      error: res.stderr.trim(),
    }
  },
  {
    name: "git_show",
    description: "Show a git ref/commit with stat and patch.",
    schema: z.object({ ref: z.string().min(1), path: z.string().optional() }),
  }
)

export const gitCompareRefsTool = tool(
  async ({ base, head }) => {
    const safeBase = base.replace(/[^a-zA-Z0-9_.~^:/-]/g, "")
    const safeHead = head.replace(/[^a-zA-Z0-9_.~^:/-]/g, "")
    const res = await runCommandUnsafe(
      `git diff --stat --patch ${safeBase}..${safeHead}`,
      getWorkspaceRoot(),
      20000
    )
    return {
      type: "git_compare_refs",
      base: safeBase,
      head: safeHead,
      diff: truncateString(res.stdout, 20000),
      exitCode: res.exitCode,
      error: res.stderr.trim(),
    }
  },
  {
    name: "git_compare_refs",
    description: "Compare two git refs with stat and patch.",
    schema: z.object({ base: z.string().min(1), head: z.string().min(1) }),
  }
)

export const gitConflictsTool = tool(
  async () => {
    const res = await runCommandUnsafe(
      "git diff --name-only --diff-filter=U",
      getWorkspaceRoot(),
      10000
    )
    return {
      type: "git_conflicts",
      files: res.stdout.split(/\r?\n/).filter(Boolean),
      exitCode: res.exitCode,
    }
  },
  {
    name: "git_conflicts",
    description: "List files with unresolved git merge conflicts.",
    schema: z.object({}),
  }
)

export const gitTagsTool = tool(
  async ({ limit }) => {
    const n = Math.min(Math.max(limit ?? 50, 1), 200)
    const res = await runCommandUnsafe(
      `git tag --sort=-creatordate | head -n ${n}`,
      getWorkspaceRoot(),
      10000
    )
    return {
      type: "git_tags",
      tags: res.stdout.split(/\r?\n/).filter(Boolean),
      exitCode: res.exitCode,
    }
  },
  {
    name: "git_tags",
    description: "List recent git tags.",
    schema: z.object({ limit: z.number().int().min(1).max(200).optional() }),
  }
)

export const gitRemoteInfoTool = tool(
  async () => {
    const remotes = await runCommandUnsafe("git remote -v", getWorkspaceRoot(), 10000)
    const branch = await runCommandUnsafe("git branch -vv", getWorkspaceRoot(), 10000)
    return {
      type: "git_remote_info",
      remotes: remotes.stdout.trim(),
      branches: branch.stdout.trim(),
      exitCode: remotes.exitCode || branch.exitCode,
    }
  },
  {
    name: "git_remote_info",
    description: "Show git remotes and branch tracking info.",
    schema: z.object({}),
  }
)

export const gitCommitSearchTool = tool(
  async ({ query, limit }) => {
    const n = Math.min(Math.max(limit ?? 20, 1), 100)
    const res = await runCommandUnsafe(
      `git log --all --grep=${safeShellArg(query)} --oneline -n ${n}`,
      getWorkspaceRoot(),
      10000
    )
    return {
      type: "git_commit_search",
      query,
      commits: res.stdout.split(/\r?\n/).filter(Boolean),
      exitCode: res.exitCode,
    }
  },
  {
    name: "git_commit_search",
    description: "Search git commit messages.",
    schema: z.object({
      query: z.string().min(1),
      limit: z.number().int().min(1).max(100).optional(),
    }),
  }
)

export const gitPatchPreviewTool = tool(
  async ({ path: filePath, newContent }) => {
    const oldContent = await readWorkspaceText(filePath)
    return {
      type: "git_patch_preview",
      path: filePath,
      diff: createPatch(filePath, oldContent, newContent, "before", "after"),
    }
  },
  {
    name: "git_patch_preview",
    description: "Create a unified diff preview for replacing one workspace file.",
    schema: z.object({ path: z.string().min(1), newContent: z.string() }),
  }
)

export const gitApplyPatchTool = tool(
  async ({ patch, checkOnly }) => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "rekdin-patch-"))
    const patchPath = path.join(tempDir, "change.patch")
    try {
      await writeFile(patchPath, patch, "utf-8")
      const command = `git apply ${checkOnly ? "--check " : ""}${safeShellArg(patchPath)}`
      const res = await runCommandUnsafe(command, getWorkspaceRoot(), 20000)
      return {
        type: "git_apply_patch",
        checkOnly: checkOnly ?? false,
        applied: !checkOnly && res.exitCode === 0,
        exitCode: res.exitCode,
        stdout: truncateString(res.stdout, 4000),
        stderr: truncateString(res.stderr, 4000),
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {})
    }
  },
  {
    name: "git_apply_patch",
    description:
      "Apply or validate a unified patch with git apply. Mutates files when checkOnly is false.",
    schema: z.object({ patch: z.string().min(1), checkOnly: z.boolean().optional() }),
  }
)

export const sessionListTool = tool(
  async ({ limit }: { limit?: number }) => {
    const limitValue = boundedLimit(limit, 20, 100)
    const sessions = await getSessionStore().listSessions()
    const selected = sessions.slice(0, limitValue)
    return {
      type: "session_list",
      totalSessions: sessions.length,
      sessions: selected.map((session) => {
        const messages = session.messages ?? []
        const toolCalls = messages.flatMap(getMessageToolCalls)
        const lastUser = lastDefined(messages, (message) => message.role === "user")
        const lastAssistant = lastDefined(messages, (message) => message.role === "assistant")
        const metadataMessage = lastDefined(messages, (message) =>
          Boolean(message.metadata?.model || message.metadata?.toolPolicy)
        )
        return {
          id: session.id,
          title: session.title,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          messageCount: session.metadata?.messageCount ?? messages.length,
          totalTokens: session.metadata?.totalTokens ?? 0,
          model: metadataMessage?.metadata?.model ?? session.metadata?.model,
          agentType: metadataMessage?.metadata?.agentType,
          toolPolicy: metadataMessage?.metadata?.toolPolicy,
          workflowId: metadataMessage?.metadata?.workflowId,
          lastUserPromptPreview: lastUser ? previewString(lastUser.content, 360) : "",
          finalAnswerPreview: lastAssistant ? previewString(lastAssistant.content, 360) : "",
          toolCallCount: toolCalls.length,
          failedToolCallCount: toolCalls.filter((call) => call.status === "error").length,
        }
      }),
      omittedSessions: Math.max(sessions.length - selected.length, 0),
    }
  },
  {
    name: "session_list",
    description:
      "List recent Rekdin chat sessions with compact metadata, prompt previews, token totals, and tool-call counts.",
    schema: z.object({
      limit: z.number().int().positive().max(100).optional(),
    }),
  }
)

export const sessionInspectTool = tool(
  async ({ sessionId, messageLimit }: { sessionId: string; messageLimit?: number }) => {
    const limitValue = boundedLimit(messageLimit, 20, 100)
    const session = await getSessionStore().getSession(sessionId)
    if (!session) {
      return {
        type: "session_inspect",
        sessionId,
        found: false,
        error: "Session not found.",
      }
    }

    const messages = session.messages ?? []
    const selectedMessages = messages.slice(-limitValue)
    const toolCalls = messages.flatMap(getMessageToolCalls)
    const finalAssistant = lastDefined(messages, (message) => message.role === "assistant")
    return {
      type: "session_inspect",
      sessionId,
      found: true,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messageCount: messages.length,
      returnedMessageCount: selectedMessages.length,
      omittedMessages: Math.max(messages.length - selectedMessages.length, 0),
      totalTokens: session.metadata?.totalTokens ?? 0,
      model: session.metadata?.model,
      attachmentCount: messages.reduce(
        (total, message) => total + (message.attachments?.length ?? 0),
        0
      ),
      toolCallCount: toolCalls.length,
      toolCallStatusCounts: countBy(toolCalls.map((call) => call.status)),
      toolCallNameCounts: countBy(toolCalls.map((call) => call.name)),
      finalAnswerPreview: finalAssistant ? previewString(finalAssistant.content, 700) : "",
      messages: selectedMessages.map(compactMessage),
    }
  },
  {
    name: "session_inspect",
    description:
      "Inspect one Rekdin session with compact message previews, metadata, attachments, tool-call counts, and final-answer preview.",
    schema: z.object({
      sessionId: z.string().min(1),
      messageLimit: z.number().int().positive().max(100).optional(),
    }),
  }
)

export const replaySummaryTool = tool(
  async ({ sessionId }: { sessionId: string }) => {
    const replay = await getReplayStore().getReplay(sessionId)
    if (!replay) {
      return {
        type: "replay_summary",
        sessionId,
        found: false,
        error: "Replay not found.",
      }
    }

    const toolTimeline = replay.events
      .filter((event) => event.type === "tool_result")
      .map((event) => compactReplayEvent(event))
    const warnings = replay.events
      .filter((event) => {
        const data = event.data ?? {}
        return typeof data.warning === "string" || typeof data.error === "string"
      })
      .slice(0, 20)
      .map(compactReplayEvent)
    return {
      type: "replay_summary",
      sessionId,
      found: true,
      startTime: replay.startTime,
      endTime: replay.endTime,
      durationMs: replay.endTime - replay.startTime,
      eventCount: replay.events.length,
      eventTypeCounts: countBy(replay.events.map((event) => event.type)),
      metadata: replay.metadata,
      toolTimeline: toolTimeline.slice(0, 60),
      omittedToolTimeline: Math.max(toolTimeline.length - 60, 0),
      failedTools: toolTimeline.filter((event) => event.status === "error").slice(0, 20),
      warnings,
      slowestSteps: [...toolTimeline]
        .filter((event) => typeof event.duration === "number")
        .sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0))
        .slice(0, 10),
    }
  },
  {
    name: "replay_summary",
    description:
      "Summarize one Rekdin replay into event counts, duration, tool timeline, failed tools, warnings, and slowest steps.",
    schema: z.object({
      sessionId: z.string().min(1),
    }),
  }
)

export const replaySearchTool = tool(
  async ({
    sessionId,
    query,
    eventType,
    toolName,
    status,
    limit,
  }: {
    sessionId: string
    query?: string
    eventType?: string
    toolName?: string
    status?: string
    limit?: number
  }) => {
    const replay = await getReplayStore().getReplay(sessionId)
    if (!replay) {
      return {
        type: "replay_search",
        sessionId,
        found: false,
        error: "Replay not found.",
      }
    }

    const limitValue = boundedLimit(limit, 30, 100)
    const normalizedQuery = query?.trim().toLowerCase()
    const matches = replay.events.filter((event) => {
      const call = replayToolCall(event)
      if (eventType && event.type !== eventType) return false
      if (toolName && call?.name !== toolName) return false
      if (status && call?.status !== status) return false
      if (!normalizedQuery) return true
      return replayEventText(event).toLowerCase().includes(normalizedQuery)
    })
    const selected = matches.slice(0, limitValue)
    return {
      type: "replay_search",
      sessionId,
      found: true,
      query: query ?? "",
      eventType,
      toolName,
      status,
      totalMatches: matches.length,
      matches: selected.map(compactReplayEvent),
      omittedMatches: Math.max(matches.length - selected.length, 0),
    }
  },
  {
    name: "replay_search",
    description:
      "Search one Rekdin replay by event type, tool name, status, or text query and return compact event previews.",
    schema: z.object({
      sessionId: z.string().min(1),
      query: z.string().optional(),
      eventType: z.string().optional(),
      toolName: z.string().optional(),
      status: z.string().optional(),
      limit: z.number().int().positive().max(100).optional(),
    }),
  }
)

export const traceSummaryTool = tool(
  async ({ sessionId, limit }: { sessionId: string; limit?: number }) => {
    const limitValue = boundedLimit(limit, 20, 100)
    const traces = await getTraceStore().list(sessionId)
    const selected = traces.slice(-limitValue)
    const warnings = traces.flatMap((trace) => trace.warnings)
    return {
      type: "trace_summary",
      sessionId,
      traceCount: traces.length,
      returnedTraceCount: selected.length,
      omittedTraces: Math.max(traces.length - selected.length, 0),
      successCount: traces.filter((trace) => trace.success).length,
      failureCount: traces.filter((trace) => !trace.success).length,
      providerCounts: countBy(traces.map((trace) => trace.provider)),
      modelCounts: countBy(traces.map((trace) => trace.model)),
      workflowCounts: countBy(traces.map((trace) => trace.workflowId ?? "none")),
      totalToolCount: traces.reduce((total, trace) => total + trace.toolCount, 0),
      totalToolDurationMs: traces.reduce(
        (total, trace) => total + (trace.totalToolDurationMs ?? 0),
        0
      ),
      totalRetries: traces.reduce((total, trace) => total + trace.retryCount, 0),
      warnings: warnings.slice(0, 20).map((warning) => previewString(warning, 240)),
      omittedWarnings: Math.max(warnings.length - 20, 0),
      errors: traces
        .filter((trace) => trace.error)
        .slice(0, 20)
        .map((trace) => ({
          traceId: trace.id,
          startedAt: trace.startedAt,
          error: previewString(trace.error, 360),
        })),
      tokenUsage: aggregateTokenUsage(traces),
      traces: selected.map(compactTrace),
    }
  },
  {
    name: "trace_summary",
    description:
      "Summarize runtime traces for one session with provider/model, duration, tools, token estimates, retries, warnings, and errors.",
    schema: z.object({
      sessionId: z.string().min(1),
      limit: z.number().int().positive().max(100).optional(),
    }),
  }
)

export const tokenUsageReportTool = tool(
  async ({ sessionId, limit }: { sessionId?: string; limit?: number }) => {
    const limitValue = boundedLimit(limit, 20, 100)
    const sessions = sessionId
      ? [await getSessionStore().getSession(sessionId)].filter((session) => Boolean(session))
      : (await getSessionStore().listSessions()).slice(0, limitValue)
    const allTraces: TurnTrace[] = []
    const bySession = []

    for (const session of sessions) {
      if (!session) continue
      const traces = await getTraceStore().list(session.id)
      allTraces.push(...traces)
      bySession.push({
        sessionId: session.id,
        title: session.title,
        updatedAt: session.updatedAt,
        sessionTotalTokens: session.metadata?.totalTokens ?? 0,
        messageCount: session.metadata?.messageCount ?? session.messages.length,
        traceCount: traces.length,
        traceTokenUsage: aggregateTokenUsage(traces),
      })
    }

    return {
      type: "token_usage_report",
      sessionId: sessionId ?? null,
      sessionCount: bySession.length,
      traceCount: allTraces.length,
      totalSessionTokens: bySession.reduce(
        (total, session) => total + session.sessionTotalTokens,
        0
      ),
      traceTokenUsage: aggregateTokenUsage(allTraces),
      bySession,
    }
  },
  {
    name: "token_usage_report",
    description:
      "Aggregate trace/session token metadata across recent sessions or one session without dumping message bodies.",
    schema: z.object({
      sessionId: z.string().min(1).optional(),
      limit: z.number().int().positive().max(100).optional(),
    }),
  }
)

export const backgroundJobsSummaryTool = tool(
  async ({ sessionId, limit }: { sessionId?: string; limit?: number }) => {
    const limitValue = boundedLimit(limit, 20, 100)
    const jobs = sessionId
      ? await getBackgroundJobStore().listBySession(sessionId)
      : await getBackgroundJobStore().list()
    const selected = jobs.slice(0, limitValue)
    return {
      type: "background_jobs_summary",
      sessionId: sessionId ?? null,
      totalJobs: jobs.length,
      statusCounts: countBy(jobs.map((job) => job.status)),
      workflowCounts: countBy(jobs.map((job) => job.workflowId ?? "none")),
      jobs: selected.map(compactBackgroundJob),
      omittedJobs: Math.max(jobs.length - selected.length, 0),
    }
  },
  {
    name: "background_jobs_summary",
    description:
      "List Rekdin background jobs globally or by session with status, workflow, timestamps, error preview, and prompt preview.",
    schema: z.object({
      sessionId: z.string().min(1).optional(),
      limit: z.number().int().positive().max(100).optional(),
    }),
  }
)

export const settingsSummaryTool = tool(
  async () => {
    const settings = await getSettingsStore().load()
    const allWorkflows = getAllWorkflowPresets(settings.customWorkflows)
    const customWorkflows = settings.customWorkflows.slice(0, 20).map((workflow) => ({
      id: workflow.id,
      title: workflow.title,
      mode: workflow.mode,
      toolPolicy: workflow.toolPolicy,
      category: workflow.category,
      supportsBackground: Boolean(workflow.supportsBackground),
      responseSchemaConfigured: Boolean(workflow.responseSchema),
      promptChars: workflow.prompt.length,
    }))
    return {
      type: "settings_summary",
      currentSessionId: settings.currentSessionId ?? null,
      workspaceRoot: settings.workspaceRoot,
      selectedProvider: settings.llmProvider,
      selectedProviderLabel: getProviderLabel(settings.llmProvider),
      selectedProviderReady: settingsHaveProviderCredentials(settings),
      selectedModel: getProviderModel(settings.llmProvider, settings) || null,
      liveModeEnabled: settings.liveModeEnabled,
      uploads: {
        cloudinaryConfigured: Boolean(
          settings.cloudinaryCloudName && settings.cloudinaryApiKey && settings.cloudinaryApiSecret
        ),
        cloudNameConfigured: Boolean(settings.cloudinaryCloudName),
        apiKeyConfigured: Boolean(settings.cloudinaryApiKey),
        apiSecretConfigured: Boolean(settings.cloudinaryApiSecret),
      },
      providers: configuredProviderSummary(settings),
      workflows: {
        builtInCount: allWorkflows.filter((workflow) => !workflow.custom).length,
        customCount: settings.customWorkflows.length,
        totalCount: allWorkflows.length,
        customWorkflows,
        omittedCustomWorkflows: Math.max(
          settings.customWorkflows.length - customWorkflows.length,
          0
        ),
      },
      redaction: {
        credentials: "redacted",
        providerSecretsIncluded: false,
        uploadSecretsIncluded: false,
      },
    }
  },
  {
    name: "settings_summary",
    description:
      "Return redacted Rekdin runtime settings: selected provider/model presence, workspace root, uploads, workflows, and feature flags.",
    schema: z.object({}),
  }
)

export const npmScriptsTool = tool(
  async () => {
    const pkg = await readPackageJson()
    return {
      type: "npm_scripts",
      scripts: (pkg?.scripts as Record<string, string> | undefined) ?? {},
    }
  },
  { name: "npm_scripts", description: "List package.json scripts.", schema: z.object({}) }
)

export const runNpmScriptTool = tool(
  async ({ script, timeoutMs }) => {
    const res = await runPackageCommand(script, timeoutMs ?? 120000)
    return {
      type: "run_npm_script",
      script,
      exitCode: res.exitCode,
      stdout: truncateString(res.stdout, 12000),
      stderr: truncateString(res.stderr, 8000),
      duration: res.duration,
    }
  },
  {
    name: "run_npm_script",
    description: "Run a package.json script in the workspace.",
    schema: z.object({
      script: z.string().min(1),
      timeoutMs: z.number().int().min(1000).max(300000).optional(),
    }),
  }
)

function createScriptWrapperTool(
  name: string,
  scriptCandidates: string[],
  description: string,
  timeoutMs: number
) {
  return tool(
    async () => {
      const scripts =
        ((await readPackageJson())?.scripts as Record<string, string> | undefined) ?? {}
      const script = scriptCandidates.find((candidate) => scripts[candidate])
      if (!script)
        return { type: name, error: `No matching script found: ${scriptCandidates.join(", ")}` }
      const res = await runPackageCommand(script, timeoutMs)
      return {
        type: name,
        script,
        exitCode: res.exitCode,
        stdout: truncateString(res.stdout, 12000),
        stderr: truncateString(res.stderr, 8000),
        duration: res.duration,
      }
    },
    { name, description, schema: z.object({}) }
  )
}

export const typecheckProjectTool = createScriptWrapperTool(
  "typecheck_project",
  ["typecheck", "tsc"],
  "Run the project typecheck script.",
  180000
)
export const lintProjectTool = createScriptWrapperTool(
  "lint_project",
  ["lint"],
  "Run the project lint script.",
  180000
)
export const testProjectTool = createScriptWrapperTool(
  "test_project",
  ["test"],
  "Run the project test script.",
  180000
)
export const formatCheckTool = createScriptWrapperTool(
  "format_check",
  ["format:check", "prettier:check"],
  "Run the project formatting check script.",
  180000
)
export const buildProjectTool = createScriptWrapperTool(
  "build_project",
  ["build"],
  "Run the project production build script.",
  300000
)

export const devServerStartTool = tool(
  async ({ script, port }) => {
    const key = `${script ?? "dev"}:${port ?? ""}`
    const existing = DEV_SERVERS.get(key)
    if (existing && !existing.child.killed)
      return {
        type: "dev_server_start",
        key,
        status: "already_running",
        port: existing.port,
        startedAt: existing.startedAt,
      }
    const pkg = await readPackageJson()
    const scripts = (pkg?.scripts as Record<string, string> | undefined) ?? {}
    const scriptName = script ?? "dev"
    if (!scripts[scriptName]) throw new Error(`package.json script not found: ${scriptName}`)
    const child = spawn(
      "npm",
      ["run", scriptName, ...(port ? ["--", "--port", String(port)] : [])],
      {
        cwd: getWorkspaceRoot(),
        env: process.env,
        stdio: "ignore",
        detached: true,
      }
    )
    DEV_SERVERS.set(key, {
      child,
      startedAt: new Date().toISOString(),
      command: `npm run ${scriptName}`,
      port,
      cwd: getWorkspaceRoot(),
    })
    child.unref()
    return { type: "dev_server_start", key, status: "started", script: scriptName, port }
  },
  {
    name: "dev_server_start",
    description: "Start a package.json dev server in the background.",
    schema: z.object({
      script: z.string().optional(),
      port: z.number().int().min(1).max(65535).optional(),
    }),
  }
)

export const devServerStopTool = tool(
  async ({ key }) => {
    const entries = key ? [[key, DEV_SERVERS.get(key)] as const] : Array.from(DEV_SERVERS.entries())
    const stopped: string[] = []
    for (const [entryKey, entry] of entries) {
      if (!entry) continue
      entry.child.kill("SIGTERM")
      DEV_SERVERS.delete(entryKey)
      stopped.push(entryKey)
    }
    return { type: "dev_server_stop", stopped }
  },
  {
    name: "dev_server_stop",
    description: "Stop Rekdin-started dev servers.",
    schema: z.object({ key: z.string().optional() }),
  }
)

export const devServerStatusTool = tool(
  async () => ({
    type: "dev_server_status",
    servers: Array.from(DEV_SERVERS.entries()).map(([key, value]) => ({
      key,
      startedAt: value.startedAt,
      command: value.command,
      port: value.port,
      killed: value.child.killed,
    })),
  }),
  {
    name: "dev_server_status",
    description: "List Rekdin-started dev servers.",
    schema: z.object({}),
  }
)

export const portProbeTool = tool(
  async ({ port, host }) => {
    const started = Date.now()
    try {
      const res = await fetch(`http://${host ?? "127.0.0.1"}:${port}`, { method: "HEAD" })
      return {
        type: "port_probe",
        port,
        host: host ?? "127.0.0.1",
        open: true,
        status: res.status,
        duration: Date.now() - started,
      }
    } catch (err) {
      return {
        type: "port_probe",
        port,
        host: host ?? "127.0.0.1",
        open: false,
        error: err instanceof Error ? err.message : "Probe failed",
        duration: Date.now() - started,
      }
    }
  },
  {
    name: "port_probe",
    description: "Probe a local HTTP port.",
    schema: z.object({ port: z.number().int().min(1).max(65535), host: z.string().optional() }),
  }
)

export const httpHealthCheckTool = tool(
  async ({ url, timeoutMs }) => {
    const controller = new AbortController()
    const started = Date.now()
    const timer = setTimeout(() => controller.abort(), timeoutMs ?? 10000)
    try {
      const res = await fetch(url, { method: "GET", signal: controller.signal })
      return {
        type: "http_health_check",
        url,
        ok: res.ok,
        status: res.status,
        contentType: res.headers.get("content-type"),
        duration: Date.now() - started,
      }
    } catch (err) {
      return {
        type: "http_health_check",
        url,
        ok: false,
        error: err instanceof Error ? err.message : "Health check failed",
        duration: Date.now() - started,
      }
    } finally {
      clearTimeout(timer)
    }
  },
  {
    name: "http_health_check",
    description: "Check a URL and return status/latency metadata.",
    schema: z.object({
      url: z.string().url(),
      timeoutMs: z.number().int().min(1000).max(60000).optional(),
    }),
  }
)

/**
 * Creates a LaTeX-to-PDF tool with request-specific Cloudinary credentials.
 */
function createGenerateLatexPdfTool(context?: { headers?: HeadersInit }) {
  const cloudinaryConfig = parseCloudinaryConfig(context?.headers)
  return tool(
    async ({ filename, texContent }) => {
      const result = await compileLatexToPdf(
        texContent,
        filename ?? "document",
        cloudinaryConfig ?? undefined
      )
      return { type: "generate_latex_pdf", ...result }
    },
    {
      name: "generate_latex_pdf",
      description: "Generate a PDF from LaTeX.",
      schema: z.object({ filename: z.string().optional(), texContent: z.string().min(1) }),
    }
  )
}

const CODE_MAP_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"])
const CODE_MAP_MAX_FILE_BYTES = 1_000_000

function isLikelyReactComponentName(name: string) {
  return /^[A-Z][A-Za-z0-9]*$/.test(name)
}

async function readPackageMetadata() {
  try {
    const raw = await readFile(resolveWorkspacePath("package.json"), "utf-8")
    const parsed = JSON.parse(raw) as {
      name?: string
      scripts?: Record<string, string>
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    return {
      name: parsed.name,
      scripts: parsed.scripts ?? {},
      dependencies: Object.keys(parsed.dependencies ?? {}),
      devDependencies: Object.keys(parsed.devDependencies ?? {}),
    }
  } catch {
    return null
  }
}

async function collectCodeMapFiles({
  root,
  relativeRoot,
  maxDepth,
  maxFiles,
}: {
  root: string
  relativeRoot: string
  maxDepth: number
  maxFiles: number
}) {
  const files: Array<{ abs: string; rel: string; size: number }> = []
  const skipped: Array<{ path: string; reason: string }> = []

  async function visit(absPath: string, relPath: string, depth: number) {
    if (files.length >= maxFiles) return
    assertWorkspacePathAllowed(absPath)
    const info = await stat(absPath)

    if (info.isFile()) {
      const ext = path.extname(absPath)
      if (!CODE_MAP_EXTENSIONS.has(ext)) return
      if (info.size > CODE_MAP_MAX_FILE_BYTES) {
        skipped.push({
          path: relPath,
          reason: `File is larger than ${CODE_MAP_MAX_FILE_BYTES} bytes`,
        })
        return
      }
      files.push({ abs: absPath, rel: relPath || path.basename(absPath), size: info.size })
      return
    }

    if (!info.isDirectory() || depth >= maxDepth) return
    const entries = (await readdir(absPath, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name)
    )
    for (const entry of entries) {
      if (files.length >= maxFiles) break
      const childRel = relPath ? `${relPath}/${entry.name}` : entry.name
      if (entry.isDirectory() && isBlockedWorkspaceDirectoryName(entry.name)) {
        skipped.push({ path: childRel, reason: "Protected generated dependency/build directory" })
        continue
      }
      if (entry.isSymbolicLink()) {
        skipped.push({ path: childRel, reason: "Symlink skipped" })
        continue
      }
      await visit(path.join(absPath, entry.name), childRel, depth + 1)
    }
  }

  await visit(root, relativeRoot, 0)
  return { files, skipped, truncated: files.length >= maxFiles }
}

/**
 * Builds a bounded AST map of the workspace without sending full source text to the model.
 */
export const codeMapTool = tool(
  async ({ path: inputPath, maxFiles, maxDepth }) => {
    await ensureWorkspaceDirs()
    const target = inputPath ? resolveWorkspacePath(inputPath) : getWorkspaceRoot()
    const relativeRoot = inputPath?.replace(/^\.\//, "") ?? ""
    const limit = Math.min(Math.max(maxFiles ?? 120, 1), 500)
    const depthLimit = Math.min(Math.max(maxDepth ?? 6, 1), 12)
    const { files, skipped, truncated } = await collectCodeMapFiles({
      root: target,
      relativeRoot,
      maxDepth: depthLimit,
      maxFiles: limit,
    })
    const project = new Project({ skipFileDependencyResolution: true })
    const fileSummaries = files.map((file) => {
      try {
        const sourceFile = project.addSourceFileAtPath(file.abs)
        const functions = sourceFile
          .getFunctions()
          .map((fn) => fn.getName())
          .filter((name): name is string => Boolean(name))
        const classes = sourceFile.getClasses().map((cls) => cls.getName() ?? "(anonymous)")
        const interfaces = sourceFile.getInterfaces().map((node) => node.getName())
        const typeAliases = sourceFile.getTypeAliases().map((node) => node.getName())
        const enums = sourceFile.getEnums().map((node) => node.getName())
        const variables = sourceFile
          .getVariableDeclarations()
          .map((node) => node.getName())
          .filter(Boolean)
        const exported = Array.from(sourceFile.getExportedDeclarations().keys()).slice(0, 80)
        const components = [...functions, ...classes, ...variables].filter(
          isLikelyReactComponentName
        )

        return {
          path: file.rel,
          size: file.size,
          imports: sourceFile
            .getImportDeclarations()
            .map((decl) => decl.getModuleSpecifierValue())
            .slice(0, 80),
          exports: exported,
          symbols: {
            functions,
            classes,
            interfaces,
            typeAliases,
            enums,
            variables: variables.slice(0, 60),
          },
          reactComponents: components,
        }
      } catch (err) {
        return {
          path: file.rel,
          size: file.size,
          error: err instanceof Error ? err.message : "Unable to parse file",
        }
      }
    })

    return {
      type: "code_map",
      path: inputPath ?? ".",
      fileCount: files.length,
      truncated,
      skipped,
      package: await readPackageMetadata(),
      files: fileSummaries,
    }
  },
  {
    name: "code_map",
    description:
      "Inspect TypeScript/JavaScript repository structure using AST metadata without reading full source contents.",
    schema: z.object({
      path: z.string().optional(),
      maxFiles: z.number().int().min(1).max(500).optional(),
      maxDepth: z.number().int().min(1).max(12).optional(),
    }),
  }
)

/**
 * Reads a UTF-8 text file from the workspace.
 */
export const readFileTool = tool(
  async ({ path: filePath }) => {
    await ensureWorkspaceDirs()
    const resolved = resolveWorkspacePath(filePath)
    const content = await readFile(resolved, "utf-8")
    return { path: filePath, content, type: "file_read" }
  },
  {
    name: "file_read",
    description: "Read a UTF-8 text file from the AI workspace.",
    schema: z.object({ path: z.string() }),
  }
)

/**
 * Lists files and directories inside the workspace, optionally recursively.
 */
export const listFilesTool = tool(
  async ({ path: dirPath, recursive }) => {
    await ensureWorkspaceDirs()
    const gather = async (target: string, relative: string) => {
      assertWorkspacePathAllowed(target)
      const entries = await readdir(target, { withFileTypes: true })
      const output: Array<Record<string, unknown>> = []
      for (const entry of entries) {
        const relPath = relative ? `${relative}/${entry.name}` : entry.name
        const isProtectedDirectory =
          entry.isDirectory() &&
          isBlockedWorkspaceDirectoryName(entry.name) &&
          !protectedWorkspaceAccessAllowed()
        const abs = isProtectedDirectory
          ? path.join(target, entry.name)
          : resolveWorkspacePath(relPath)
        const info = await stat(abs)
        output.push({
          name: entry.name,
          path: relPath,
          type: entry.isDirectory() ? "directory" : "file",
          size: info.size,
          modified: info.mtime.toISOString(),
          protected: isProtectedDirectory,
          skipped: isProtectedDirectory,
          reason: isProtectedDirectory
            ? "Skipped by default because this generated dependency/build folder is expected to be large. Ask explicitly to inspect it and Rekdin will request approval."
            : undefined,
        })
        if (recursive && entry.isDirectory() && !isProtectedDirectory) {
          const nested = await gather(abs, relPath)
          output.push(...nested)
        }
      }
      return output
    }
    const base = dirPath ? resolveWorkspacePath(dirPath) : getWorkspaceRoot()
    const rel = dirPath?.replace(/^\.\//, "") ?? ""
    const files = await gather(base, rel)
    return { path: dirPath ?? ".", files, type: "list_files" }
  },
  {
    name: "list_files",
    description: "List files and folders inside the AI workspace.",
    schema: z.object({
      path: z.string().optional(),
      recursive: z.boolean().optional(),
    }),
  }
)

/**
 * Writes UTF-8 text to a workspace file and returns a diff when replacing content.
 */
export const writeFileTool = tool(
  async ({ path: filePath, content }) => {
    await ensureWorkspaceDirs()
    const resolved = resolveWorkspacePath(filePath)
    const oldContent = await readFile(resolved, "utf-8").catch(() => null)
    await writeFile(resolved, content, "utf-8")
    const diff =
      oldContent !== null
        ? createPatch(filePath, oldContent, content, "before", "after")
        : undefined
    return {
      path: filePath,
      bytes: Buffer.byteLength(content),
      downloadUrl: `/api/workspace/file?path=${encodeURIComponent(filePath)}`,
      diff,
      type: "write_file",
    }
  },
  {
    name: "write_file",
    description: "Write UTF-8 content to a file within the workspace.",
    schema: z.object({
      path: z.string(),
      content: z.string(),
    }),
  }
)

/**
 * Executes a shell command inside the workspace and returns stdout, stderr, and exit code.
 */
export const executeCommandTool = tool(
  async ({ command, cwd, timeout }) => {
    await ensureWorkspaceDirs()
    assertNoBlockedDirectoryReference(command)
    const workingDir = cwd ? resolveWorkspacePath(cwd) : getWorkspaceRoot()
    return await new Promise((resolve) => {
      const child = spawn(command, {
        shell: os.platform() === "win32" ? "powershell.exe" : "bash",
        cwd: workingDir,
        env: process.env,
      })
      const start = Date.now()
      let stdout = ""
      let stderr = ""
      let finished = false
      child.stdout.on("data", (chunk) => (stdout += chunk.toString()))
      child.stderr.on("data", (chunk) => (stderr += chunk.toString()))

      const timer = setTimeout(() => {
        if (finished) return
        child.kill("SIGTERM")
      }, timeout ?? 30000)

      child.on("close", (code) => {
        finished = true
        clearTimeout(timer)
        resolve({
          command,
          cwd: workingDir,
          exitCode: code ?? 0,
          stdout,
          stderr,
          duration: Date.now() - start,
          type: "execute_command",
        })
      })
    })
  },
  {
    name: "execute_command",
    description: "Execute a shell command inside the workspace.",
    schema: z.object({
      command: z.string(),
      cwd: z.string().optional(),
      timeout: z.number().optional(),
    }),
  }
)

/**
 * Builds the full LangChain tool list and filters it through an optional allowlist.
 */
export function createToolset(context?: { headers?: HeadersInit; allowedToolNames?: string[] }) {
  const generateLatexPdfTool = createGenerateLatexPdfTool(context)
  const markdownToPdfTool = createMarkdownToPdfTool(context)
  const tools = [
    // Content/API tools
    webSearchTool,
    searchBatchTool,
    visitUrlTool,
    fetchManyTool,
    httpRequestTool,
    downloadFetchTool,
    robotsTxtTool,
    sitemapFetchTool,
    rssFetchTool,
    pageMetadataBatchTool,
    pageDiffSnapshotTool,
    citationMetadataTool,
    domainInfoTool,
    githubRepoInfoTool,
    packageCompareTool,
    linkPreviewTool,
    npmPackageInfoTool,

    // Rekdin inspectability
    sessionListTool,
    sessionInspectTool,
    replaySummaryTool,
    replaySearchTool,
    traceSummaryTool,
    tokenUsageReportTool,
    backgroundJobsSummaryTool,
    settingsSummaryTool,

    // File system + search
    codeMapTool,
    fileStatTool,
    workspaceStatsTool,
    fileHeadTailTool,
    fileOutlineTool,
    symbolSearchTool,
    symbolReferencesTool,
    dependencyGraphTool,
    routeMapTool,
    testMapTool,
    configInventoryTool,
    envInventoryTool,
    lockfileSummaryTool,
    duplicateCodeCandidatesTool,
    deadCodeCandidatesTool,
    fileSearchTool,
    fileReplaceTool,
    jsonPatchTool,
    yamlPatchTool,
    archiveCreateTool,
    archiveExtractTool,
    readFileTool,
    listFilesTool,
    writeFileTool,

    // Browser
    browserNavigateTool,
    browserGetMarkdownTool,
    browserScreenshotTool,
    browserControlTool,
    browserVisionControlTool,
    browserActionTool,
    browserClickTool,
    browserDoubleClickTool,
    browserRightClickTool,
    browserHoverTool,
    browserScrollTool,
    browserTypeTool,
    browserFormFillTool,
    browserFormFillBatchTool,
    browserWaitTool,
    browserWaitForTool,
    browserExtractTool,
    browserGetTextTool,
    browserGetLinksTool,
    browserGetClickableElementsTool,
    browserAccessibilitySnapshotTool,
    browserConsoleLogsTool,
    browserNetworkLogTool,
    browserStorageSnapshotTool,
    browserSetViewportTool,
    browserSelectorScreenshotTool,
    browserFullPageScreenshotTool,
    browserPrintPdfTool,
    browserDownloadsTool,
    browserFormSchemaTool,
    browserTableExtractTool,
    browserDragAndDropTool,
    browserDragTool,
    browserKeyPressTool,
    browserHotkeyTool,
    browserEvaluateTool,

    // Execution
    nodeExecuteTool,
    pythonExecuteTool,
    nodeCodeActTool,
    pythonCodeActTool,
    shellCodeActTool,
    shellExecuteTool,
    executeCommandTool,
    npmScriptsTool,
    runNpmScriptTool,
    typecheckProjectTool,
    lintProjectTool,
    testProjectTool,
    formatCheckTool,
    buildProjectTool,
    devServerStartTool,
    devServerStopTool,
    devServerStatusTool,
    portProbeTool,
    httpHealthCheckTool,

    // Document & conversions
    generateLatexPdfTool,
    markdownToPdfTool,
    pdfExtractTextTool,
    docxExtractTextTool,

    // Data transforms
    base64EncodeTool,
    base64DecodeTool,
    hashTool,
    textSummarizeTool,
    textRewriteTool,
    extractTodosTool,
    csvPreviewTool,
    csvQueryTool,
    jsonQueryTool,
    yamlQueryTool,
    sqliteQueryTool,
    htmlTableExtractTool,
    markdownFrontmatterTool,
    tokenCountTool,
    textKeywordsTool,
    textEntitiesTool,
    imageInfoTool,
    imageConvertTool,
    imageExifTool,
    imageOcrTool,
    imageDiffTool,
    svgOptimizeTool,
    assetManifestTool,
    artifactListTool,
    artifactReadTool,
    artifactDeleteTool,
    secretScanTool,
    dependencyAuditTool,
    licenseSummaryTool,
    sbomGenerateTool,
    lockfileRiskSummaryTool,
    semgrepScanTool,
    dockerfileScanTool,
    urlSafetyCheckTool,
    workspacePermissionsScanTool,

    // Repo info
    gitLogSummaryTool,
    gitBranchesTool,
    gitDiffSummaryTool,
    gitBlameTool,
    gitFileHistoryTool,
    gitStatusTool,
    gitChangedFilesTool,
    gitStagedDiffTool,
    gitShowTool,
    gitCompareRefsTool,
    gitConflictsTool,
    gitTagsTool,
    gitRemoteInfoTool,
    gitCommitSearchTool,
    gitPatchPreviewTool,
    gitApplyPatchTool,
  ]
  if (!context || !context.allowedToolNames) {
    return tools
  }
  const allowed = new Set(context.allowedToolNames)
  return tools.filter((tool) => allowed.has(tool.name))
}

/**
 * Default unfiltered toolset used by callers that do not pass request-specific context.
 */
export const toolset = createToolset()
