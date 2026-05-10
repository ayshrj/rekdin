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

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

// ── robots_txt ────────────────────────────────────────────────────────────────

interface RobotRule {
  path: string
  allow: boolean
  userAgent?: string
}

function normalizeRobotsRules(raw: unknown): RobotRule[] {
  // Structured array
  if (Array.isArray(raw)) {
    return (raw as Record<string, unknown>[])
      .filter((r) => r && typeof r === "object")
      .map((r) => ({
        path: String(r.path ?? r.rule ?? r.url ?? ""),
        allow:
          r.allow !== false &&
          !String(r.type ?? "")
            .toLowerCase()
            .includes("disallow"),
        userAgent: r.userAgent ? String(r.userAgent) : undefined,
      }))
  }
  // Parse from raw text
  if (typeof raw !== "string" || !raw.trim()) return []
  const lines = raw.split(/\r?\n/)
  const rules: RobotRule[] = []
  let currentAgent = "*"
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const [key, ...rest] = trimmed.split(":")
    const value = rest.join(":").trim()
    if (key.toLowerCase() === "user-agent") {
      currentAgent = value
      continue
    }
    if (key.toLowerCase() === "allow")
      rules.push({ path: value, allow: true, userAgent: currentAgent })
    if (key.toLowerCase() === "disallow" && value)
      rules.push({ path: value, allow: false, userAgent: currentAgent })
  }
  return rules
}

// ── sitemap_fetch ─────────────────────────────────────────────────────────────

function normalizeSitemapUrls(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((u) =>
      typeof u === "string" ? u : String((u as Record<string, unknown>)?.url ?? u)
    )
  }
  return []
}

// ── rss_fetch ─────────────────────────────────────────────────────────────────

interface RssItem {
  title: string
  link?: string
  date?: string
  summary?: string
}

function normalizeRssItems(raw: unknown): RssItem[] {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.items)
      ? ((raw as Record<string, unknown>).items as unknown[])
      : Array.isArray((raw as Record<string, unknown>)?.entries)
        ? ((raw as Record<string, unknown>).entries as unknown[])
        : []
  return arr
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
    .map((r) => ({
      title: String(r.title ?? r.name ?? ""),
      link: r.link ? String(r.link) : r.url ? String(r.url) : undefined,
      date: r.date
        ? String(r.date)
        : r.pubDate
          ? String(r.pubDate)
          : r.published
            ? String(r.published)
            : undefined,
      summary: r.summary ? String(r.summary) : r.description ? String(r.description) : undefined,
    }))
}

// ── page_metadata_batch ───────────────────────────────────────────────────────

interface PageMeta {
  url: string
  title?: string
  description?: string
  status?: number
}

function normalizePageMeta(raw: unknown): PageMeta[] {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.pages)
      ? ((raw as Record<string, unknown>).pages as unknown[])
      : Array.isArray((raw as Record<string, unknown>)?.results)
        ? ((raw as Record<string, unknown>).results as unknown[])
        : []
  return arr
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
    .map((r) => ({
      url: String(r.url ?? r.link ?? ""),
      title: r.title ? String(r.title) : undefined,
      description: r.description ? String(r.description) : undefined,
      status: typeof r.status === "number" ? r.status : undefined,
    }))
}

// ── Collapsible sitemap item ──────────────────────────────────────────────────

function SitemapList({ urls, maxShown = 50 }: { urls: string[]; maxShown?: number }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? urls : urls.slice(0, maxShown)
  return (
    <div className="rk-scrollbar max-h-[40vh] overflow-auto">
      {shown.map((u, i) => (
        <div key={i} className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1">
          <span className="text-foreground/70 min-w-0 flex-1 truncate font-mono text-[10px]">
            {u}
          </span>
          <CopyButton text={u} />
        </div>
      ))}
      {urls.length > maxShown && !expanded && (
        <button
          type="button"
          className="rk-flat-button w-full py-1.5 text-[10px]"
          onClick={() => setExpanded(true)}
        >
          Show all {urls.length} URLs
        </button>
      )}
    </div>
  )
}

// ── Main renderer ─────────────────────────────────────────────────────────────

export function WebMetadataRenderer({ part }: { part: ToolResultContentPart }) {
  const type = part.type
  const result = part.toolResult as Record<string, unknown> | undefined
  const [openItems, setOpenItems] = useState<Set<number>>(new Set([0]))

  const toggleItem = (i: number) =>
    setOpenItems((s) => {
      const n = new Set(s)
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      n.has(i) ? n.delete(i) : n.add(i)
      return n
    })

  // ── robots_txt ─────────────────────────────────────────────────────────────
  if (type === "robots_txt") {
    const sourceUrl = (result?.url ?? result?.source ?? "") as string
    const rawRules = result?.rules ?? result?.directives ?? result?.content ?? result
    const rules = normalizeRobotsRules(rawRules)
    const sitemaps = Array.isArray(result?.sitemaps) ? result.sitemaps.map(String) : []
    const allowed = rules.filter((r) => r.allow).length
    const disallowed = rules.filter((r) => !r.allow).length

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">robots.txt</span>
            {sourceUrl && (
              <span className="rk-path-chip max-w-40 min-w-0 truncate">{getDomain(sourceUrl)}</span>
            )}
            <ToolStatusBadge variant="neutral">
              {rules.length} rule{rules.length !== 1 ? "s" : ""}
            </ToolStatusBadge>
            {allowed > 0 && (
              <span className="font-mono text-[10px] text-emerald-600">{allowed} allow</span>
            )}
            {disallowed > 0 && (
              <span className="text-destructive font-mono text-[10px]">{disallowed} disallow</span>
            )}
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {rules.length === 0 ? (
          <EmptyState>No rules</EmptyState>
        ) : (
          <div className="rk-scrollbar max-h-[35vh] divide-y overflow-auto">
            {rules.map((r, i) => (
              <div key={i} className="hover:bg-surface-4 flex items-center gap-2.5 px-3 py-1.5">
                <span
                  className={`w-16 shrink-0 rounded border px-1.5 py-0.5 text-center font-mono text-[9px] font-semibold ${
                    r.allow
                      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600"
                      : "text-destructive border-destructive/25 bg-destructive/10"
                  }`}
                >
                  {r.allow ? "Allow" : "Disallow"}
                </span>
                <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
                  {r.path}
                </span>
                {r.userAgent && r.userAgent !== "*" && (
                  <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                    {r.userAgent}
                  </span>
                )}
              </div>
            ))}
            {sitemaps.map((s, i) => (
              <div
                key={`s${i}`}
                className="hover:bg-surface-4 flex items-center gap-2.5 px-3 py-1.5"
              >
                <span className="w-16 shrink-0 rounded border border-blue-500/25 bg-blue-500/10 px-1.5 py-0.5 text-center font-mono text-[9px] font-semibold text-blue-500">
                  Sitemap
                </span>
                <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
                  {s}
                </span>
              </div>
            ))}
          </div>
        )}
      </ToolRendererShell>
    )
  }

  // ── sitemap_fetch ──────────────────────────────────────────────────────────
  if (type === "sitemap_fetch") {
    const rawUrls = result?.urls ?? result?.entries ?? result?.links ?? result ?? []
    const urls = normalizeSitemapUrls(rawUrls)
    const total = typeof result?.total === "number" ? result.total : urls.length
    const sourceUrl = (result?.url ?? result?.source ?? "") as string

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">Sitemap</span>
            {sourceUrl && (
              <span className="rk-path-chip max-w-40 min-w-0 truncate">{getDomain(sourceUrl)}</span>
            )}
            <ToolStatusBadge variant="neutral">
              {total} URL{total !== 1 ? "s" : ""}
            </ToolStatusBadge>
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {urls.length === 0 ? <EmptyState>No URLs</EmptyState> : <SitemapList urls={urls} />}
      </ToolRendererShell>
    )
  }

  // ── rss_fetch ──────────────────────────────────────────────────────────────
  if (type === "rss_fetch") {
    const feedTitle = (result?.title ?? result?.feedTitle ?? result?.channel ?? "") as string
    const feedUrl = (result?.url ?? result?.feedUrl ?? result?.link ?? "") as string
    const items = normalizeRssItems(result?.items ?? result?.entries ?? result ?? [])

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">RSS Feed</span>
            {feedTitle && (
              <span className="text-foreground/80 max-w-40 min-w-0 truncate font-mono text-[11px]">
                {feedTitle}
              </span>
            )}
            {feedUrl && (
              <span className="rk-path-chip max-w-40 min-w-0 truncate">{getDomain(feedUrl)}</span>
            )}
            <ToolStatusBadge variant="neutral">
              {items.length} item{items.length !== 1 ? "s" : ""}
            </ToolStatusBadge>
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {items.length === 0 ? (
          <EmptyState>No items</EmptyState>
        ) : (
          <div className="rk-scrollbar max-h-[40vh] divide-y overflow-auto">
            {items.map((item, i) => (
              <div key={i} className="hover:bg-surface-4 px-3 py-2">
                <div className="flex items-start gap-2">
                  <span className="text-foreground/80 min-w-0 flex-1 font-mono text-[11px] leading-snug">
                    {item.title}
                  </span>
                  {item.date && (
                    <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                      {item.date}
                    </span>
                  )}
                </div>
                {item.summary && (
                  <p className="text-muted-foreground mt-0.5 line-clamp-2 font-mono text-[10px] leading-relaxed">
                    {item.summary}
                  </p>
                )}
                {item.link && (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary mt-0.5 block truncate font-mono text-[10px] hover:underline"
                  >
                    {item.link}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </ToolRendererShell>
    )
  }

  // ── page_diff_snapshot ────────────────────────────────────────────────────
  if (type === "page_diff_snapshot") {
    const before = (result?.before ?? result?.original ?? result?.old ?? "") as string
    const after = (result?.after ?? result?.current ?? result?.new ?? "") as string
    const url = (result?.url ?? result?.source ?? "") as string
    const changed = Boolean(result?.changed ?? before !== after)

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">Page Diff</span>
            {url && (
              <span className="rk-path-chip max-w-40 min-w-0 truncate">{getDomain(url)}</span>
            )}
            <ToolStatusBadge variant={changed ? "warning" : "success"}>
              {changed ? "changed" : "unchanged"}
            </ToolStatusBadge>
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {!before && !after ? (
          <EmptyState>No snapshot data</EmptyState>
        ) : (
          <div className="grid grid-cols-2 divide-x">
            {[
              { label: "before", text: before },
              { label: "after", text: after },
            ].map(({ label, text }) => (
              <div key={label}>
                <div className="bg-surface-4 flex items-center justify-between border-b px-3 py-1">
                  <span className="rk-section-label">{label}</span>
                  {text && <CopyButton text={text} />}
                </div>
                <pre className="rk-scrollbar text-foreground/70 max-h-[35vh] overflow-auto px-3 py-2 font-mono text-[10px] leading-relaxed whitespace-pre-wrap">
                  {text || "—"}
                </pre>
              </div>
            ))}
          </div>
        )}
      </ToolRendererShell>
    )
  }

  // ── page_metadata_batch (default) ─────────────────────────────────────────
  const pages = normalizePageMeta(result?.pages ?? result?.results ?? result ?? [])

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Page Metadata</span>
          <ToolStatusBadge variant="neutral">
            {pages.length} page{pages.length !== 1 ? "s" : ""}
          </ToolStatusBadge>
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {pages.length === 0 ? (
        <EmptyState>No pages</EmptyState>
      ) : (
        <div className="rk-scrollbar max-h-[40vh] divide-y overflow-auto">
          {pages.map((p, i) => (
            <div key={i}>
              <button
                type="button"
                className="hover:bg-surface-4 flex w-full items-start gap-2 px-3 py-2 text-left"
                onClick={() => toggleItem(i)}
              >
                {openItems.has(i) ? (
                  <ChevronDown className="text-muted-foreground mt-0.5 h-3 w-3 shrink-0" />
                ) : (
                  <ChevronRight className="text-muted-foreground mt-0.5 h-3 w-3 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <span className="text-foreground/80 block min-w-0 truncate font-mono text-[11px]">
                    {p.title ?? getDomain(p.url)}
                  </span>
                  <span className="text-muted-foreground block min-w-0 truncate font-mono text-[10px]">
                    {p.url}
                  </span>
                </div>
                {p.status != null && (
                  <span
                    className={`shrink-0 font-mono text-[10px] font-semibold ${p.status < 300 ? "text-emerald-600" : p.status < 400 ? "text-amber-500" : "text-destructive"}`}
                  >
                    {p.status}
                  </span>
                )}
              </button>
              {openItems.has(i) && p.description && (
                <div className="border-t bg-(--surface-4)/40 px-8 py-1.5">
                  <p className="text-muted-foreground font-mono text-[10px] leading-relaxed">
                    {p.description}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </ToolRendererShell>
  )
}
