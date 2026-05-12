import { mkdtemp, readFile, rm, writeFile } from "fs/promises"
import os from "os"
import path from "path"
import { pathToFileURL } from "url"

import { storeArtifact } from "../../artifact-store"
import { getBrowser } from "../browser/browser-core"
import { runCommandUnsafe } from "../shared/command"
import { truncateString } from "../shared/formatting"

export type CloudinaryConfig = { cloudName: string; apiKey: string; apiSecret: string }

let latexJsStylesPromise: Promise<string> | null = null

/**
 * Reads Cloudinary credentials from tool headers first, then server environment.
 */
export function parseCloudinaryConfig(headers?: HeadersInit): CloudinaryConfig | null {
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
 * Uploads generated PDF bytes to Cloudinary when upload credentials are configured.
 */
export async function uploadPdfToCloudinary(
  pdf: Buffer,
  publicId: string,
  config: CloudinaryConfig
): Promise<string> {
  const crypto = await import("crypto")
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
 * Converts a URL or data URL into bytes for image/document helper tools.
 */
export async function fetchBuffer(source: string): Promise<Buffer> {
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
export function decodeDataInput(data: string): Buffer {
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
 * Produces a filesystem-safe PDF base filename.
 */
export function sanitizePdfBaseName(name?: string) {
  const base = path.basename(name ?? "document").replace(/\.pdf$/i, "")
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, "_")
  return safe.length > 0 ? safe : "document"
}

/**
 * Checks whether a generated or referenced file exists.
 */
export async function fileExists(filePath: string) {
  const { stat } = await import("fs/promises")
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

const LATEX_ENGINES = ["tectonic", "pdflatex", "xelatex", "lualatex"]

/**
 * Finds the first locally available LaTeX engine for native PDF compilation.
 */
export async function findLatexEngine() {
  for (const engine of LATEX_ENGINES) {
    const res = await runCommandUnsafe(`${engine} --version`, undefined, 5000)
    if (res.exitCode === 0) return engine
  }
  return null
}

/**
 * Escapes text before inserting it into generated export HTML.
 */
export function escapeHtml(value: string) {
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
export function buildPrintableHtmlDocument(
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
export function renderInlineMarkdown(markdown: string) {
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
export function renderMarkdownHtml(markdown: string) {
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
export async function getLatexJsStyles() {
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
export async function renderLatexJsHtml(texContent: string) {
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
export async function buildLatexFallbackHtml(
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
export async function persistPdfBuffer(
  pdfBuffer: Buffer,
  safeBase: string,
  cloudinaryConfig?: CloudinaryConfig
) {
  let uploadedUrl: string | null = null
  let artifact = null

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
export async function renderHtmlToPdf(
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
 * Compiles LaTeX with a native engine when available, otherwise falls back to browser PDF rendering.
 */
export async function compileLatexToPdf(
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
  let artifact = null

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
