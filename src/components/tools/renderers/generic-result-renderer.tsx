"use client"

import React from "react"

import { CheckCircle, ExclamationCircle, InformationCircle as Info } from "@/lib/icons"

import {
  CopyButton,
  RawPayloadDisclosure,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { SimpleCodeEditor } from "./simple-code-editor"
import { ToolResultContentPart } from "./tool-result-renderer"

function isJsonString(s: string): boolean {
  const t = s.trimStart()
  if (!t.startsWith("{") && !t.startsWith("[")) return false
  try {
    JSON.parse(s)
    return true
  } catch {
    return false
  }
}

export const GenericResultRenderer: React.FC<{
  part: ToolResultContentPart
  onAction?: (action: string, data: unknown) => void
}> = ({ part }) => {
  const content = (() => {
    if (part.fullJson) return part.fullJson
    if (part.toolResult)
      return typeof part.toolResult === "string"
        ? part.toolResult
        : JSON.stringify(part.toolResult, null, 2)
    if (part.toolInput) return JSON.stringify(part.toolInput, null, 2)
    return JSON.stringify(part, null, 2)
  })()

  const toolName = part.toolName || part.name || "Result"
  const isJson = isJsonString(content)

  const StatusIcon =
    part.status === "success" ? CheckCircle : part.status === "error" ? ExclamationCircle : Info

  const statusIconClass =
    part.status === "success"
      ? "text-status-success"
      : part.status === "error"
        ? "text-destructive"
        : "text-muted-foreground"

  return (
    <ToolRendererShell
      header={
        <>
          <StatusIcon className={`h-3.5 w-3.5 shrink-0 ${statusIconClass}`} />
          <span className="text-foreground min-w-0 flex-1 truncate font-mono text-[11px] font-semibold">
            {toolName}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-2">
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
            <span className="text-muted-foreground font-mono text-[10px]">{content.length}B</span>
            {part.timestamp && (
              <span className="text-muted-foreground font-mono text-[10px]">
                {new Date(part.timestamp).toLocaleTimeString()}
              </span>
            )}
            <CopyButton text={content} />
          </div>
        </>
      }
      footer={<RawPayloadDisclosure payload={part.toolResult ?? part.toolInput} />}
    >
      {isJson ? (
        <SimpleCodeEditor
          code={content}
          language="json"
          fileName="result.json"
          showHeader={false}
          maxHeight="60vh"
          fontSize={12}
        />
      ) : (
        <pre className="rk-scrollbar text-foreground/80 max-h-[60vh] overflow-auto px-3 py-3 font-mono text-[11px] leading-relaxed wrap-anywhere whitespace-pre-wrap">
          {content}
        </pre>
      )}
    </ToolRendererShell>
  )
}
