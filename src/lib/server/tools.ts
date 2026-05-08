import { PuppeteerBlocker } from "@ghostery/adblocker-puppeteer"
import { tool } from "@langchain/core/tools"
import { Readability } from "@mozilla/readability"
import { spawn } from "child_process"
import crypto from "crypto"
import { createPatch } from "diff"
import { unzipSync, zipSync } from "fflate"
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "fs/promises"
import { JSDOM } from "jsdom"
import os from "os"
import path from "path"
import type { Browser, Page } from "puppeteer"
import puppeteer from "puppeteer-extra"
import RecaptchaPlugin from "puppeteer-extra-plugin-recaptcha"
import StealthPlugin from "puppeteer-extra-plugin-stealth"
import TurndownService from "turndown"
import { pathToFileURL } from "url"
import { z } from "zod"

import { ArtifactRef } from "@/types/runtime"

import { storeArtifact } from "./artifact-store"
import { getBrowserSessionManager } from "./browser-session-manager"
import { getToolExecutionContext } from "./tool-execution-context"
import { searchPublicWeb } from "./web-search"
import { ensureWorkspaceDirs, getWorkspaceRoot, resolveWorkspacePath } from "./workspace"

const turndown = new TurndownService({ headingStyle: "atx" })

let browserPromise: Promise<Browser> | null = null
let stealthInitialized = false
let recaptchaInitialized = false
let adblockerPromise: Promise<PuppeteerBlocker | null> | null = null
let latexJsStylesPromise: Promise<string> | null = null

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
  return manager.withPage(sessionId, getBrowser, async (page) => {
    if (!(page as Page & { __rekdinAdblockEnabled?: boolean }).__rekdinAdblockEnabled) {
      const adblocker = await getAdblocker()
      if (adblocker) {
        await adblocker.enableBlockingInPage(page)
      }
      ;(page as Page & { __rekdinAdblockEnabled?: boolean }).__rekdinAdblockEnabled = true
    }
    return fn(page)
  })
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

/**
 * Searches workspace files with ripgrep, falling back to grep when rg is unavailable.
 */
export const fileSearchTool = tool(
  async ({ query, path: searchPath, maxResults }) => {
    await ensureWorkspaceDirs()
    const escapedQuery = query.replace(/'/g, "'\"'\"'")
    const targetPath = searchPath ? searchPath.replace(/'/g, "'\"'\"'") : "."
    const limit = Math.min(Math.max(maxResults ?? 200, 1), 1000)
    let res = await runCommand(
      `rg --line-number --no-heading --color=never -m ${limit} '${escapedQuery}' '${targetPath}'`,
      undefined,
      20000
    )
    // Fall back to grep when rg is not installed (exit code 127 = command not found)
    if (res.exitCode === 127) {
      res = await runCommand(
        `grep -rn --color=never -m ${limit} '${escapedQuery}' '${targetPath}'`,
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
      const info = await stat(absPath)
      if (info.isDirectory()) {
        const entries = await readdir(absPath, { withFileTypes: true })
        for (const entry of entries) {
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
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue
    const fullPath = path.join(dirPath, entry.name)
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
      const entries = await readdir(target, { withFileTypes: true })
      const output: Array<Record<string, unknown>> = []
      for (const entry of entries) {
        const relPath = relative ? `${relative}/${entry.name}` : entry.name
        const abs = resolveWorkspacePath(relPath)
        const info = await stat(abs)
        output.push({
          name: entry.name,
          path: relPath,
          type: entry.isDirectory() ? "directory" : "file",
          size: info.size,
          modified: info.mtime.toISOString(),
        })
        if (recursive && entry.isDirectory()) {
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
    visitUrlTool,
    httpRequestTool,
    downloadFetchTool,
    linkPreviewTool,
    npmPackageInfoTool,

    // File system + search
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

    // Document & conversions
    generateLatexPdfTool,
    markdownToPdfTool,

    // Data transforms
    base64EncodeTool,
    base64DecodeTool,
    hashTool,
    textSummarizeTool,
    textRewriteTool,
    extractTodosTool,
    imageInfoTool,
    imageConvertTool,

    // Repo info
    gitLogSummaryTool,
    gitBranchesTool,
    gitDiffSummaryTool,
    gitBlameTool,
    gitFileHistoryTool,
  ]
  if (!context?.allowedToolNames || context.allowedToolNames.length === 0) {
    return tools
  }
  const allowed = new Set(context.allowedToolNames)
  return tools.filter((tool) => allowed.has(tool.name))
}

/**
 * Default unfiltered toolset used by callers that do not pass request-specific context.
 */
export const toolset = createToolset()
