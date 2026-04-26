"use client"

import { useState } from "react"

import { Check, ClipboardDocumentList as Copy } from "@/lib/icons"

import { type ToolResultContentPart } from "./tool-result-renderer"

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

function parseCommits(output: string) {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const hash = line.slice(0, 7)
      const message = line.slice(8).trim()
      return { hash, message }
    })
}

export function GitLogRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as
    | { output?: string; limit?: number; exitCode?: number }
    | undefined
  const output = result?.output ?? ""
  const commits = parseCommits(output)

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg">
      {/* Header */}
      <div className="bg-muted/20 flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-foreground text-xs font-semibold">Git Log</span>
          <span className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-[10px]">
            {commits.length} commit{commits.length !== 1 ? "s" : ""}
          </span>
        </div>
        {output && <CopyBtn text={output} />}
      </div>

      {commits.length === 0 ? (
        <div className="text-muted-foreground px-3 py-4 text-xs italic">No commits found</div>
      ) : (
        <div className="max-h-[50vh] divide-y overflow-auto">
          {commits.map((commit, i) => (
            <div key={i} className="hover:bg-muted/20 flex items-start gap-2.5 px-3 py-2">
              <span className="mt-0.5 shrink-0 rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-amber-600">
                {commit.hash}
              </span>
              <span className="text-foreground/80 min-w-0 flex-1 text-xs leading-relaxed">
                {commit.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
