"use client"

import { useState } from "react"

import { ClickableImage } from "@/components/ui/image-lightbox"

import { BrowserShell } from "./browser-shell"
import {
  CopyButton,
  EmptyState,
  RawPayloadDisclosure,
  SegmentedControl,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

function statusVariant(code?: number) {
  if (!code) return "neutral" as const
  if (code < 300) return "success" as const
  if (code < 400) return "warning" as const
  return "error" as const
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

export function VisitLinkRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined
  const input = part.toolInput as Record<string, unknown> | undefined
  const [mode, setMode] = useState<"preview" | "raw">("preview")

  const url = String(result?.url ?? input?.url ?? "")
  const status =
    typeof result?.status === "number"
      ? result.status
      : typeof result?.statusCode === "number"
        ? result.statusCode
        : undefined
  const title = (result?.title ?? "") as string
  const content = (result?.content ??
    result?.markdown ??
    result?.text ??
    result?.body ??
    "") as string
  const screenshot = (result?.screenshot ?? result?.image ?? "") as string
  const domain = url ? getDomain(url) : ""

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Visit Link</span>
          {domain && <span className="rk-path-chip max-w-60 min-w-0 truncate">{domain}</span>}
          {status != null && (
            <ToolStatusBadge variant={statusVariant(status)}>{status}</ToolStatusBadge>
          )}
          {content && (
            <SegmentedControl
              options={[
                { value: "preview", label: "Text" },
                { value: "raw", label: "Raw" },
              ]}
              value={mode}
              onChange={setMode}
            />
          )}
          {content && <CopyButton text={content} className="ml-auto" />}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {title && (
        <div className="border-b px-3 py-1.5">
          <span className="text-foreground/80 font-mono text-[11px]">{title}</span>
        </div>
      )}
      {screenshot && (
        <BrowserShell>
          <ClickableImage
            src={
              screenshot.startsWith("data:") ? screenshot : `data:image/png;base64,${screenshot}`
            }
            alt={title || url}
            className="h-auto w-full object-contain"
          />
        </BrowserShell>
      )}
      {!content && !screenshot ? (
        <EmptyState>No content</EmptyState>
      ) : content ? (
        mode === "raw" ? (
          <pre className="rk-scrollbar text-foreground/70 max-h-[50vh] overflow-auto px-3 py-3 font-mono text-[10px] leading-relaxed whitespace-pre-wrap">
            {content}
          </pre>
        ) : (
          <div className="rk-scrollbar max-h-[50vh] overflow-auto px-3 py-3">
            <p className="text-foreground/80 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
              {content.length > 4000 ? content.slice(0, 4000) + "\n…" : content}
            </p>
          </div>
        )
      ) : null}
    </ToolRendererShell>
  )
}
