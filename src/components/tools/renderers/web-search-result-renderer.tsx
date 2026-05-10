"use client"

import React from "react"

import { ArrowTopRightOnSquare as ExternalLink, Clock, Search } from "@/lib/icons"

import { EmptyState, RawPayloadDisclosure, ToolRendererShell } from "./renderer-primitives"
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

  return (
    <ToolRendererShell
      header={
        <>
          <Search className="h-3.5 w-3.5 shrink-0 text-[color:var(--tool-search)]" />
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
            return (
              <div
                key={i}
                className="px-3 py-2.5 transition-colors duration-100 hover:bg-[var(--surface-4)]"
              >
                {/* Title */}
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-1 block font-mono text-[11px] leading-snug font-semibold text-[color:var(--tool-search)] hover:underline"
                >
                  {item.title}
                  <ExternalLink className="ml-1 inline h-2.5 w-2.5 align-[-1px] opacity-50" />
                </a>
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
    </ToolRendererShell>
  )
}
