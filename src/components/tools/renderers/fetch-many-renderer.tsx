"use client"

import { useState } from "react"

import { ChevronDown, ChevronRight } from "@/lib/icons"

import {
  CopyButton,
  EmptyState,
  RawPayloadDisclosure,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

interface FetchItem {
  url: string
  status?: number
  title?: string
  summary?: string
  error?: string
  query?: string
}

function statusVariant(code?: number) {
  if (!code) return "neutral" as const
  if (code < 300) return "success" as const
  if (code < 400) return "warning" as const
  return "error" as const
}

function normalizeFetchItems(raw: unknown): FetchItem[] {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.items)
      ? ((raw as Record<string, unknown>).items as unknown[])
      : Array.isArray((raw as Record<string, unknown>)?.results)
        ? ((raw as Record<string, unknown>).results as unknown[])
        : Array.isArray((raw as Record<string, unknown>)?.pages)
          ? ((raw as Record<string, unknown>).pages as unknown[])
          : []
  return arr
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
    .map((r) => ({
      url: String(r.url ?? r.link ?? r.href ?? ""),
      status:
        typeof r.status === "number"
          ? r.status
          : typeof r.statusCode === "number"
            ? r.statusCode
            : undefined,
      title: r.title ? String(r.title) : undefined,
      summary: r.summary
        ? String(r.summary)
        : r.content
          ? String(r.content).slice(0, 200)
          : r.snippet
            ? String(r.snippet)
            : undefined,
      error: r.error ? String(r.error) : undefined,
      query: r.query ? String(r.query) : undefined,
    }))
}

export function FetchManyRenderer({ part }: { part: ToolResultContentPart }) {
  const type = part.type
  const result = part.toolResult as Record<string, unknown> | undefined
  const [openItems, setOpenItems] = useState<Set<number>>(new Set())

  const toggle = (i: number) =>
    setOpenItems((s) => {
      const n = new Set(s)
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      n.has(i) ? n.delete(i) : n.add(i)
      return n
    })

  const items = normalizeFetchItems(
    result?.items ?? result?.results ?? result?.pages ?? result ?? []
  )
  const failed = items.filter((it) => it.error || (it.status != null && it.status >= 400)).length
  const allUrls = items
    .map((it) => it.url)
    .filter(Boolean)
    .join("\n")

  const isSearchBatch = type === "search_batch"
  const title = isSearchBatch ? "Search Batch" : "Fetch Many"

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">{title}</span>
          <ToolStatusBadge variant="neutral">
            {items.length} {isSearchBatch ? "result" : "request"}
            {items.length !== 1 ? "s" : ""}
          </ToolStatusBadge>
          {failed > 0 && <ToolStatusBadge variant="error">{failed} failed</ToolStatusBadge>}
          {allUrls && <CopyButton text={allUrls} className="ml-auto" />}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {items.length === 0 ? (
        <EmptyState>No items</EmptyState>
      ) : (
        <div className="rk-scrollbar max-h-[45vh] divide-y overflow-auto">
          {items.map((item, i) => {
            const hasDetail = Boolean(item.title || item.summary || item.error || item.query)
            const isFailed = Boolean(item.error) || (item.status != null && item.status >= 400)
            return (
              <div key={i}>
                <button
                  type="button"
                  className={`hover:bg-surface-4 flex w-full items-start gap-2 px-3 py-2 text-left ${isFailed ? "bg-destructive/5" : ""}`}
                  onClick={() => hasDetail && toggle(i)}
                >
                  {hasDetail ? (
                    openItems.has(i) ? (
                      <ChevronDown className="text-muted-foreground mt-0.5 h-3 w-3 shrink-0" />
                    ) : (
                      <ChevronRight className="text-muted-foreground mt-0.5 h-3 w-3 shrink-0" />
                    )
                  ) : (
                    <span className="w-3 shrink-0" />
                  )}
                  <span
                    className={`min-w-0 flex-1 truncate font-mono text-[11px] ${isFailed ? "text-destructive" : "text-foreground/80"}`}
                  >
                    {item.url}
                  </span>
                  {item.status != null && (
                    <ToolStatusBadge variant={statusVariant(item.status)} className="shrink-0">
                      {item.status}
                    </ToolStatusBadge>
                  )}
                  {item.error && !item.status && (
                    <ToolStatusBadge variant="error" className="shrink-0">
                      error
                    </ToolStatusBadge>
                  )}
                </button>
                {openItems.has(i) && hasDetail && (
                  <div className="space-y-1 border-t bg-(--surface-4)/40 px-8 py-2">
                    {item.query && (
                      <p className="text-primary font-mono text-[10px]">query: {item.query}</p>
                    )}
                    {item.title && (
                      <p className="text-foreground/80 font-mono text-[10px] font-semibold">
                        {item.title}
                      </p>
                    )}
                    {item.summary && (
                      <p className="text-muted-foreground font-mono text-[10px] leading-relaxed">
                        {item.summary}
                      </p>
                    )}
                    {item.error && (
                      <p className="text-destructive font-mono text-[10px]">{item.error}</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </ToolRendererShell>
  )
}
