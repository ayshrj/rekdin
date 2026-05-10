"use client"

import { parsePatch } from "diff"
import { useState } from "react"

import { FileExtensionIcon } from "@/components/file-extension-icon"
import { Check, ChevronDown, ChevronRight, ClipboardDocumentList as Copy } from "@/lib/icons"

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

function DiffFileBlock({ file }: { file: ReturnType<typeof parsePatch>[number] }) {
  const [open, setOpen] = useState(true)
  const fileName =
    file.newFileName?.replace(/^b\//, "") ?? file.oldFileName?.replace(/^a\//, "") ?? ""

  const added = file.hunks.reduce((n, h) => n + h.lines.filter((l) => l.startsWith("+")).length, 0)
  const removed = file.hunks.reduce(
    (n, h) => n + h.lines.filter((l) => l.startsWith("-")).length,
    0
  )

  return (
    <div className="border-b last:border-b-0">
      {/* File header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="bg-muted/10 hover:bg-muted/20 flex w-full items-center gap-2 px-3 py-2 text-left transition-colors"
      >
        {open ? (
          <ChevronDown className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
        )}
        {fileName && (
          <FileExtensionIcon extensionName={fileName} className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
          {fileName}
        </span>
        <span className="shrink-0 text-[10px] font-medium text-emerald-600">+{added}</span>
        <span className="text-destructive shrink-0 text-[10px] font-medium">−{removed}</span>
      </button>

      {open && (
        <div className="overflow-x-auto">
          {file.hunks.map((hunk, hi) => (
            <div key={hi}>
              {/* Hunk header */}
              <div className="bg-blue-500/5 px-3 py-0.5 font-mono text-[10px] text-blue-500/70">
                @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
              </div>
              {hunk.lines.map((line, li) => {
                const isAdd = line.startsWith("+")
                const isRemove = line.startsWith("-")
                return (
                  <div
                    key={li}
                    className={isAdd ? "bg-emerald-500/10" : isRemove ? "bg-destructive/10" : ""}
                  >
                    <pre
                      className={`px-3 py-px font-mono text-[11px] leading-relaxed whitespace-pre ${
                        isAdd
                          ? "text-emerald-700 dark:text-emerald-400"
                          : isRemove
                            ? "text-destructive"
                            : "text-foreground/60"
                      }`}
                    >
                      {line}
                    </pre>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function GitDiffRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as { status?: string; diff?: string } | undefined
  const status = result?.status ?? ""
  const diff = result?.diff ?? ""

  const statusLines = parseStatusLines(status)
  const isClean = statusLines.length === 0 && !diff

  const parsedFiles = (() => {
    if (!diff) return []
    try {
      return parsePatch(diff)
    } catch {
      return []
    }
  })()

  const totalAdded = parsedFiles.reduce(
    (n, f) => n + f.hunks.reduce((m, h) => m + h.lines.filter((l) => l.startsWith("+")).length, 0),
    0
  )
  const totalRemoved = parsedFiles.reduce(
    (n, f) => n + f.hunks.reduce((m, h) => m + h.lines.filter((l) => l.startsWith("-")).length, 0),
    0
  )

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
              {statusLines.length > 0
                ? `${statusLines.length} file${statusLines.length !== 1 ? "s" : ""} changed`
                : `${parsedFiles.length} file${parsedFiles.length !== 1 ? "s" : ""}`}
            </span>
          )}
          {(totalAdded > 0 || totalRemoved > 0) && (
            <>
              <span className="text-[10px] font-medium text-emerald-600">+{totalAdded}</span>
              <span className="text-destructive text-[10px] font-medium">−{totalRemoved}</span>
            </>
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

      {/* Parsed diff — per-file collapsible blocks */}
      {parsedFiles.length > 0 && (
        <div className="max-h-[60vh] divide-y overflow-auto">
          {parsedFiles.map((file, i) => (
            <DiffFileBlock key={i} file={file} />
          ))}
        </div>
      )}

      {/* Fallback: raw diff if parsePatch returned nothing */}
      {diff && parsedFiles.length === 0 && (
        <pre className="text-foreground/70 max-h-[60vh] overflow-auto px-3 py-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
          {diff}
        </pre>
      )}
    </div>
  )
}
