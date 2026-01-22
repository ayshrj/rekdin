"use client"

import React from "react"

import { FileSearch, FileText } from "@/lib/icons"

import { ToolResultContentPart } from "./tool-result-renderer"

export function FileSearchRenderer({ part }: { part: ToolResultContentPart }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (part.toolResult || {}) as Record<string, any>
  const matches = Array.isArray(result.matches) ? result.matches : []
  const query = result.query || ""
  const path = result.path || "."
  const exitCode = result.exitCode
  const error = result.error

  const statusColor =
    typeof exitCode === "number" && exitCode !== 0 && matches.length === 0
      ? "text-destructive"
      : "text-emerald-600"

  return (
    <div className="w-full min-w-0 space-y-3">
      <div className="border-border bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
        <div className="flex min-w-0 items-center space-x-3">
          <div className="bg-tool-command/15 text-tool-command flex h-9 w-9 items-center justify-center rounded-lg">
            <FileSearch size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
              <span>Search</span>
              <span className={statusColor}>{matches.length} match(es)</span>
            </div>
            <p className="text-muted-foreground text-xs wrap-anywhere">Path: {path}</p>
            {query ? <p className="text-foreground font-mono text-xs">Query: {query}</p> : null}
          </div>
        </div>
        {typeof exitCode === "number" ? (
          <div className="text-muted-foreground text-xs">Exit code: {exitCode}</div>
        ) : null}
      </div>

      {error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm">
          {String(error)}
        </div>
      ) : null}

      <div className="border-border bg-muted/40 rounded-lg border">
        {matches.length === 0 ? (
          <div className="text-muted-foreground p-4 text-sm">No matches found.</div>
        ) : (
          <div className="divide-border divide-y">
            {matches.map((match, idx) => (
              <div key={`${match.file}-${match.line}-${idx}`} className="p-3">
                <div className="flex items-start gap-2 text-sm">
                  <FileText size={14} className="text-tool-command mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-foreground font-mono text-xs wrap-anywhere">
                      {match.file}:{match.line}
                    </div>
                    <div className="text-muted-foreground font-mono text-xs wrap-anywhere">
                      {typeof match.text === "string" ? match.text : JSON.stringify(match.text)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
