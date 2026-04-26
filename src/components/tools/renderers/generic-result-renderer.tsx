"use client"

import React, { useState } from "react"

import {
  Check,
  CheckCircle,
  ClipboardDocumentList as Copy,
  ExclamationCircle,
  InformationCircle as Info,
} from "@/lib/icons"

import { SimpleCodeEditor } from "./simple-code-editor"
import { ToolResultContentPart } from "./tool-result-renderer"

interface GenericResultRendererProps {
  part: ToolResultContentPart
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAction?: (action: string, data: any) => void
}

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

export const GenericResultRenderer: React.FC<GenericResultRendererProps> = ({ part }) => {
  const [copied, setCopied] = useState(false)

  const getDisplayContent = () => {
    if (part.fullJson) return part.fullJson
    if (part.toolResult) {
      if (typeof part.toolResult === "string") return part.toolResult
      return JSON.stringify(part.toolResult, null, 2)
    }
    if (part.toolInput) return JSON.stringify(part.toolInput, null, 2)
    return JSON.stringify(part, null, 2)
  }

  const content = getDisplayContent()
  const toolName = part.toolName || part.name || "Result"
  const isJson = isJsonString(content)

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const statusIcon =
    part.status === "success" ? (
      <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
    ) : part.status === "error" ? (
      <ExclamationCircle className="text-destructive h-3.5 w-3.5 shrink-0" />
    ) : (
      <Info className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
    )

  const statusBadge =
    part.status === "success"
      ? "bg-emerald-500/10 text-emerald-600"
      : part.status === "error"
        ? "bg-destructive/10 text-destructive"
        : null

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg">
      {/* Header */}
      <div className="bg-muted/20 flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {statusIcon}
          <span className="text-foreground truncate text-xs font-medium">{toolName}</span>
          {statusBadge && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${statusBadge}`}>
              {part.status}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-muted-foreground text-[10px]">{content.length} chars</span>
          {part.timestamp && (
            <span className="text-muted-foreground text-[10px]">
              {new Date(part.timestamp).toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            onClick={copyToClipboard}
            className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
            title="Copy"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
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
        <pre className="text-foreground/80 max-h-[60vh] overflow-auto px-3 py-3 font-mono text-xs leading-relaxed wrap-anywhere whitespace-pre-wrap">
          {content}
        </pre>
      )}
    </div>
  )
}
