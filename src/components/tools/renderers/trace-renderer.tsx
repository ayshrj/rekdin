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

function fmtDuration(ms: number | undefined): string {
  if (ms == null) return ""
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

interface TokenUsage {
  tracesWithUsage?: number
  systemPromptTokens?: number
  historyTokens?: number
  toolSchemaTokens?: number
  toolResultTokens?: number
  originalToolResultTokens?: number
  savedToolResultTokens?: number
  completionTokens?: number
  totalPromptTokens?: number
  totalTokens?: number
}

function asTokenUsage(raw: unknown): TokenUsage {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  return raw as TokenUsage
}

function TokenBreakdown({ usage }: { usage: TokenUsage }) {
  const rows: { label: string; value: number | undefined; note?: string }[] = [
    { label: "System prompt", value: usage.systemPromptTokens },
    { label: "History", value: usage.historyTokens },
    { label: "Tool schemas", value: usage.toolSchemaTokens },
    {
      label: "Tool results",
      value: usage.toolResultTokens,
      note:
        usage.originalToolResultTokens != null && usage.savedToolResultTokens != null
          ? `${usage.originalToolResultTokens} orig → saved ${usage.savedToolResultTokens}`
          : undefined,
    },
    { label: "Completion", value: usage.completionTokens },
    { label: "Total prompt", value: usage.totalPromptTokens },
    { label: "Total", value: usage.totalTokens },
  ].filter((r) => r.value != null && r.value > 0)

  if (rows.length === 0) return <EmptyState>No token data</EmptyState>

  return (
    <div className="divide-y">
      {usage.tracesWithUsage != null && usage.tracesWithUsage > 0 && (
        <div className="px-3 py-1.5">
          <span className="text-muted-foreground font-mono text-[10px]">
            {usage.tracesWithUsage} traces with usage data
          </span>
        </div>
      )}
      {rows.map((row, i) => (
        <div key={i} className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
          <span className="text-foreground/70 min-w-0 flex-1 font-mono text-[11px]">
            {row.label}
          </span>
          {row.note && (
            <span className="text-muted-foreground shrink-0 font-mono text-[10px]">{row.note}</span>
          )}
          <span className="text-foreground/90 shrink-0 font-mono text-[11px] font-medium">
            {(row.value ?? 0).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

function CountBreakdown({ counts, label }: { counts: Record<string, number>; label: string }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return null
  return (
    <div className="divide-y">
      <div className="px-3 py-1.5">
        <span className="rk-section-label">{label}</span>
      </div>
      {entries.map(([key, count], i) => (
        <div key={i} className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
          <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
            {key}
          </span>
          <span className="text-muted-foreground shrink-0 font-mono text-[10px]">×{count}</span>
        </div>
      ))}
    </div>
  )
}

function asCountMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  return raw as Record<string, number>
}

// ── TraceSummaryRenderer ──────────────────────────────────────────────────────

export function TraceSummaryRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined
  const [tab, setTab] = useState<"overview" | "tokens" | "warnings">("overview")

  const traceCount = typeof result?.traceCount === "number" ? result.traceCount : 0
  const successCount = typeof result?.successCount === "number" ? result.successCount : 0
  const failureCount = typeof result?.failureCount === "number" ? result.failureCount : 0
  const totalToolCount = typeof result?.totalToolCount === "number" ? result.totalToolCount : 0
  const totalToolDurationMs =
    typeof result?.totalToolDurationMs === "number" ? result.totalToolDurationMs : undefined
  const totalRetries = typeof result?.totalRetries === "number" ? result.totalRetries : 0

  const providerCounts = asCountMap(result?.providerCounts)
  const modelCounts = asCountMap(result?.modelCounts)
  const workflowCounts = asCountMap(result?.workflowCounts)

  const warnings = Array.isArray(result?.warnings) ? (result.warnings as string[]) : []
  const omittedWarnings = typeof result?.omittedWarnings === "number" ? result.omittedWarnings : 0
  const errors = Array.isArray(result?.errors) ? (result.errors as Record<string, unknown>[]) : []

  const tokenUsage = asTokenUsage(result?.tokenUsage)
  const hasWarnings = warnings.length > 0 || errors.length > 0
  const hasTokens = (tokenUsage.totalTokens ?? 0) > 0

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Trace Summary</span>
          <ToolStatusBadge variant="neutral">{traceCount} traces</ToolStatusBadge>
          {successCount > 0 && (
            <ToolStatusBadge variant="success">{successCount} ok</ToolStatusBadge>
          )}
          {failureCount > 0 && (
            <ToolStatusBadge variant="error">{failureCount} failed</ToolStatusBadge>
          )}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      <RendererTabBar>
        <RendererTab active={tab === "overview"} onClick={() => setTab("overview")}>
          Overview
        </RendererTab>
        {hasTokens && (
          <RendererTab active={tab === "tokens"} onClick={() => setTab("tokens")}>
            Tokens
          </RendererTab>
        )}
        {hasWarnings && (
          <RendererTab active={tab === "warnings"} onClick={() => setTab("warnings")}>
            Warnings
          </RendererTab>
        )}
      </RendererTabBar>

      {tab === "overview" && (
        <div className="rk-scrollbar max-h-[45vh] overflow-auto">
          <CountBreakdown counts={providerCounts} label="Provider" />
          <CountBreakdown counts={modelCounts} label="Model" />
          <CountBreakdown counts={workflowCounts} label="Workflow" />
          <div className="divide-y">
            <div className="border-t px-3 py-1.5">
              <span className="rk-section-label">Stats</span>
            </div>
            <div className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
              <span className="text-foreground/70 flex-1 font-mono text-[11px]">Total tools</span>
              <span className="text-foreground/90 font-mono text-[11px]">{totalToolCount}</span>
            </div>
            {totalToolDurationMs != null && (
              <div className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
                <span className="text-foreground/70 flex-1 font-mono text-[11px]">
                  Tool duration
                </span>
                <span className="text-foreground/90 font-mono text-[11px]">
                  {fmtDuration(totalToolDurationMs)}
                </span>
              </div>
            )}
            {totalRetries > 0 && (
              <div className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
                <span className="text-foreground/70 flex-1 font-mono text-[11px]">Retries</span>
                <span className="text-foreground/90 font-mono text-[11px]">{totalRetries}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "tokens" && hasTokens && (
        <div className="rk-scrollbar max-h-[45vh] overflow-auto">
          <TokenBreakdown usage={tokenUsage} />
        </div>
      )}

      {tab === "warnings" && hasWarnings && (
        <div className="rk-scrollbar max-h-[45vh] divide-y overflow-auto">
          {warnings.map((w, i) => (
            <div key={i} className="hover:bg-surface-4 px-3 py-1.5">
              <p className="text-status-warning font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                {w}
              </p>
            </div>
          ))}
          {omittedWarnings > 0 && (
            <div className="px-3 py-1.5">
              <span className="text-muted-foreground font-mono text-[10px]">
                +{omittedWarnings} more warnings omitted
              </span>
            </div>
          )}
          {errors.map((err, i) => (
            <div key={`err-${i}`} className="hover:bg-surface-4 px-3 py-1.5">
              <span className="text-muted-foreground font-mono text-[10px]">
                {String(err.traceId ?? "")}
              </span>
              <p className="text-destructive font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                {String(err.error ?? "")}
              </p>
            </div>
          ))}
        </div>
      )}
    </ToolRendererShell>
  )
}

// ── TokenUsageReportRenderer ──────────────────────────────────────────────────

export function TokenUsageReportRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined
  const [tab, setTab] = useState<"sessions" | "breakdown">("sessions")

  const sessionCount = typeof result?.sessionCount === "number" ? result.sessionCount : 0
  const traceTokenUsage = asTokenUsage(result?.traceTokenUsage)
  const totalTokens = traceTokenUsage.totalTokens ?? 0

  const bySession = Array.isArray(result?.bySession)
    ? (result.bySession as Record<string, unknown>[])
    : []

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Token Usage</span>
          <ToolStatusBadge variant="neutral">{sessionCount} sessions</ToolStatusBadge>
          {totalTokens > 0 && (
            <ToolStatusBadge variant="neutral">
              {totalTokens.toLocaleString()} tokens
            </ToolStatusBadge>
          )}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      <RendererTabBar>
        <RendererTab active={tab === "sessions"} onClick={() => setTab("sessions")}>
          Sessions
        </RendererTab>
        <RendererTab active={tab === "breakdown"} onClick={() => setTab("breakdown")}>
          Breakdown
        </RendererTab>
      </RendererTabBar>

      {tab === "sessions" && (
        <div className="rk-scrollbar max-h-[45vh] divide-y overflow-auto">
          {bySession.length === 0 ? (
            <EmptyState>No session data</EmptyState>
          ) : (
            bySession.map((session, i) => {
              const title = String(session.title ?? session.sessionId ?? `Session ${i + 1}`)
              const msgCount =
                typeof session.messageCount === "number" ? session.messageCount : undefined
              const traceCount =
                typeof session.traceCount === "number" ? session.traceCount : undefined
              const sessionUsage = asTokenUsage(session.traceTokenUsage)
              const sessionTotal = sessionUsage.totalTokens ?? 0

              return (
                <div key={i} className="hover:bg-surface-4 flex items-center gap-2 px-3 py-2">
                  <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
                    {title}
                  </span>
                  {msgCount != null && (
                    <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                      {msgCount} msgs
                    </span>
                  )}
                  {traceCount != null && (
                    <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                      {traceCount} traces
                    </span>
                  )}
                  {sessionTotal > 0 && (
                    <span className="text-foreground/80 shrink-0 font-mono text-[11px] font-medium">
                      {sessionTotal.toLocaleString()}
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {tab === "breakdown" && (
        <div className="rk-scrollbar max-h-[45vh] overflow-auto">
          <TokenBreakdown usage={traceTokenUsage} />
        </div>
      )}
    </ToolRendererShell>
  )
}
