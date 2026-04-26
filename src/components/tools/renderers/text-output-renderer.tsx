"use client"

import { Markdown } from "@/components/markdown"

import { type ToolResultContentPart } from "./tool-result-renderer"

export function TextOutputRenderer({ part }: { part: ToolResultContentPart }) {
  const toolName = part.toolName ?? ""
  const isSummarize = toolName === "text_summarize"

  const result = part.toolResult as
    | {
        summary?: string
        output?: string
        length?: number
        style?: string
      }
    | undefined

  const text = result?.summary ?? result?.output ?? ""
  const label = isSummarize ? "Summary" : "Rewrite"
  const meta = isSummarize
    ? result?.length
      ? `${result.length} chars`
      : null
    : (result?.style ?? null)

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg">
      <div className="bg-muted/20 flex items-center gap-2 border-b px-3 py-2">
        <span className="text-foreground text-xs font-semibold">{label}</span>
        {meta && (
          <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]">
            {meta}
          </span>
        )}
      </div>
      <div className="max-h-[60vh] overflow-auto px-4 py-3">
        {text ? (
          <Markdown>{text}</Markdown>
        ) : (
          <p className="text-muted-foreground text-xs italic">No output</p>
        )}
      </div>
    </div>
  )
}
