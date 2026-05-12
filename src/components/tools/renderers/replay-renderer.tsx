"use client"

import { useState } from "react"

import {
  EmptyState,
  ErrorBanner,
  RawPayloadDisclosure,
  RendererTab,
  RendererTabBar,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

function fmtDuration(ms: number | undefined): string {
  if (ms == null) return ""
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function statusVariant(status: string | undefined) {
  if (!status) return "neutral" as const
  if (status === "success") return "success" as const
  if (status === "error" || status === "failed") return "error" as const
  if (status === "running") return "info" as const
  return "neutral" as const
}

function fmtTime(ts: string | undefined): string {
  if (!ts) return ""
  const d = new Date(ts)
  return isNaN(d.getTime()) ? ts : d.toLocaleTimeString()
}

interface TimelineRow {
  id?: unknown
  type?: unknown
  toolName?: unknown
  status?: unknown
  duration?: unknown
  timestamp?: unknown
  dataPreview?: unknown
}

function TimelineList({ rows, emptyText }: { rows: TimelineRow[]; emptyText: string }) {
  if (rows.length === 0) return <EmptyState>{emptyText}</EmptyState>
  return (
    <div className="rk-scrollbar max-h-[45vh] divide-y overflow-auto">
      {rows.map((row, i) => {
        const toolName = row.toolName ? String(row.toolName) : String(row.type ?? "event")
        const status = row.status ? String(row.status) : undefined
        const dur = typeof row.duration === "number" ? row.duration : undefined
        const ts = row.timestamp ? String(row.timestamp) : undefined

        return (
          <div key={i} className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
            {status && (
              <ToolStatusBadge variant={statusVariant(status)} className="shrink-0">
                {status}
              </ToolStatusBadge>
            )}
            <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
              {toolName}
            </span>
            {ts && (
              <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                {fmtTime(ts)}
              </span>
            )}
            {dur != null && (
              <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                {fmtDuration(dur)}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── ReplaySummaryRenderer ─────────────────────────────────────────────────────

export function ReplaySummaryRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined
  const [tab, setTab] = useState<"timeline" | "slow" | "warnings">("timeline")

  const found = result?.found !== false
  if (!found) {
    return (
      <ToolRendererShell
        header={<span className="text-foreground font-mono text-[11px] font-semibold">Replay</span>}
        footer={<RawPayloadDisclosure payload={result} />}
      >
        <ErrorBanner>{String(result?.error ?? "Replay not found.")}</ErrorBanner>
      </ToolRendererShell>
    )
  }

  const durationMs = typeof result?.durationMs === "number" ? result.durationMs : undefined
  const eventCount = typeof result?.eventCount === "number" ? result.eventCount : 0
  const omittedToolTimeline =
    typeof result?.omittedToolTimeline === "number" ? result.omittedToolTimeline : 0

  const toolTimeline = Array.isArray(result?.toolTimeline)
    ? (result.toolTimeline as TimelineRow[])
    : []
  const slowestSteps = Array.isArray(result?.slowestSteps)
    ? (result.slowestSteps as TimelineRow[])
    : []
  const warnings = Array.isArray(result?.warnings) ? (result.warnings as unknown[]) : []
  const failedTools = Array.isArray(result?.failedTools)
    ? (result.failedTools as TimelineRow[])
    : []

  const hasSlow = slowestSteps.length > 0
  const hasWarnings = warnings.length > 0

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Replay</span>
          {durationMs != null && (
            <ToolStatusBadge variant="neutral">{fmtDuration(durationMs)}</ToolStatusBadge>
          )}
          <span className="text-muted-foreground font-mono text-[10px]">{eventCount} events</span>
          {failedTools.length > 0 && (
            <ToolStatusBadge variant="error">{failedTools.length} failed</ToolStatusBadge>
          )}
          {omittedToolTimeline > 0 && (
            <span className="text-muted-foreground font-mono text-[10px]">
              +{omittedToolTimeline} omitted
            </span>
          )}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      <RendererTabBar>
        <RendererTab active={tab === "timeline"} onClick={() => setTab("timeline")}>
          Timeline
        </RendererTab>
        {hasSlow && (
          <RendererTab active={tab === "slow"} onClick={() => setTab("slow")}>
            Slow
          </RendererTab>
        )}
        {hasWarnings && (
          <RendererTab active={tab === "warnings"} onClick={() => setTab("warnings")}>
            Warnings
          </RendererTab>
        )}
      </RendererTabBar>

      {tab === "timeline" && <TimelineList rows={toolTimeline} emptyText="No tool events" />}

      {tab === "slow" && hasSlow && <TimelineList rows={slowestSteps} emptyText="No slow steps" />}

      {tab === "warnings" && hasWarnings && (
        <div className="rk-scrollbar max-h-[45vh] divide-y overflow-auto">
          {warnings.map((w, i) => (
            <div key={i} className="hover:bg-surface-4 px-3 py-1.5">
              <p className="text-status-warning font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                {String(w)}
              </p>
            </div>
          ))}
        </div>
      )}
    </ToolRendererShell>
  )
}

// ── ReplaySearchRenderer ──────────────────────────────────────────────────────

export function ReplaySearchRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined

  const found = result?.found !== false
  if (!found) {
    return (
      <ToolRendererShell
        header={
          <span className="text-foreground font-mono text-[11px] font-semibold">Replay Search</span>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        <ErrorBanner>{String(result?.error ?? "Replay not found.")}</ErrorBanner>
      </ToolRendererShell>
    )
  }

  const query = result?.query ? String(result.query) : ""
  const eventType = result?.eventType ? String(result.eventType) : ""
  const toolName = result?.toolName ? String(result.toolName) : ""
  const statusFilter = result?.status ? String(result.status) : ""
  const totalMatches = typeof result?.totalMatches === "number" ? result.totalMatches : 0
  const omittedMatches = typeof result?.omittedMatches === "number" ? result.omittedMatches : 0

  const matches = Array.isArray(result?.matches) ? (result.matches as TimelineRow[]) : []

  const activeFilters = [
    query && { label: "query", value: query },
    eventType && { label: "type", value: eventType },
    toolName && { label: "tool", value: toolName },
    statusFilter && { label: "status", value: statusFilter },
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Replay Search</span>
          {activeFilters.map((f, i) => (
            <span key={i} className="rk-path-chip max-w-28 min-w-0 truncate">
              {f.label}: {f.value}
            </span>
          ))}
          <ToolStatusBadge variant="neutral">{totalMatches} matches</ToolStatusBadge>
          {omittedMatches > 0 && (
            <span className="text-muted-foreground font-mono text-[10px]">
              +{omittedMatches} omitted
            </span>
          )}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {matches.length === 0 ? (
        <EmptyState>No matches</EmptyState>
      ) : (
        <div className="rk-scrollbar max-h-[50vh] divide-y overflow-auto">
          {matches.map((match, i) => {
            const name = match.toolName
              ? String(match.toolName)
              : match.type
                ? String(match.type)
                : "event"
            const status = match.status ? String(match.status) : undefined
            const preview = match.dataPreview ? String(match.dataPreview).slice(0, 120) : undefined
            const ts = match.timestamp ? String(match.timestamp) : undefined

            return (
              <div key={i} className="hover:bg-surface-4 px-3 py-1.5">
                <div className="flex items-center gap-2">
                  {status && (
                    <ToolStatusBadge variant={statusVariant(status)} className="shrink-0">
                      {status}
                    </ToolStatusBadge>
                  )}
                  <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
                    {name}
                  </span>
                  {ts && (
                    <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                      {fmtTime(ts)}
                    </span>
                  )}
                </div>
                {preview && (
                  <p className="text-muted-foreground mt-0.5 font-mono text-[10px] leading-relaxed whitespace-pre-wrap">
                    {preview}
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
