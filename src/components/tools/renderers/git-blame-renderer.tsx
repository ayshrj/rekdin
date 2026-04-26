"use client"

import { type ToolResultContentPart } from "./tool-result-renderer"

interface BlameLine {
  hash: string
  author: string
  date: string
  lineNo: number
  text: string
}

export function GitBlameRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as
    | { path?: string; lines?: BlameLine[]; error?: string }
    | undefined

  const filePath = result?.path ?? (part.toolInput as { path?: string } | undefined)?.path ?? ""
  const lines = result?.lines ?? []
  const error = result?.error

  // Group consecutive lines by the same commit hash for visual clarity
  const rows = lines.map((line, i) => {
    const prev = lines[i - 1]
    const showMeta = !prev || prev.hash !== line.hash
    return { ...line, showMeta }
  })

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg">
      {/* Header */}
      <div className="bg-muted/20 flex items-center gap-2 border-b px-3 py-2">
        <span className="text-foreground text-xs font-semibold">Git Blame</span>
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
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full border-collapse font-mono text-[11px]">
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-muted/10 group">
                  {/* Hash */}
                  <td className="w-[52px] border-r px-2 py-px align-top whitespace-nowrap text-amber-600 select-none">
                    {row.showMeta ? row.hash : ""}
                  </td>
                  {/* Author */}
                  <td className="text-muted-foreground w-[100px] max-w-[100px] truncate border-r px-2 py-px align-top whitespace-nowrap">
                    {row.showMeta ? row.author : ""}
                  </td>
                  {/* Date */}
                  <td className="text-muted-foreground/60 w-[72px] border-r px-2 py-px align-top whitespace-nowrap select-none">
                    {row.showMeta ? row.date : ""}
                  </td>
                  {/* Line number */}
                  <td className="text-muted-foreground/40 w-[36px] border-r px-2 py-px text-right align-top whitespace-nowrap select-none">
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
    </div>
  )
}
