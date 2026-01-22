"use client"

import React, { useState } from "react"

import { CheckCircle, InformationCircle as Info } from "@/lib/icons"
import { Check, ClipboardDocumentList as Copy, ExclamationCircle } from "@/lib/icons"

import { ToolResultContentPart } from "./tool-result-renderer"

interface GenericResultRendererProps {
  part: ToolResultContentPart
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAction?: (action: string, data: any) => void
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
  const toolName = part.toolName || part.name || "Generic Tool"

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const getStatusIcon = () => {
    switch (part.status) {
      case "success":
        return <CheckCircle className="text-primary" size={16} />
      case "error":
        return <ExclamationCircle className="text-destructive" size={16} />
      default:
        return <Info className="text-tool-generic" size={16} />
    }
  }

  const getStatusColor = () => {
    switch (part.status) {
      case "success":
        return "border-primary/30"
      case "error":
        return "border-destructive/30"
      default:
        return "border-tool-generic/30"
    }
  }

  const getHeaderColor = () => {
    switch (part.status) {
      case "success":
        return "bg-primary/10"
      case "error":
        return "bg-destructive/10"
      default:
        return "bg-tool-generic/10"
    }
  }

  return (
    <div className="generic-result-container w-full min-w-0">
      <div className={`overflow-hidden rounded-lg border ${getStatusColor()} shadow-sm`}>
        <div
          className={`${getHeaderColor()} border-border flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2`}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {getStatusIcon()}
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-foreground min-w-0 text-sm font-medium">{toolName}</span>
              <span className="bg-tool-generic text-foreground rounded-sm px-2 py-0.5 text-xs font-medium">
                RESULT
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {part.timestamp ? (
              <div className="text-muted-foreground text-xs">
                {new Date(part.timestamp).toLocaleTimeString()}
              </div>
            ) : null}
            <button
              type="button"
              onClick={copyToClipboard}
              className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1.5 transition-colors"
              title="Copy content"
            >
              {copied ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        <div className="bg-card max-h-[60vh] overflow-auto">
          <div className="min-w-0 p-4">
            <pre className="text-foreground font-mono text-sm leading-relaxed wrap-anywhere whitespace-pre-wrap">
              {content}
            </pre>
          </div>
        </div>

        <div className="border-border bg-muted/40 border-t px-3 py-1">
          <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span>Type: {part.type || "generic"}</span>
              <span>Size: {content.length} chars</span>
              {part.status ? (
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    part.status === "success"
                      ? "bg-primary/10 text-primary"
                      : part.status === "error"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-tool-generic/10 text-tool-generic"
                  }`}
                >
                  {part.status}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <span>UTF-8</span>
              <span>RAW</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
