"use client"

import { FileExtensionIcon } from "@/components/file-extension-icon"

import {
  CopyButton,
  EmptyState,
  RawPayloadDisclosure,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

// ── DocumentExtractRenderer ───────────────────────────────────────────────────

export function DocumentExtractRenderer({ part }: { part: ToolResultContentPart }) {
  const type = part.type
  const result = part.toolResult as Record<string, unknown> | undefined
  const input = part.toolInput as Record<string, unknown> | undefined

  const filePath = (result?.file ??
    result?.path ??
    result?.filename ??
    input?.file ??
    input?.path ??
    "") as string
  const text = (result?.text ?? result?.content ?? result?.extractedText ?? "") as string
  const pageCount =
    typeof result?.pages === "number"
      ? result.pages
      : typeof result?.pageCount === "number"
        ? result.pageCount
        : null
  const wordCount =
    typeof result?.wordCount === "number"
      ? result.wordCount
      : text
        ? text.split(/\s+/).filter(Boolean).length
        : null
  const isPdf = type === "pdf_extract_text"

  const label = isPdf ? "PDF Extract" : "Document Extract"

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">{label}</span>
          {filePath && (
            <>
              <FileExtensionIcon extensionName={filePath} className="h-3.5 w-3.5 shrink-0" />
              <span className="rk-path-chip max-w-60 min-w-0 truncate">{filePath}</span>
            </>
          )}
          {pageCount != null && (
            <ToolStatusBadge variant="neutral">
              {pageCount} page{pageCount !== 1 ? "s" : ""}
            </ToolStatusBadge>
          )}
          {wordCount != null && (
            <span className="text-muted-foreground font-mono text-[10px]">
              {wordCount.toLocaleString()} words
            </span>
          )}
          {text && <CopyButton text={text} className="ml-auto" />}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {!text ? (
        <EmptyState>No text extracted</EmptyState>
      ) : (
        <pre className="rk-scrollbar text-foreground/80 max-h-[50vh] overflow-auto px-3 py-3 font-mono text-[10px] leading-relaxed whitespace-pre-wrap">
          {text}
        </pre>
      )}
    </ToolRendererShell>
  )
}
