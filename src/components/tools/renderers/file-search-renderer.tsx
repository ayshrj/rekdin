"use client"

import { useState } from "react"

import { FileExtensionIcon } from "@/components/file-extension-icon"
import { Check, ClipboardDocumentList as Copy, FileSearch } from "@/lib/icons"

import { ToolResultContentPart } from "./tool-result-renderer"

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="text-muted-foreground hover:text-foreground shrink-0 rounded p-0.5 opacity-0 transition-colors group-hover:opacity-100"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

export function FileSearchRenderer({ part }: { part: ToolResultContentPart }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (part.toolResult || {}) as Record<string, any>
  const matches = Array.isArray(result.matches) ? result.matches : []
  const query: string = result.query || ""
  const path: string = result.path || "."
  const exitCode = result.exitCode
  const error = result.error

  const isSuccess = typeof exitCode !== "number" || exitCode === 0 || matches.length > 0

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg">
      {/* Header */}
      <div className="bg-muted/20 flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <FileSearch className="text-tool-command h-3.5 w-3.5 shrink-0" />
          <span className="text-foreground text-xs font-medium">File Search</span>
          {query && (
            <span className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-[10px]">
              {query}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
              isSuccess
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {matches.length} match{matches.length !== 1 ? "es" : ""}
          </span>
          {typeof exitCode === "number" && (
            <span className="text-muted-foreground text-[10px]">exit {exitCode}</span>
          )}
        </div>
      </div>

      {/* Search path */}
      <div className="border-b px-3 py-1.5">
        <span className="text-muted-foreground font-mono text-[10px]">in </span>
        <span className="text-foreground/70 font-mono text-[10px]">{path}</span>
      </div>

      {error ? (
        <div className="border-destructive/20 bg-destructive/5 text-destructive px-3 py-2 text-xs">
          {String(error)}
        </div>
      ) : matches.length === 0 ? (
        <div className="text-muted-foreground px-3 py-6 text-center text-xs italic">
          No matches found
        </div>
      ) : (
        <div className="max-h-[60vh] divide-y overflow-auto">
          {matches.map((match: { file?: string; line?: number; text?: unknown }, idx: number) => (
            <div
              key={`${match.file}-${match.line}-${idx}`}
              className="group hover:bg-muted/30 flex items-start gap-2 px-3 py-2"
            >
              <FileExtensionIcon
                extensionName={match.file ?? ""}
                className="mt-0.5 h-3.5 w-3.5 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="text-foreground/80 font-mono text-[11px] font-medium">
                    {match.file}
                  </span>
                  {match.line !== undefined && (
                    <span className="text-muted-foreground font-mono text-[10px]">
                      :{match.line}
                    </span>
                  )}
                </div>
                {match.text !== undefined && (
                  <div className="text-muted-foreground mt-0.5 font-mono text-[11px] leading-relaxed wrap-anywhere">
                    {typeof match.text === "string" ? match.text : JSON.stringify(match.text)}
                  </div>
                )}
              </div>
              <CopyBtn
                text={`${match.file}:${match.line ?? ""}\n${typeof match.text === "string" ? match.text : JSON.stringify(match.text)}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
