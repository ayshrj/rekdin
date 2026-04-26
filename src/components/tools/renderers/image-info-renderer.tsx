"use client"

import { type ToolResultContentPart } from "./tool-result-renderer"

function formatBytes(b?: number): string {
  if (!b) return "—"
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

export function ImageInfoRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as
    | {
        width?: number
        height?: number
        format?: string
        size?: number
        error?: string
      }
    | undefined

  const error = result?.error
  const format = result?.format?.toUpperCase()

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg">
      <div className="bg-muted/20 flex items-center gap-2 border-b px-3 py-2">
        <span className="text-foreground text-xs font-semibold">Image Info</span>
        {format && (
          <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-[10px] font-medium">
            {format}
          </span>
        )}
      </div>

      {error ? (
        <div className="text-destructive px-3 py-3 text-xs">{error}</div>
      ) : (
        <div className="grid grid-cols-2 divide-x divide-y border-b">
          {[
            { label: "Width", value: result?.width ? `${result.width}px` : "—" },
            { label: "Height", value: result?.height ? `${result.height}px` : "—" },
            { label: "Format", value: format ?? "—" },
            { label: "Size", value: formatBytes(result?.size) },
          ].map(({ label, value }) => (
            <div key={label} className="px-3 py-2.5">
              <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                {label}
              </p>
              <p className="text-foreground mt-0.5 font-mono text-sm font-semibold">{value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
