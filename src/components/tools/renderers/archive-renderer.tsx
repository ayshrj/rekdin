"use client"

import { ArrowDownTray, CheckCircle, File } from "@/lib/icons"

import { type ToolResultContentPart } from "./tool-result-renderer"

function formatBytes(b?: number): string {
  if (!b) return "0 B"
  if (b < 1024) return `${b.toFixed(0)} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

export function ArchiveRenderer({ part }: { part: ToolResultContentPart }) {
  const toolName = part.toolName ?? ""
  const isCreate = toolName === "archive_create"

  const result = part.toolResult as
    | {
        success?: boolean
        archiveName?: string
        size?: number
        artifactUrl?: string
        outputDir?: string
        entries?: string[]
        error?: string
      }
    | undefined

  const error = result?.error
  const success = result?.success !== false

  if (error || !success) {
    return (
      <div className="w-full min-w-0 overflow-hidden rounded-lg">
        <div className="bg-muted/20 border-b px-3 py-2">
          <span className="text-foreground text-xs font-semibold">
            {isCreate ? "Archive Create" : "Archive Extract"}
          </span>
        </div>
        <div className="text-destructive px-3 py-3 text-xs">{error ?? "Operation failed"}</div>
      </div>
    )
  }

  if (isCreate) {
    return (
      <div className="w-full min-w-0 overflow-hidden rounded-lg">
        <div className="flex items-center gap-3 px-3 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-foreground text-xs font-semibold">Archive created</p>
            <p className="text-muted-foreground mt-0.5 truncate font-mono text-[11px]">
              {result?.archiveName}
            </p>
            {result?.size !== undefined && (
              <p className="text-muted-foreground/60 mt-0.5 text-[10px]">
                {formatBytes(result.size)}
              </p>
            )}
          </div>
          {result?.artifactUrl && (
            <a
              href={result.artifactUrl}
              target="_blank"
              rel="noreferrer"
              className="bg-muted text-foreground/70 hover:bg-muted/80 inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors"
            >
              <ArrowDownTray className="h-3.5 w-3.5" />
              Download
            </a>
          )}
        </div>
      </div>
    )
  }

  // Extract
  const entries = result?.entries ?? []
  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg">
      <div className="bg-muted/20 flex items-center gap-2 border-b px-3 py-2">
        <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
        <span className="text-foreground text-xs font-semibold">Archive extracted</span>
        {result?.outputDir && (
          <span className="text-muted-foreground min-w-0 truncate font-mono text-[10px]">
            → {result.outputDir}
          </span>
        )}
        <span className="text-muted-foreground ml-auto shrink-0 text-[10px]">
          {entries.length} files
        </span>
      </div>
      {entries.length > 0 && (
        <div className="max-h-[40vh] divide-y overflow-auto">
          {entries.map((entry, i) => (
            <div key={i} className="hover:bg-muted/20 flex items-center gap-2 px-3 py-1.5">
              <File className="text-muted-foreground/50 h-3.5 w-3.5 shrink-0" />
              <span className="text-foreground/70 min-w-0 flex-1 truncate font-mono text-[11px]">
                {entry}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
