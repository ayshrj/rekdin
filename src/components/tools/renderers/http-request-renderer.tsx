"use client"

import { useState } from "react"

import { ArrowDownTray, Check, ClipboardDocumentList as Copy, Globe } from "@/lib/icons"

import { SimpleCodeEditor } from "./simple-code-editor"
import { ToolResultContentPart } from "./tool-result-renderer"

type Tab = "overview" | "headers" | "body"

function CopyButton({ text, size = "sm" }: { text: string; size?: "sm" | "xs" }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className={`text-muted-foreground hover:text-foreground rounded transition-colors ${size === "xs" ? "p-0.5" : "p-1.5"}`}
      title="Copy"
    >
      {copied ? (
        <Check className={size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      ) : (
        <Copy className={size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      )}
    </button>
  )
}

function detectBodyLanguage(
  bodyText: string,
  json: unknown,
  headers: Record<string, string>
): "json" | "html" | "xml" | "text" {
  if (json !== undefined) return "json"
  const ct = headers["content-type"] ?? headers["Content-Type"] ?? ""
  if (ct.includes("json")) return "json"
  if (ct.includes("html")) return "html"
  if (ct.includes("xml")) return "xml"
  // Try to sniff
  const trimmed = bodyText.trimStart()
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json"
  if (trimmed.startsWith("<")) return "html"
  return "text"
}

export function HttpRequestRenderer({ part }: { part: ToolResultContentPart }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (part.toolResult || {}) as Record<string, any>
  const url = result.url || part.url || ""
  const method = (result.method || part.method || "GET").toUpperCase()
  const status = result.status as number | undefined
  const ok = Boolean(result.ok)
  const headers = (result.headers as Record<string, string>) || {}
  const bodyText: string = result.bodyText ?? result.body ?? ""
  const json = result.json
  const error = result.error
  const [tab, setTab] = useState<Tab>("overview")
  const [copiedUrl, setCopiedUrl] = useState(false)

  const hasBody = Boolean(bodyText || json !== undefined)
  const hasHeaders = Object.keys(headers).length > 0

  const statusBg =
    typeof status !== "number"
      ? "bg-muted text-muted-foreground"
      : status >= 200 && status < 300
        ? "bg-emerald-500/10 text-emerald-600"
        : status >= 300 && status < 400
          ? "bg-amber-500/10 text-amber-600"
          : "bg-destructive/10 text-destructive"

  const bodyLanguage = detectBodyLanguage(bodyText, json, headers)
  const bodyContent = json !== undefined ? JSON.stringify(json, null, 2) : bodyText

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    } catch {
      // ignore
    }
  }

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "overview", label: "Overview", show: true },
    {
      id: "headers",
      label: `Headers${hasHeaders ? ` (${Object.keys(headers).length})` : ""}`,
      show: true,
    },
    { id: "body", label: "Body", show: hasBody },
  ]

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg">
      {/* URL + method bar */}
      <div className="bg-muted/20 flex items-center gap-2 border-b px-3 py-2">
        <div className="bg-tool-browser/15 flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
          <Globe className="text-tool-browser h-3.5 w-3.5" />
        </div>
        <span className="bg-tool-browser/15 text-tool-browser rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold">
          {method}
        </span>
        {typeof status === "number" && (
          <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold ${statusBg}`}>
            {status}
          </span>
        )}
        <span
          className="text-foreground/60 min-w-0 flex-1 truncate font-mono text-[11px]"
          title={url}
        >
          {url}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {result.duration ? (
            <span className="text-muted-foreground text-[10px]">
              {(result.duration / 1000).toFixed(2)}s
            </span>
          ) : null}
          <button
            type="button"
            onClick={copyUrl}
            className="text-muted-foreground hover:text-foreground rounded p-1"
            title="Copy URL"
          >
            {copiedUrl ? (
              <Check className="h-3 w-3 text-emerald-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error ? (
        <div className="border-destructive/20 bg-destructive/8 text-destructive border-b px-3 py-2 text-xs">
          {String(error)}
        </div>
      ) : null}

      {/* Tabs */}
      <div className="border-b">
        <div className="flex">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  tab === t.id
                    ? "border-tool-browser text-foreground border-b-2"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="space-y-0 divide-y">
          {[
            { label: "URL", value: url },
            { label: "Method", value: method },
            {
              label: "Status",
              value: typeof status === "number" ? `${status} ${ok ? "(OK)" : ""}` : ok ? "OK" : "—",
            },
            result.duration
              ? { label: "Duration", value: `${(result.duration / 1000).toFixed(3)}s` }
              : null,
            result.size ? { label: "Size", value: `${result.size} bytes` } : null,
          ]
            .filter(Boolean)
            .map((row) => (
              <div key={row!.label} className="flex items-start gap-3 px-3 py-2">
                <span className="text-muted-foreground w-16 shrink-0 pt-0.5 text-[11px] font-medium">
                  {row!.label}
                </span>
                <span className="text-foreground min-w-0 flex-1 font-mono text-[11px] break-all">
                  {row!.value}
                </span>
              </div>
            ))}
        </div>
      )}

      {tab === "headers" && (
        <div className="max-h-[50vh] divide-y overflow-auto">
          {!hasHeaders ? (
            <div className="text-muted-foreground px-3 py-4 text-xs italic">No headers</div>
          ) : (
            Object.entries(headers).map(([key, val]) => (
              <div key={key} className="group flex items-start gap-2 px-3 py-1.5">
                <span className="text-muted-foreground w-40 shrink-0 truncate pt-0.5 font-mono text-[11px]">
                  {key}
                </span>
                <span className="text-foreground min-w-0 flex-1 font-mono text-[11px] break-all">
                  {val}
                </span>
                <CopyButton text={`${key}: ${val}`} size="xs" />
              </div>
            ))
          )}
        </div>
      )}

      {tab === "body" && (
        <div>
          {!hasBody ? (
            <div className="text-muted-foreground px-3 py-4 text-xs italic">No body</div>
          ) : bodyLanguage === "text" ? (
            <pre className="text-foreground/80 max-h-[60vh] overflow-auto px-3 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
              {bodyContent}
            </pre>
          ) : (
            <SimpleCodeEditor
              code={bodyContent}
              language={bodyLanguage}
              fileName={`response.${bodyLanguage}`}
              showHeader={false}
              maxHeight="60vh"
              fontSize={12}
            />
          )}
        </div>
      )}

      {/* Download footer */}
      {result.downloadUrl ? (
        <div className="border-t px-3 py-2">
          <a
            href={result.downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="bg-tool-browser/10 text-tool-browser hover:bg-tool-browser/20 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
          >
            <ArrowDownTray className="h-3.5 w-3.5" />
            Download
          </a>
        </div>
      ) : null}
    </div>
  )
}
