"use client"

import { useState } from "react"

import {
  EmptyState,
  RawPayloadDisclosure,
  RendererTab,
  RendererTabBar,
  ToolRendererShell,
  ToolStatusBadge,
} from "../renderer-primitives"
import { type ToolResultContentPart } from "../tool-result-renderer"

// ── Console logs ──────────────────────────────────────────────────────────────

interface ConsoleEntry {
  level: string
  message: string
  timestamp?: string
}

const LEVEL_BADGE: Record<string, string> = {
  error: "text-destructive border-destructive/25 bg-destructive/10",
  warn: "text-amber-500 border-amber-500/25 bg-amber-500/10",
  warning: "text-amber-500 border-amber-500/25 bg-amber-500/10",
  info: "text-blue-500 border-blue-500/25 bg-blue-500/10",
  log: "text-muted-foreground border-border bg-surface-4",
  debug: "text-muted-foreground border-border bg-surface-4",
}

function levelClass(level: string) {
  return LEVEL_BADGE[level.toLowerCase()] ?? "text-muted-foreground border-border bg-surface-4"
}

function normalizeConsoleLogs(raw: unknown): ConsoleEntry[] {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.logs)
      ? ((raw as Record<string, unknown>).logs as unknown[])
      : Array.isArray((raw as Record<string, unknown>)?.entries)
        ? ((raw as Record<string, unknown>).entries as unknown[])
        : []
  return arr
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
    .map((r) => ({
      level: String(r.level ?? r.type ?? "log").toLowerCase(),
      message: String(r.message ?? r.text ?? r.args ?? ""),
      timestamp: r.timestamp ? String(r.timestamp) : undefined,
    }))
}

// ── Network log ───────────────────────────────────────────────────────────────

interface NetworkEntry {
  method: string
  url: string
  status?: number
  size?: number
  duration?: number
  type?: string
}

const METHOD_COLORS: Record<string, string> = {
  GET: "text-emerald-600 bg-emerald-500/10 border-emerald-500/25",
  POST: "text-blue-500 bg-blue-500/10 border-blue-500/25",
  PUT: "text-amber-500 bg-amber-500/10 border-amber-500/25",
  PATCH: "text-amber-400 bg-amber-400/10 border-amber-400/25",
  DELETE: "text-destructive bg-destructive/10 border-destructive/25",
}

function methodClass(m: string) {
  return METHOD_COLORS[m.toUpperCase()] ?? "text-muted-foreground bg-surface-4 border-border"
}

function statusClass(s?: number) {
  if (!s) return "text-muted-foreground"
  if (s < 300) return "text-emerald-600"
  if (s < 400) return "text-amber-500"
  return "text-destructive"
}

function formatSize(bytes?: number): string {
  if (bytes == null) return ""
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function normalizeNetworkLog(raw: unknown): NetworkEntry[] {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.requests)
      ? ((raw as Record<string, unknown>).requests as unknown[])
      : Array.isArray((raw as Record<string, unknown>)?.entries)
        ? ((raw as Record<string, unknown>).entries as unknown[])
        : []
  return arr
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
    .map((r) => ({
      method: String(r.method ?? "GET").toUpperCase(),
      url: String(r.url ?? r.request ?? ""),
      status:
        typeof r.status === "number"
          ? r.status
          : typeof r.statusCode === "number"
            ? r.statusCode
            : undefined,
      size:
        typeof r.size === "number"
          ? r.size
          : typeof r.responseSize === "number"
            ? r.responseSize
            : undefined,
      duration:
        typeof r.duration === "number"
          ? r.duration
          : typeof r.time === "number"
            ? r.time
            : undefined,
      type: r.type ? String(r.type) : r.resourceType ? String(r.resourceType) : undefined,
    }))
}

// ── Main renderer ─────────────────────────────────────────────────────────────

export function BrowserLogsRenderer({ part }: { part: ToolResultContentPart }) {
  const type = part.type
  const result = part.toolResult as Record<string, unknown> | undefined

  // ✅ moved hooks to top
  const [filterLevel, setFilterLevel] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")

  // ── browser_network_log ────────────────────────────────────────────────────
  if (type === "browser_network_log") {
    const entries = normalizeNetworkLog(result?.requests ?? result?.entries ?? result ?? [])

    const filtered =
      filterStatus === "all"
        ? entries
        : filterStatus === "error"
          ? entries.filter((e) => e.status != null && e.status >= 400)
          : filterStatus === "redirect"
            ? entries.filter((e) => e.status != null && e.status >= 300 && e.status < 400)
            : entries

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">Network Log</span>
            <ToolStatusBadge variant="neutral">
              {entries.length} request{entries.length !== 1 ? "s" : ""}
            </ToolStatusBadge>
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        <RendererTabBar>
          {["all", "error", "redirect"].map((f) => (
            <RendererTab key={f} active={filterStatus === f} onClick={() => setFilterStatus(f)}>
              {f}
            </RendererTab>
          ))}
        </RendererTabBar>

        {filtered.length === 0 ? (
          <EmptyState>No requests</EmptyState>
        ) : (
          <div className="rk-scrollbar max-h-[40vh] divide-y overflow-auto">
            {filtered.map((e, i) => (
              <div key={i} className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
                <span
                  className={`w-12 shrink-0 rounded border px-1 py-px text-center font-mono text-[9px] font-semibold ${methodClass(e.method)}`}
                >
                  {e.method}
                </span>

                <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[10px]">
                  {e.url}
                </span>

                {e.status != null && (
                  <span
                    className={`shrink-0 font-mono text-[10px] font-semibold ${statusClass(e.status)}`}
                  >
                    {e.status}
                  </span>
                )}

                {e.size != null && (
                  <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                    {formatSize(e.size)}
                  </span>
                )}

                {e.duration != null && (
                  <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                    {e.duration}ms
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </ToolRendererShell>
    )
  }

  // ── browser_console_logs ──────────────────────────────────────────────────
  const logs = normalizeConsoleLogs(result?.logs ?? result?.entries ?? result ?? [])

  const LEVELS = ["all", "error", "warn", "info", "log"]

  const counts = LEVELS.slice(1).reduce<Record<string, number>>((acc, l) => {
    acc[l] = logs.filter((e) => e.level === l || (l === "warn" && e.level === "warning")).length
    return acc
  }, {})

  const filtered =
    filterLevel === "all"
      ? logs
      : logs.filter(
          (e) => e.level === filterLevel || (filterLevel === "warn" && e.level === "warning")
        )

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Console</span>

          <ToolStatusBadge variant="neutral">
            {logs.length} entr{logs.length !== 1 ? "ies" : "y"}
          </ToolStatusBadge>

          {counts.error > 0 && (
            <ToolStatusBadge variant="error">
              {counts.error} error{counts.error !== 1 ? "s" : ""}
            </ToolStatusBadge>
          )}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      <RendererTabBar>
        {LEVELS.map((l) => (
          <RendererTab key={l} active={filterLevel === l} onClick={() => setFilterLevel(l)}>
            {l}
            {l !== "all" && counts[l] > 0 ? ` (${counts[l]})` : ""}
          </RendererTab>
        ))}
      </RendererTabBar>

      {filtered.length === 0 ? (
        <EmptyState>No log entries</EmptyState>
      ) : (
        <div className="rk-scrollbar max-h-[40vh] divide-y overflow-auto font-mono">
          {filtered.map((e, i) => (
            <div key={i} className="hover:bg-surface-4 flex items-start gap-2 px-3 py-1.5">
              <span
                className={`mt-px shrink-0 rounded border px-1 py-px text-[9px] font-semibold ${levelClass(e.level)}`}
              >
                {e.level.slice(0, 5).toUpperCase()}
              </span>

              <span className="text-foreground/80 min-w-0 flex-1 text-[10px] leading-relaxed wrap-break-word">
                {e.message}
              </span>

              {e.timestamp && (
                <span className="text-muted-foreground shrink-0 text-[9px]">{e.timestamp}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </ToolRendererShell>
  )
}
