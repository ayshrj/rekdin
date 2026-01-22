"use client"

import React, { useState } from "react"

import { BugAnt as Bug, CheckBadge, Globe, Server } from "@/lib/icons"
import { ArrowDownTray } from "@/lib/icons"

import { ToolResultContentPart } from "./tool-result-renderer"

export function HttpRequestRenderer({ part }: { part: ToolResultContentPart }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (part.toolResult || {}) as Record<string, any>
  const url = result.url || part.url || ""
  const method = (result.method || part.method || "GET").toUpperCase()
  const status = result.status
  const ok = Boolean(result.ok)
  const headers = (result.headers as Record<string, string>) || {}
  const bodyText = result.bodyText ?? result.body ?? ""
  const json = result.json
  const error = result.error
  const [showHeaders, setShowHeaders] = useState(false)
  const [showBody, setShowBody] = useState(Boolean(bodyText || json))

  const statusColor = (() => {
    if (typeof status !== "number") return "text-muted-foreground"
    if (status >= 200 && status < 300) return "text-emerald-600"
    if (status >= 300 && status < 400) return "text-amber-600"
    return "text-destructive"
  })()

  return (
    <div className="w-full min-w-0 space-y-3">
      <div className="border-border bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
        <div className="flex min-w-0 items-center space-x-3">
          <div className="bg-tool-browser/15 text-tool-browser flex h-9 w-9 items-center justify-center rounded-lg">
            <Globe size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-foreground flex items-center space-x-2 text-sm font-semibold">
              <span>{method}</span>
              <span className={`text-xs font-medium ${statusColor}`}>
                {typeof status === "number" ? status : ok ? "OK" : "—"}
              </span>
              {ok ? (
                <CheckBadge size={14} className="text-emerald-600" />
              ) : error ? (
                <Bug size={14} className="text-destructive" />
              ) : null}
            </div>
            <p className="text-muted-foreground text-xs wrap-anywhere">{url}</p>
          </div>
        </div>
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          {result.duration ? <span>{(result.duration / 1000).toFixed(2)}s</span> : null}
          {result.size ? <span>{result.size} bytes</span> : null}
        </div>
      </div>

      {error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm">
          {String(error)}
        </div>
      ) : null}

      <div className="border-border bg-muted/50 rounded-lg border p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
            <Server size={14} className="text-tool-browser" />
            <span>Response</span>
          </div>
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <button
              type="button"
              className="hover:text-foreground underline-offset-2"
              onClick={() => setShowHeaders((v) => !v)}
            >
              {showHeaders ? "Hide" : "Show"} headers
            </button>
            {(bodyText || json) && (
              <button
                type="button"
                className="hover:text-foreground underline-offset-2"
                onClick={() => setShowBody((v) => !v)}
              >
                {showBody ? "Hide" : "Show"} body
              </button>
            )}
          </div>
        </div>

        {showHeaders ? (
          <div className="bg-background text-foreground mt-2 rounded border px-3 py-2 font-mono text-xs">
            {Object.keys(headers).length === 0 ? (
              <div className="text-muted-foreground">No headers</div>
            ) : (
              <pre className="wrap-break-word whitespace-pre-wrap">
                {Object.entries(headers)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join("\n")}
              </pre>
            )}
          </div>
        ) : null}

        {showBody ? (
          <div className="bg-background mt-3 rounded border px-3 py-3 text-sm">
            {json ? (
              <pre className="text-foreground overflow-auto font-mono text-xs leading-6">
                {JSON.stringify(json, null, 2)}
              </pre>
            ) : bodyText ? (
              <pre className="text-foreground overflow-auto font-mono text-xs leading-6 whitespace-pre-wrap">
                {bodyText}
              </pre>
            ) : (
              <div className="text-muted-foreground text-xs">No body</div>
            )}
          </div>
        ) : null}
      </div>

      {result.downloadUrl ? (
        <div className="border-border bg-muted/40 text-foreground flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
          <span className="flex items-center gap-2">
            <ArrowDownTray size={14} />
            Download
          </span>
          <a
            className="text-tool-browser hover:underline"
            href={result.downloadUrl}
            target="_blank"
            rel="noreferrer"
          >
            {result.downloadUrl}
          </a>
        </div>
      ) : null}
    </div>
  )
}
