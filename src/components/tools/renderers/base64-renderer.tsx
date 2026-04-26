"use client"

import { useState } from "react"

import { Check, ClipboardDocumentList as Copy } from "@/lib/icons"

import { type ToolResultContentPart } from "./tool-result-renderer"

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="text-muted-foreground hover:text-foreground shrink-0 rounded p-1 transition-colors"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

function Pane({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 flex-1 border-b last:border-b-0 md:border-r md:border-b-0 md:last:border-r-0">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
          {label}
        </span>
        <CopyBtn text={value} />
      </div>
      <pre className="text-foreground/80 max-h-[30vh] overflow-auto px-3 py-2 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
        {value || <span className="text-muted-foreground italic">empty</span>}
      </pre>
    </div>
  )
}

export function Base64Renderer({ part }: { part: ToolResultContentPart }) {
  const toolName = part.toolName ?? ""
  const isEncode = toolName === "base64_encode"
  const result = part.toolResult as
    | { text?: string; encoded?: string; decoded?: string }
    | undefined

  const inputLabel = isEncode ? "Input" : "Encoded"
  const outputLabel = isEncode ? "Encoded" : "Decoded"
  const inputValue = isEncode
    ? (result?.text ?? (part.toolInput as { text?: string } | undefined)?.text ?? "")
    : ((part.toolInput as { encoded?: string } | undefined)?.encoded ?? "")
  const outputValue = isEncode ? (result?.encoded ?? "") : (result?.decoded ?? "")

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg">
      <div className="bg-muted/20 flex items-center gap-2 border-b px-3 py-2">
        <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-[10px] font-bold">
          BASE64
        </span>
        <span className="text-foreground/70 text-xs">{isEncode ? "Encode" : "Decode"}</span>
      </div>
      <div className="flex flex-col divide-y md:flex-row md:divide-x md:divide-y-0">
        <Pane label={inputLabel} value={inputValue} />
        <Pane label={outputLabel} value={outputValue} />
      </div>
    </div>
  )
}
