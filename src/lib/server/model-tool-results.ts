import crypto from "crypto"

import {
  DEFAULT_CURRENT_TOOL_TOKEN_BUDGET,
  DEFAULT_HISTORY_TOOL_TOKEN_BUDGET,
  estimateTokens,
  truncateTextByTokens,
} from "./token-budget"

const MAX_ARRAY_ITEMS = 30
const MAX_OBJECT_KEYS = 50
const MAX_DEPTH = 4
const MAX_STRING_CHARS = 6_000

export type ModelToolResultMode = "current" | "history"

export interface ModelToolMessageResult {
  content: string
  originalTokens: number
  tokens: number
}

function truncateString(value: string, max = MAX_STRING_CHARS) {
  if (value.length <= max) return value
  return `${value.slice(0, max)}\n\n...(truncated, ${value.length} chars total)`
}

function hashText(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16)
}

function safeJsonStringify(value: unknown) {
  try {
    return JSON.stringify(value)
  } catch {
    return JSON.stringify(sanitizeToolPayload(value))
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function previewText(value: unknown, maxTokens: number) {
  const text = typeof value === "string" ? value : safeJsonStringify(value)
  const truncated = truncateTextByTokens(text, maxTokens)
  return {
    preview: truncated.text,
    chars: text.length,
    tokens: truncated.originalTokens,
    truncated: truncated.truncated,
    sha256: hashText(text),
  }
}

export function sanitizeToolPayload(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[truncated: max depth]"

  if (typeof value === "string") {
    if (value.startsWith("data:image/") && value.length > 200) {
      return `[omitted image data url, ${value.length} chars]`
    }
    return truncateString(value)
  }

  if (typeof value === "number" || typeof value === "boolean" || value == null) return value

  if (Array.isArray(value)) {
    const slice = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeToolPayload(item, depth + 1))
    if (value.length > MAX_ARRAY_ITEMS) {
      slice.push(`[truncated: ${value.length - MAX_ARRAY_ITEMS} more items]`)
    }
    return slice
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj)
    const out: Record<string, unknown> = {}

    for (const key of keys.slice(0, MAX_OBJECT_KEYS)) {
      const val = obj[key]
      if (typeof val === "string") {
        const lower = key.toLowerCase()
        if (lower.includes("screenshot") || lower.includes("image") || lower.includes("base64")) {
          out[key] = val.startsWith("data:image/")
            ? `[omitted ${key}, ${val.length} chars]`
            : `[omitted ${key}, ${val.length} chars]`
          continue
        }
        if (
          key === "markdown" ||
          key === "content" ||
          key === "html" ||
          key === "stdout" ||
          key === "stderr" ||
          key === "bodyText"
        ) {
          out[key] = truncateString(val)
          continue
        }
      }
      out[key] = sanitizeToolPayload(val, depth + 1)
    }

    if (keys.length > MAX_OBJECT_KEYS) {
      out.__truncatedKeys = keys.length - MAX_OBJECT_KEYS
    }

    return out
  }

  return String(value)
}

function compactFileRead(result: Record<string, unknown>, mode: ModelToolResultMode) {
  const content = typeof result.content === "string" ? result.content : ""
  const textPreview = previewText(content, mode === "history" ? 220 : 900)
  return {
    type: result.type ?? "file_read",
    path: result.path,
    contentPreview: textPreview.preview,
    contentChars: textPreview.chars,
    contentTokens: textPreview.tokens,
    contentSha256: textPreview.sha256,
    lineCount: content ? content.split(/\r?\n/).length : 0,
    truncated: textPreview.truncated,
  }
}

function compactListFiles(result: Record<string, unknown>, mode: ModelToolResultMode) {
  const files = Array.isArray(result.files) ? result.files : []
  const limit = mode === "history" ? 20 : 80
  return {
    type: result.type ?? "list_files",
    path: result.path ?? ".",
    totalEntries: files.length,
    entries: files.slice(0, limit).map((entry) => {
      const record = asRecord(entry)
      return {
        path: record.path,
        type: record.type,
        size: record.size,
        protected: record.protected,
        skipped: record.skipped,
      }
    }),
    omittedEntries: Math.max(files.length - limit, 0),
  }
}

function compactFileSearch(result: Record<string, unknown>, mode: ModelToolResultMode) {
  const matches = Array.isArray(result.matches) ? result.matches : []
  const limit = mode === "history" ? 8 : 30
  return {
    type: result.type ?? "file_search",
    query: result.query,
    path: result.path,
    exitCode: result.exitCode,
    totalMatches: matches.length,
    matches: matches.slice(0, limit),
    omittedMatches: Math.max(matches.length - limit, 0),
    error: result.error,
  }
}

function compactMarkdownPage(result: Record<string, unknown>, mode: ModelToolResultMode) {
  const markdown = typeof result.markdown === "string" ? result.markdown : ""
  const textPreview = previewText(markdown, mode === "history" ? 240 : 1_000)
  return {
    type: result.type,
    url: result.url,
    title: result.title,
    excerpt: result.excerpt,
    markdownPreview: textPreview.preview,
    markdownChars: textPreview.chars,
    markdownTokens: textPreview.tokens,
    markdownSha256: textPreview.sha256,
    truncated: textPreview.truncated,
  }
}

function compactHttpRequest(result: Record<string, unknown>, mode: ModelToolResultMode) {
  const body = typeof result.bodyText === "string" ? result.bodyText : ""
  const json = result.json
  const bodyPreview = previewText(body || json, mode === "history" ? 160 : 600)
  const headers = asRecord(result.headers)
  const usefulHeaders = Object.fromEntries(
    ["content-type", "content-length", "etag", "last-modified", "x-ratelimit-remaining"]
      .filter((key) => key in headers)
      .map((key) => [key, headers[key]])
  )
  return {
    type: result.type ?? "http_request",
    url: result.url,
    method: result.method,
    status: result.status,
    ok: result.ok,
    headers: usefulHeaders,
    bodyPreview: bodyPreview.preview,
    bodyChars: bodyPreview.chars,
    bodyTokens: bodyPreview.tokens,
    bodySha256: bodyPreview.sha256,
    truncated: bodyPreview.truncated,
    error: result.error,
  }
}

function compactDownload(result: Record<string, unknown>) {
  const base64 = typeof result.base64 === "string" ? result.base64 : ""
  return {
    type: result.type ?? "download_fetch",
    url: result.url,
    status: result.status,
    ok: result.ok,
    size: result.size,
    contentType: result.contentType,
    base64Omitted: base64 ? `${base64.length} chars` : undefined,
    base64Sha256: base64 ? hashText(base64) : undefined,
    error: result.error,
  }
}

function compactBrowserResult(result: Record<string, unknown>, mode: ModelToolResultMode) {
  const output: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(result)) {
    const lower = key.toLowerCase()
    if (typeof value === "string" && (lower.includes("screenshot") || lower.includes("image"))) {
      output[key] = `[omitted ${key}, ${value.length} chars]`
    } else if (typeof value === "string" && (key === "result" || key === "text")) {
      output[key] = previewText(value, mode === "history" ? 180 : 600)
    } else {
      output[key] = value
    }
  }
  return sanitizeToolPayload(output)
}

function compactCommand(result: Record<string, unknown>, mode: ModelToolResultMode) {
  const stdout = typeof result.stdout === "string" ? result.stdout : ""
  const stderr = typeof result.stderr === "string" ? result.stderr : ""
  return {
    type: result.type,
    command: result.command,
    cwd: result.cwd,
    exitCode: result.exitCode,
    duration: result.duration,
    stdout: previewText(stdout, mode === "history" ? 160 : 500),
    stderr: previewText(stderr, mode === "history" ? 120 : 300),
  }
}

function compactTextPayload(result: Record<string, unknown>, mode: ModelToolResultMode) {
  const text =
    typeof result.text === "string"
      ? result.text
      : typeof result.content === "string"
        ? result.content
        : ""
  const preview = previewText(text, mode === "history" ? 180 : 700)
  return {
    ...result,
    text: undefined,
    content: undefined,
    textPreview: preview.preview,
    textChars: preview.chars,
    textTokens: preview.tokens,
    textSha256: preview.sha256,
    truncated: preview.truncated,
  }
}

function compactRows(result: Record<string, unknown>, mode: ModelToolResultMode) {
  const limit = mode === "history" ? 8 : 40
  const rows = Array.isArray(result.rows) ? result.rows : []
  const tables = Array.isArray(result.tables) ? result.tables : []
  return {
    ...result,
    rows: rows.slice(0, limit),
    omittedRows: Math.max(rows.length - limit, 0),
    tables: tables.slice(0, mode === "history" ? 3 : 10),
    omittedTables: Math.max(tables.length - (mode === "history" ? 3 : 10), 0),
  }
}

function compactArrayKey(result: Record<string, unknown>, key: string, mode: ModelToolResultMode) {
  const limit = mode === "history" ? 10 : 50
  const values = Array.isArray(result[key]) ? result[key] : []
  return {
    ...result,
    [key]: values.slice(0, limit),
    [`omitted${key[0].toUpperCase()}${key.slice(1)}`]: Math.max(values.length - limit, 0),
  }
}

function compactGeneric(toolName: string, result: unknown, mode: ModelToolResultMode) {
  const record = asRecord(result)
  const type = typeof record.type === "string" ? record.type : toolName

  if (toolName === "file_read" || type === "file_read") return compactFileRead(record, mode)
  if (toolName === "list_files" || type === "list_files") return compactListFiles(record, mode)
  if (toolName === "file_search" || type === "file_search") return compactFileSearch(record, mode)
  if (toolName === "visit_link" || type === "visit_link") return compactMarkdownPage(record, mode)
  if (toolName === "browser_get_markdown" || type === "browser_get_markdown") {
    return compactMarkdownPage(record, mode)
  }
  if (toolName === "http_request" || type === "http_request")
    return compactHttpRequest(record, mode)
  if (toolName === "download_fetch" || type === "download_fetch") return compactDownload(record)
  if (
    toolName === "execute_command" ||
    toolName === "shell_execute" ||
    toolName === "node_execute" ||
    toolName === "python_execute" ||
    toolName.endsWith("_codeact") ||
    toolName === "run_npm_script" ||
    toolName === "typecheck_project" ||
    toolName === "lint_project" ||
    toolName === "test_project" ||
    toolName === "format_check" ||
    toolName === "build_project" ||
    type === "run_npm_script" ||
    type === "typecheck_project" ||
    type === "lint_project" ||
    type === "test_project" ||
    type === "format_check" ||
    type === "build_project"
  ) {
    return compactCommand(record, mode)
  }
  if (type === "pdf_extract_text" || type === "docx_extract_text" || type === "image_ocr")
    return compactTextPayload(record, mode)
  if (
    type === "csv_preview" ||
    type === "csv_query" ||
    type === "sqlite_query" ||
    type === "html_table_extract" ||
    type === "browser_table_extract"
  ) {
    return compactRows(record, mode)
  }
  if (type === "dependency_graph") {
    const nodes = Array.isArray(record.nodes) ? record.nodes : []
    const edges = Array.isArray(record.edges) ? record.edges : []
    return {
      ...record,
      nodeCount: record.nodeCount ?? nodes.length,
      edgeCount: record.edgeCount ?? edges.length,
      nodes: nodes.slice(0, mode === "history" ? 10 : 80),
      edges: edges.slice(0, mode === "history" ? 15 : 160),
      omittedNodes: Math.max(nodes.length - (mode === "history" ? 10 : 80), 0),
      omittedEdges: Math.max(edges.length - (mode === "history" ? 15 : 160), 0),
    }
  }
  if (type === "browser_console_logs") return compactArrayKey(record, "logs", mode)
  if (type === "browser_network_log") return compactArrayKey(record, "requests", mode)
  if (type === "secret_scan") return compactArrayKey(record, "findings", mode)
  if (type === "dependency_audit") return sanitizeToolPayload(record)
  if (toolName.startsWith("browser_") || String(type).startsWith("browser_")) {
    return compactBrowserResult(record, mode)
  }

  return sanitizeToolPayload(result)
}

export function createModelToolMessageContent(
  toolName: string,
  result: unknown,
  mode: ModelToolResultMode = "current"
): ModelToolMessageResult {
  const maxTokens =
    mode === "history" ? DEFAULT_HISTORY_TOOL_TOKEN_BUDGET : DEFAULT_CURRENT_TOOL_TOKEN_BUDGET
  const originalContent = safeJsonStringify(result)
  const originalTokens = estimateTokens(originalContent)
  const sanitized = sanitizeToolPayload(result)
  const fullContent = safeJsonStringify(sanitized)
  const sanitizedTokens = estimateTokens(fullContent)

  if (sanitizedTokens <= maxTokens && originalTokens <= maxTokens) {
    return { content: fullContent, originalTokens, tokens: sanitizedTokens }
  }

  const compact = compactGeneric(toolName, result, mode)
  const compactContent = safeJsonStringify(compact)
  const truncated = truncateTextByTokens(compactContent, maxTokens)
  return {
    content: truncated.text,
    originalTokens,
    tokens: truncated.tokens,
  }
}
