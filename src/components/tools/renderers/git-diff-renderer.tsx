"use client"

import { useState } from "react"

import { Check, ClipboardDocumentList as Copy } from "@/lib/icons"

import { SimpleCodeEditor } from "./simple-code-editor"
import { type ToolResultContentPart } from "./tool-result-renderer"

const STATUS_COLORS: Record<string, string> = {
  M: "text-amber-500",
  A: "text-emerald-500",
  D: "text-destructive",
  R: "text-blue-500",
  C: "text-blue-400",
  "??": "text-muted-foreground",
}

const STATUS_LABELS: Record<string, string> = {
  M: "modified",
  A: "added",
  D: "deleted",
  R: "renamed",
  C: "copied",
  "??": "untracked",
}

function parseStatusLines(status: string) {
  return status
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const code = line.slice(0, 2).trim()
      const file = line.slice(2).trim()
      return { code, file }
    })
}

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
      className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

export function GitDiffRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as { status?: string; diff?: string } | undefined
  const status = result?.status ?? ""
  const diff = result?.diff ?? ""

  const statusLines = parseStatusLines(status)
  const isClean = statusLines.length === 0 && !diff

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg">
      {/* Header */}
      <div className="bg-muted/20 flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-foreground text-xs font-semibold">Git Diff</span>
          {isClean ? (
            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
              clean
            </span>
          ) : (
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
              {statusLines.length} file{statusLines.length !== 1 ? "s" : ""} changed
            </span>
          )}
        </div>
        {diff && <CopyBtn text={diff} />}
      </div>

      {isClean && (
        <div className="text-muted-foreground px-3 py-4 text-xs italic">Working tree clean</div>
      )}

      {/* Status lines */}
      {statusLines.length > 0 && (
        <div className="divide-y border-b">
          {statusLines.map((line, i) => {
            const color = STATUS_COLORS[line.code] ?? "text-muted-foreground"
            const label = STATUS_LABELS[line.code] ?? line.code
            return (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5">
                <span className={`w-16 shrink-0 text-[10px] font-medium uppercase ${color}`}>
                  {label}
                </span>
                <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
                  {line.file}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Diff */}
      {diff && (
        <SimpleCodeEditor
          code={diff}
          language="diff"
          fileName="changes.diff"
          showHeader={false}
          maxHeight="60vh"
          fontSize={12}
        />
      )}
    </div>
  )
}
