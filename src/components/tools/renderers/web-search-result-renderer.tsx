"use client"

import React, { useCallback, useState } from "react"

import { Markdown } from "@/components/markdown"
import { ArrowTopRightOnSquare as ExternalLink, Clock, Search } from "@/lib/icons"

import {
  CopyButton,
  EmptyState,
  InlineToolResult,
  RawPayloadDisclosure,
  ToolRendererShell,
  useToolInvoke,
} from "./renderer-primitives"
import { ToolResultContentPart } from "./tool-result-renderer"

interface WebSearchResult {
  title: string
  url: string
  snippet: string
  domain?: string
  publishedDate?: string
}
interface WebSearchData {
  query?: string
  results: WebSearchResult[]
  totalResults?: number
  searchTime?: number
  source?: string
}

function getDomain(url: string) {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}
function formatDate(s: string) {
  try {
    return new Date(s).toLocaleDateString()
  } catch {
    return s
  }
}

type VisitLinkResult = {
  url?: string
  content?: string
  markdown?: string
  text?: string
  body?: string
  title?: string
}

export const WebSearchResultRenderer: React.FC<{
  part: ToolResultContentPart
  onAction?: (action: string, data: unknown) => void
}> = ({ part }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let raw: any = part.toolResult || part
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw)
    } catch {
      /* ignore */
    }
  }

  const data: WebSearchData = raw.result || raw || {}
  const args = part.toolInput || raw.args || {}
  const query: string = args.query || data.query || ""
  const results = Array.isArray(data.results) ? data.results : []

  const {
    loading,
    result: previewResult,
    error: previewError,
    invoke,
    reset,
  } = useToolInvoke<VisitLinkResult>("visit_link")
  const [activeUrl, setActiveUrl] = useState<string | null>(null)

  const handlePreview = useCallback(
    async (url: string) => {
      if (activeUrl === url) {
        reset()
        setActiveUrl(null)
        return
      }
      setActiveUrl(url)
      await invoke({ url })
    },
    [activeUrl, invoke, reset]
  )

  const previewContent =
    previewResult?.content ??
    previewResult?.markdown ??
    previewResult?.text ??
    previewResult?.body ??
    ""
  const previewTitle = previewResult?.title ?? activeUrl ?? ""

  return (
    <ToolRendererShell
      header={
        <>
          <Search className="text-tool-search h-3.5 w-3.5 shrink-0" />
          <span className="text-foreground min-w-0 flex-1 truncate font-mono text-[11px] font-semibold">
            {query ? `"${query}"` : "Web Search"}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {data.source && <span className="rk-meta-chip">{data.source}</span>}
            <span className="rk-meta-chip">
              {data.totalResults ?? results.length}&nbsp;result
              {(data.totalResults ?? results.length) !== 1 ? "s" : ""}
            </span>
            {data.searchTime !== undefined && (
              <span className="text-muted-foreground font-mono text-[10px]">
                {(data.searchTime / 1000).toFixed(2)}s
              </span>
            )}
          </div>
        </>
      }
      footer={<RawPayloadDisclosure payload={part.toolResult} />}
    >
      {results.length === 0 ? (
        <EmptyState>No results</EmptyState>
      ) : (
        <div className="rk-scrollbar max-h-[60vh] divide-y overflow-auto">
          {results.map((item, i) => {
            const domain = item.domain || getDomain(item.url)
            const isActive = activeUrl === item.url
            return (
              <div
                key={i}
                className={`px-3 py-2.5 transition-colors duration-100 ${isActive ? "bg-surface-4" : "hover:bg-surface-4"}`}
              >
                {/* Title + preview button */}
                <div className="mb-1 flex items-start gap-2">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-tool-search min-w-0 flex-1 font-mono text-[11px] leading-snug font-semibold hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {item.title}
                    <ExternalLink className="ml-1 inline h-2.5 w-2.5 align-[-1px] opacity-50" />
                  </a>
                  <button
                    type="button"
                    onClick={() => handlePreview(item.url)}
                    className={`rk-flat-button shrink-0 font-mono text-[10px] ${isActive ? "text-foreground" : ""}`}
                    title="Preview page content"
                  >
                    {loading && isActive ? "Loading…" : isActive ? "Dismiss" : "Preview"}
                  </button>
                </div>
                {/* Meta */}
                <div className="mb-1 flex items-center gap-2">
                  <span className="rk-meta-chip">{domain}</span>
                  {item.publishedDate && (
                    <span className="text-muted-foreground/60 flex items-center gap-1 font-mono text-[10px]">
                      <Clock className="h-2.5 w-2.5" />
                      {formatDate(item.publishedDate)}
                    </span>
                  )}
                </div>
                {/* Snippet */}
                {item.snippet && (
                  <p className="text-muted-foreground font-mono text-[11px] leading-relaxed wrap-anywhere">
                    {item.snippet}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Inline page preview */}
      {(activeUrl || loading) && (
        <InlineToolResult
          title={loading && !previewContent ? `Fetching ${activeUrl ?? ""}…` : previewTitle}
          onDismiss={() => {
            reset()
            setActiveUrl(null)
          }}
          error={previewError}
        >
          {previewContent && (
            <div>
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="rk-meta-chip truncate">{activeUrl}</span>
                <CopyButton text={previewContent} />
              </div>
              <div className="rk-scrollbar max-h-[50vh] overflow-auto px-4 py-3">
                <Markdown className="max-w-none wrap-break-word">{previewContent}</Markdown>
              </div>
            </div>
          )}
        </InlineToolResult>
      )}
    </ToolRendererShell>
  )
}
