"use client"

import React from "react"

import { ArrowTopRightOnSquare as ExternalLink, Clock, Search } from "@/lib/icons"

import { ToolResultContentPart } from "./tool-result-renderer"

interface WebSearchResult {
  title: string
  url: string
  snippet: string
  domain?: string
  publishedDate?: string
}

interface WebSearchData {
  query: string
  results: WebSearchResult[]
  totalResults: number
  searchTime?: number
  source?: string
}

interface WebSearchResultRendererProps {
  part: ToolResultContentPart
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAction?: (action: string, data: any) => void
}

export const WebSearchResultRenderer: React.FC<WebSearchResultRendererProps> = ({ part }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let toolResult: any = part.toolResult || part

  if (typeof toolResult === "string") {
    try {
      toolResult = JSON.parse(toolResult)
    } catch {
      // ignore
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const searchData: WebSearchData = toolResult.result || toolResult || ({} as any)
  const args = part.toolInput || toolResult.args || {}

  if (!searchData.results || !Array.isArray(searchData.results)) {
    return (
      <div className="text-destructive p-4">
        <p>Invalid web search data format</p>
        <div className="text-muted-foreground mt-2 text-xs">
          <p>Expected structure: toolResult.results[]</p>
          <pre className="bg-muted mt-1 rounded p-2">
            {JSON.stringify({ toolResult, part }, null, 2)}
          </pre>
        </div>
      </div>
    )
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString()
    } catch {
      return dateString
    }
  }

  const getDomainFromUrl = (url: string) => {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  }

  return (
    <div className="web-search-result-container w-full min-w-0">
      <div className="border-border bg-muted/50 flex flex-wrap items-center justify-between gap-3 rounded-t-lg border-b px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex shrink-0 space-x-1.5">
            <div className="bg-tool-search/80 h-3 w-3 rounded-full shadow-sm" />
            <div className="bg-tool-search/60 h-3 w-3 rounded-full shadow-sm" />
            <div className="bg-tool-search/40 h-3 w-3 rounded-full shadow-sm" />
          </div>

          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <Search size={14} className="text-tool-search shrink-0" />
            <span className="text-foreground min-w-0 text-sm font-medium">
              &quot;{args.query || searchData.query || "Unknown query"}&quot;
            </span>
            <span className="bg-tool-search text-foreground rounded-sm px-2 py-0.5 text-xs font-medium">
              WEB
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-muted-foreground text-xs">
            {searchData.totalResults || searchData.results.length} results
          </div>
          {searchData.source ? (
            <span className="text-tool-search bg-tool-search/10 rounded px-1.5 py-0.5 text-xs font-medium">
              {searchData.source}
            </span>
          ) : null}
        </div>
      </div>

      <div className="bg-card max-h-[60vh] space-y-4 overflow-auto p-4">
        {searchData.results.map((item, index) => (
          <div
            key={index}
            className="border-border hover:bg-muted/40 rounded-lg border p-4 transition-colors"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base leading-tight font-medium wrap-anywhere">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-tool-search hover:text-tool-search/80 flex items-center gap-1 hover:underline"
                  >
                    {item.title}
                    <ExternalLink size={12} className="shrink-0" />
                  </a>
                </h3>
              </div>

              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <span className="bg-muted rounded px-2 py-1 font-mono">
                  {item.domain || getDomainFromUrl(item.url)}
                </span>
                {item.publishedDate ? (
                  <>
                    <Clock size={12} />
                    <span>{formatDate(item.publishedDate)}</span>
                  </>
                ) : null}
              </div>

              <p className="text-muted-foreground text-sm leading-relaxed wrap-anywhere">
                {item.snippet}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-border bg-muted/40 rounded-b-lg border-t px-3 py-1">
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <div className="flex items-center space-x-4">
            <span>Format: Web Search</span>
            <span>Results: {searchData.results?.length || 0}</span>
            {searchData.searchTime ? (
              <span>Time: {(searchData.searchTime / 1000).toFixed(2)}s</span>
            ) : null}
          </div>
          <div className="flex items-center space-x-2">
            <span>UTF-8</span>
            <span>Web Results</span>
          </div>
        </div>
      </div>
    </div>
  )
}
