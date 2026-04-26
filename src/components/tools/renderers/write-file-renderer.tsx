"use client"

import { ArrowDownTray, CheckCircle, FileText } from "@/lib/icons"

import { type ToolResultContentPart } from "./tool-result-renderer"

function formatBytes(b?: number): string {
  if (!b) return "0 B"
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

export function WriteFileRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as
    | { path?: string; bytes?: number; downloadUrl?: string }
    | undefined
  const path = result?.path ?? (part.toolInput as { path?: string } | undefined)?.path ?? ""
  const bytes = result?.bytes
  const downloadUrl = result?.downloadUrl

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg">
      <div className="flex items-center gap-3 px-3 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
          <CheckCircle className="h-4 w-4 text-emerald-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-foreground text-xs font-semibold">File written</p>
          <div className="mt-0.5 flex items-center gap-2">
            <FileText className="text-muted-foreground/60 h-3 w-3 shrink-0" />
            <span
              className="text-muted-foreground min-w-0 truncate font-mono text-[11px]"
              title={path}
            >
              {path}
            </span>
          </div>
          {bytes !== undefined && (
            <p className="text-muted-foreground/60 mt-0.5 text-[10px]">{formatBytes(bytes)}</p>
          )}
        </div>
        {downloadUrl && (
          <a
            href={downloadUrl}
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
