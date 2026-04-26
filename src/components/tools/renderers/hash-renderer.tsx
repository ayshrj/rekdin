"use client"

import { useState } from "react"

import { Check, ClipboardDocumentList as Copy } from "@/lib/icons"

import { type ToolResultContentPart } from "./tool-result-renderer"

export function HashRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as
    | {
        algorithm?: string
        hash?: string
        source?: string
        error?: string
      }
    | undefined

  const algorithm = (result?.algorithm ?? "hash").toUpperCase()
  const hash = result?.hash ?? ""
  const source = result?.source
  const error = result?.error
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (!hash) return
    try {
      await navigator.clipboard.writeText(hash)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg">
      {/* Header */}
      <div className="bg-muted/20 flex items-center gap-2 border-b px-3 py-2">
        <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-[10px] font-bold">
          {algorithm}
        </span>
        {source && (
          <span className="text-muted-foreground min-w-0 truncate font-mono text-[11px]">
            {source}
          </span>
        )}
      </div>

      {error ? (
        <div className="text-destructive px-3 py-3 text-xs">{error}</div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-3">
          <span className="text-foreground/80 min-w-0 flex-1 font-mono text-xs leading-relaxed break-all">
            {hash}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <span className="text-muted-foreground/50 text-[10px]">{hash.length} chars</span>
            <button
              type="button"
              onClick={copy}
              className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
              title="Copy hash"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
