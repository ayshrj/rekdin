"use client"

import { useState } from "react"

import {
  EmptyState,
  RawPayloadDisclosure,
  RendererTab,
  RendererTabBar,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

interface LangEntry {
  name: string
  files: number
  lines: number
}

function normalizeLangs(raw: unknown): LangEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
    .map((r) => ({
      name: String(r.name ?? r.language ?? r.lang ?? "Unknown"),
      files: typeof r.files === "number" ? r.files : Number(r.files ?? 0),
      lines: typeof r.lines === "number" ? r.lines : Number(r.lines ?? 0),
    }))
    .sort((a, b) => b.lines - a.lines)
}

function bar(value: number, max: number) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="bg-surface-5 h-1 w-24 overflow-hidden rounded-full">
      <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
    </div>
  )
}

function LangTable({ langs }: { langs: LangEntry[] }) {
  const maxLines = langs[0]?.lines ?? 1
  return (
    <div className="divide-y">
      <div className="flex items-center gap-3 px-3 py-1.5">
        <span className="text-muted-foreground w-28 shrink-0 font-mono text-[10px]">language</span>
        <span className="text-muted-foreground w-12 shrink-0 text-right font-mono text-[10px]">
          files
        </span>
        <span className="text-muted-foreground w-14 shrink-0 text-right font-mono text-[10px]">
          lines
        </span>
        <span className="text-muted-foreground flex-1 font-mono text-[10px]" />
      </div>
      {langs.map((l, i) => (
        <div key={i} className="hover:bg-surface-4 flex items-center gap-3 px-3 py-1.5">
          <span className="text-foreground/80 w-28 shrink-0 truncate font-mono text-[11px]">
            {l.name}
          </span>
          <span className="text-muted-foreground w-12 shrink-0 text-right font-mono text-[10px]">
            {l.files}
          </span>
          <span className="text-foreground/70 w-14 shrink-0 text-right font-mono text-[10px]">
            {l.lines.toLocaleString()}
          </span>
          <div className="flex flex-1 items-center">{bar(l.lines, maxLines)}</div>
        </div>
      ))}
    </div>
  )
}

function DepGraphBody({ result }: { result: Record<string, unknown> }) {
  // Prefer a text output representation; fall back to JSON adjacency list
  const output = (result.output ?? result.graph ?? "") as string
  if (output && typeof output === "string") {
    return (
      <pre className="text-foreground/70 max-h-[40vh] overflow-auto px-3 py-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
        {output}
      </pre>
    )
  }

  // Try edges array
  const edges = result.edges
  if (Array.isArray(edges)) {
    return (
      <div className="max-h-[40vh] divide-y overflow-auto">
        {edges.map((e, i) => {
          const [from, to] = Array.isArray(e) ? e : [e?.from, e?.to]
          return (
            <div key={i} className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
              <span className="text-foreground/80 font-mono text-[11px]">{String(from)}</span>
              <span className="text-muted-foreground font-mono text-[10px]">→</span>
              <span className="text-foreground/80 font-mono text-[11px]">{String(to)}</span>
            </div>
          )
        })}
      </div>
    )
  }

  return <EmptyState>No graph data</EmptyState>
}

function CodeMapBody({ result }: { result: Record<string, unknown> }) {
  const summary = (result.summary ?? result.output ?? result.description ?? "") as string
  const modules = result.modules ?? result.files

  if (summary) {
    return (
      <pre className="text-foreground/70 max-h-[40vh] overflow-auto px-3 py-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
        {summary}
      </pre>
    )
  }

  if (Array.isArray(modules)) {
    return (
      <div className="max-h-[40vh] divide-y overflow-auto">
        {modules.map((m, i) => {
          const name =
            typeof m === "string" ? m : ((m as Record<string, unknown>)?.path ?? String(i))
          return (
            <div key={i} className="hover:bg-surface-4 px-3 py-1.5">
              <span className="text-foreground/80 font-mono text-[11px]">{String(name)}</span>
            </div>
          )
        })}
      </div>
    )
  }

  return <EmptyState>No map data</EmptyState>
}

export function WorkspaceStatsRenderer({ part }: { part: ToolResultContentPart }) {
  const type = part.type
  const result = part.toolResult as Record<string, unknown> | undefined
  const [tab, setTab] = useState<"languages" | "summary">("languages")

  // ── dependency_graph ──────────────────────────────────────────────────────
  if (type === "dependency_graph") {
    const nodeCount = Array.isArray(result?.nodes) ? result.nodes.length : undefined
    const edgeCount = Array.isArray(result?.edges) ? result.edges.length : undefined

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">
              Dependency Graph
            </span>
            {nodeCount != null && (
              <ToolStatusBadge variant="neutral">{nodeCount} nodes</ToolStatusBadge>
            )}
            {edgeCount != null && (
              <span className="text-muted-foreground font-mono text-[10px]">{edgeCount} edges</span>
            )}
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {result ? <DepGraphBody result={result} /> : <EmptyState>No graph data</EmptyState>}
      </ToolRendererShell>
    )
  }

  // ── code_map ──────────────────────────────────────────────────────────────
  if (type === "code_map") {
    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">Code Map</span>
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {result ? <CodeMapBody result={result} /> : <EmptyState>No map data</EmptyState>}
      </ToolRendererShell>
    )
  }

  // ── workspace_stats ───────────────────────────────────────────────────────
  const root = (result?.root ?? result?.workspace ?? "") as string
  const langs = normalizeLangs(result?.languages ?? result?.breakdown)
  const totalFiles = result?.totalFiles ?? result?.files ?? langs.reduce((n, l) => n + l.files, 0)
  const totalLines = result?.totalLines ?? result?.lines ?? langs.reduce((n, l) => n + l.lines, 0)

  const hasLangs = langs.length > 0
  const hasSummary = Boolean(result?.summary ?? result?.description)

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">
            Workspace Stats
          </span>
          {root && <span className="rk-path-chip max-w-50 min-w-0 truncate">{root}</span>}
          {totalFiles != null && (
            <ToolStatusBadge variant="neutral">{String(totalFiles)} files</ToolStatusBadge>
          )}
          {totalLines != null && (
            <span className="text-muted-foreground font-mono text-[10px]">
              {Number(totalLines).toLocaleString()} lines
            </span>
          )}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {!result ? (
        <EmptyState>No stats</EmptyState>
      ) : (
        <>
          {hasLangs && hasSummary && (
            <RendererTabBar>
              <RendererTab active={tab === "languages"} onClick={() => setTab("languages")}>
                Languages
              </RendererTab>
              <RendererTab active={tab === "summary"} onClick={() => setTab("summary")}>
                Summary
              </RendererTab>
            </RendererTabBar>
          )}

          {(tab === "languages" || !hasSummary) && hasLangs && <LangTable langs={langs} />}

          {(tab === "summary" || !hasLangs) && hasSummary && (
            <pre className="text-foreground/70 max-h-[40vh] overflow-auto px-3 py-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
              {String(result.summary ?? result.description)}
            </pre>
          )}

          {!hasLangs && !hasSummary && <EmptyState>No breakdown available</EmptyState>}
        </>
      )}
    </ToolRendererShell>
  )
}
