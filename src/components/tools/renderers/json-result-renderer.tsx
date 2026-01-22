"use client"

import React, { useMemo, useState } from "react"

import { Check, ClipboardDocumentList as Copy, CodeBracket } from "@/lib/icons"

import { ToolResultContentPart } from "./tool-result-renderer"

interface JsonResultRendererProps {
  part: ToolResultContentPart
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAction?: (action: string, data: any) => void
}

const highlightJson = (jsonString: string) => {
  return jsonString.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = "text-foreground"
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = "text-primary"
        } else {
          cls = "text-secondary-foreground"
        }
      } else if (/true|false/.test(match)) {
        cls = "text-accent-foreground"
      } else if (/null/.test(match)) {
        cls = "text-destructive"
      } else if (/^-?\d+/.test(match)) {
        cls = "text-muted-foreground"
      }
      return `<span class="${cls}">${match}</span>`
    }
  )
}

export const JsonResultRenderer: React.FC<JsonResultRendererProps> = ({ part }) => {
  const [copied, setCopied] = useState(false)

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

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(jsonString)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const highlightedJson = highlightJson(jsonString)
  const downloadUrl = useMemo(() => {
    if (!jsonData || typeof jsonData !== "object") return null
    const record = jsonData as Record<string, unknown>
    return typeof record.downloadUrl === "string" && record.downloadUrl.length > 0
      ? record.downloadUrl
      : null
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
  }, [jsonData])

  return (
    <div className="json-result-container w-full min-w-0">
      <div className="border-border bg-muted/50 flex flex-wrap items-center justify-between gap-3 rounded-t-lg border-b px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex shrink-0 space-x-1.5">
            <div className="bg-tool-json/80 h-3 w-3 rounded-full shadow-sm" />
            <div className="bg-tool-json/60 h-3 w-3 rounded-full shadow-sm" />
            <div className="bg-tool-json/40 h-3 w-3 rounded-full shadow-sm" />
          </div>

          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <CodeBracket size={14} className="text-tool-json shrink-0" />
            <span className="text-foreground min-w-0 text-sm font-medium">
              {part.toolName ? `${part.toolName} Result` : "JSON Output"}
            </span>
            <span className="bg-tool-json text-foreground rounded-sm px-2 py-0.5 text-xs font-medium">
              JSON
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-muted-foreground text-xs">
            {jsonString.split("\n").length} lines • {jsonString.length} chars
          </div>

          {downloadUrl ? (
            <a
              href={downloadUrl}
              className="bg-background hover:bg-muted text-foreground rounded px-2 py-1 text-xs font-medium transition-colors"
              title="Download file"
            >
              Download
            </a>
          ) : null}

          <button
            type="button"
            onClick={copyToClipboard}
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1.5 transition-colors"
            title="Copy JSON"
          >
            {copied ? <Check size={14} className="text-tool-json" /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      <div className="bg-card text-foreground max-h-[60vh] overflow-auto">
        <div className="flex min-w-0">
          <div className="border-border bg-muted/70 text-muted-foreground min-w-12 border-r px-3 py-4 text-right font-mono text-xs select-none">
            {jsonString.split("\n").map((_, index) => (
              <div key={index} className="leading-6">
                {index + 1}
              </div>
            ))}
          </div>

          <div className="min-w-0 flex-1 p-4">
            <pre
              className="overflow-x-auto font-mono text-sm leading-6 wrap-anywhere"
              dangerouslySetInnerHTML={{ __html: highlightedJson }}
            />
          </div>
        </div>
      </div>

      <div className="border-border bg-muted/40 rounded-b-lg border-t px-3 py-1">
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <div className="flex items-center space-x-4">
            <span>Format: JSON</span>
            <span>Size: {(jsonString.length / 1024).toFixed(1)} KB</span>
            {part.status ? (
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] ${
                  part.status === "success"
                    ? "bg-tool-json/10 text-tool-json"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {part.status}
              </span>
            ) : null}
          </div>
          <div className="flex items-center space-x-2">
            <span>UTF-8</span>
            <span>Valid JSON</span>
          </div>
        </div>
      </div>
    </div>
  )
}
