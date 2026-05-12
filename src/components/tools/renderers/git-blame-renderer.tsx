"use client"

import { useState } from "react"

import { FileExtensionIcon } from "@/components/file-extension-icon"

import { CopyButton, InlineToolResult, useToolInvoke } from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

interface BlameLine {
  hash: string
  author: string
  date: string
  lineNo: number
  text: string
}

type GitShowResult = { output?: string; diff?: string }

export function GitBlameRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as
    | { path?: string; lines?: BlameLine[]; error?: string }
    | undefined

  const filePath = result?.path ?? (part.toolInput as { path?: string } | undefined)?.path ?? ""
  const lines = result?.lines ?? []
  const error = result?.error

  const {
    loading,
    result: showResult,
    error: showError,
    invoke,
    reset,
  } = useToolInvoke<GitShowResult>("git_show")
  const [activeHash, setActiveHash] = useState<string | null>(null)

  const handleHashClick = async (hash: string) => {
    if (!hash) return
    if (activeHash === hash) {
      reset()
      setActiveHash(null)
      return
    }
    setActiveHash(hash)
    await invoke({ ref: hash })
  }

  // Group consecutive lines by the same commit hash for visual clarity
  const rows = lines.map((line, i) => {
    const prev = lines[i - 1]
    const showMeta = !prev || prev.hash !== line.hash
    return { ...line, showMeta }
  })

  const rawShow = showResult?.output ?? showResult?.diff ?? ""

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg">
      {/* Header */}
      <div className="bg-muted/20 flex items-center gap-2 border-b px-3 py-2">
        <span className="text-foreground text-xs font-semibold">Git Blame</span>
        {filePath && (
          <FileExtensionIcon extensionName={filePath} className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="text-muted-foreground truncate font-mono text-[10px]">{filePath}</span>
        {lines.length > 0 && (
          <span className="bg-muted text-muted-foreground ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px]">
            {lines.length} lines
          </span>
        )}
      </div>

      {error && <div className="text-destructive px-3 py-3 text-xs">{error}</div>}

      {lines.length === 0 && !error && (
        <div className="text-muted-foreground px-3 py-4 text-xs italic">No blame data</div>
      )}

      {lines.length > 0 && (
        <div className="rk-scrollbar max-h-[60vh] overflow-auto">
          <table className="w-full border-collapse font-mono text-[11px]">
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className={`group ${activeHash === row.hash ? "bg-primary/10" : "hover:bg-muted/10"}`}
                >
                  {/* Hash — clickable to show commit */}
                  <td
                    className={`w-13 border-r px-2 py-px align-top whitespace-nowrap select-none ${
                      row.showMeta && row.hash
                        ? "cursor-pointer text-amber-600 hover:underline"
                        : "text-amber-600/0"
                    }`}
                    onClick={() => row.showMeta && handleHashClick(row.hash)}
                    title={row.showMeta ? "Click to show commit" : undefined}
                  >
                    {row.showMeta ? row.hash : ""}
                  </td>
                  {/* Author */}
                  <td className="text-muted-foreground w-25 max-w-25 truncate border-r px-2 py-px align-top whitespace-nowrap">
                    {row.showMeta ? row.author : ""}
                  </td>
                  {/* Date */}
                  <td className="text-muted-foreground/60 w-18 border-r px-2 py-px align-top whitespace-nowrap select-none">
                    {row.showMeta ? row.date : ""}
                  </td>
                  {/* Line number */}
                  <td className="text-muted-foreground/40 w-9 border-r px-2 py-px text-right align-top whitespace-nowrap select-none">
                    {row.lineNo}
                  </td>
                  {/* Code */}
                  <td className="text-foreground/80 px-3 py-px align-top whitespace-pre">
                    {row.text}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              <pre className="rk-scrollbar text-foreground/75 max-h-[40vh] overflow-auto px-3 pb-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                {rawShow}
              </pre>
            </div>
          )}
        </InlineToolResult>
      )}
    </div>
  )
}
