"use client"

import { useState } from "react"

import { CopyButton, InlineToolResult, useToolInvoke } from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

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

type GitShowResult = { output?: string; diff?: string }

export function GitLogRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as
    | { output?: string; limit?: number; exitCode?: number }
    | undefined
  const output = result?.output ?? ""
  const commits = parseCommits(output)

  const {
    loading,
    result: showResult,
    error: showError,
    invoke,
    reset,
  } = useToolInvoke<GitShowResult>("git_show")
  const [activeHash, setActiveHash] = useState<string | null>(null)

  const handleCommitClick = async (hash: string) => {
    if (activeHash === hash) {
      reset()
      setActiveHash(null)
      return
    }
    setActiveHash(hash)
    await invoke({ ref: hash })
  }

  const rawShow = showResult?.output ?? showResult?.diff ?? ""

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
        {output && <CopyButton text={output} />}
      </div>

      {commits.length === 0 ? (
        <div className="text-muted-foreground px-3 py-4 text-xs italic">No commits found</div>
      ) : (
        <div className="rk-scrollbar max-h-[50vh] divide-y overflow-auto">
          {commits.map((commit, i) => (
            <div
              key={i}
              className={`flex cursor-pointer items-start gap-2.5 px-3 py-2 transition-colors ${
                activeHash === commit.hash ? "bg-primary/10" : "hover:bg-muted/20"
              }`}
              onClick={() => handleCommitClick(commit.hash)}
              title="Click to show commit diff"
            >
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

      {/* Inline commit diff */}
      {(activeHash || loading) && (
        <InlineToolResult
          title={loading ? `Loading ${activeHash ?? ""}…` : `commit ${activeHash}`}
          onDismiss={() => {
            reset()
            setActiveHash(null)
          }}
          error={showError}
        >
          {rawShow && (
            <div>
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="text-muted-foreground font-mono text-[10px]">
                  {rawShow.split("\n").length} lines
                </span>
                <CopyButton text={rawShow} />
              </div>
              <pre className="rk-scrollbar text-foreground/75 max-h-[50vh] overflow-auto px-3 pb-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                {rawShow}
              </pre>
            </div>
          )}
        </InlineToolResult>
      )}
    </div>
  )
}
