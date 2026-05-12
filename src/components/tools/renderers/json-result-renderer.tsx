"use client"

import React, { useMemo, useState } from "react"

import { JsonTreeViewer, JsonValue } from "@/components/json-tree-viewer"
import { CodeBracket } from "@/lib/icons"

import {
  CopyButton,
  RawPayloadDisclosure,
  SegmentedControl,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { ToolResultContentPart } from "./tool-result-renderer"

export const JsonResultRenderer: React.FC<{
  part: ToolResultContentPart
  onAction?: (action: string, data: unknown) => void
}> = ({ part }) => {
  const [viewMode, setViewMode] = useState<"tree" | "raw">("tree")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let jsonData: any
  let jsonString: string

  if (part.fullJson) {
    jsonString = part.fullJson
    try {
      jsonData = JSON.parse(jsonString)
    } catch {
      jsonData = part.fullJson
    }
  } else if (part.toolResult) {
    jsonData = part.toolResult
    jsonString = JSON.stringify(jsonData, null, 2)
  } else {
    jsonData = part
    jsonString = JSON.stringify(jsonData, null, 2)
  }

  const canRenderTree = Boolean(jsonData) && typeof jsonData === "object"
  const lineCount = jsonString.split("\n").length

  const downloadUrl = useMemo(() => {
    if (!jsonData || typeof jsonData !== "object") return null
    const r = jsonData as Record<string, unknown>
    return typeof r.downloadUrl === "string" && r.downloadUrl ? r.downloadUrl : null
  }, [jsonData])

  return (
    <ToolRendererShell
      header={
        <>
          <CodeBracket className="text-tool-json h-3.5 w-3.5 shrink-0" />
          <span className="text-foreground min-w-0 flex-1 truncate font-mono text-[11px] font-semibold">
            {part.toolName || "JSON"}
          </span>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span className="text-muted-foreground font-mono text-[10px]">
              {lineCount}L&nbsp;·&nbsp;{jsonString.length}B
            </span>

            {part.status && (
              <ToolStatusBadge
                variant={
                  part.status === "success"
                    ? "success"
                    : part.status === "error"
                      ? "error"
                      : "neutral"
                }
              >
                {part.status}
              </ToolStatusBadge>
            )}

            {canRenderTree && (
              <SegmentedControl
                options={[
                  { value: "tree", label: "Tree" },
                  { value: "raw", label: "Raw" },
                ]}
                value={viewMode}
                onChange={setViewMode}
              />
            )}

            {downloadUrl && (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="rk-flat-button h-auto px-2 py-0.5 font-mono text-[10px]"
              >
                Download
              </a>
            )}

            <CopyButton text={jsonString} />
          </div>
        </>
      }
      footer={<RawPayloadDisclosure payload={jsonData} label="Raw JSON" />}
    >
      <div className="rk-scrollbar max-h-[60vh] overflow-auto">
        {canRenderTree && viewMode === "tree" ? (
          <JsonTreeViewer json={jsonData as JsonValue} />
        ) : (
          <div className="flex min-w-0">
            {/* Line numbers */}
            <div className="text-muted-foreground/50 bg-surface-4 border-r px-2 py-3 text-right font-mono text-[10px] select-none">
              {jsonString.split("\n").map((_, i) => (
                <div key={i} className="leading-[1.6]">
                  {i + 1}
                </div>
              ))}
            </div>
            <pre className="text-foreground/80 min-w-0 flex-1 px-3 py-3 font-mono text-[11px] leading-[1.6] break-all whitespace-pre-wrap">
              {jsonString}
            </pre>
          </div>
        )}
      </div>
    </ToolRendererShell>
  )
}
