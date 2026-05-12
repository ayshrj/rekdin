"use client"

import {
  CopyButton,
  EmptyState,
  ErrorBanner,
  RawPayloadDisclosure,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`
}

function UsageBar({ used, total, label }: { used: number; total: number; label: string }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0
  const variant = pct > 90 ? "bg-destructive" : pct > 70 ? "bg-status-warning" : "bg-primary"
  return (
    <div className="hover:bg-surface-4 px-3 py-1.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-muted-foreground font-mono text-[10px]">{label}</span>
        <span className="text-foreground/70 font-mono text-[10px]">
          {fmtBytes(used)} / {fmtBytes(total)} ({pct.toFixed(0)}%)
        </span>
      </div>
      <div className="bg-surface-3 h-1.5 w-full overflow-hidden rounded-full">
        <div className={`h-full rounded-full ${variant}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── SystemInfoRenderer ────────────────────────────────────────────────────────

export function SystemInfoRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined

  const platform = result?.platform ? String(result.platform) : undefined
  const arch = result?.arch ? String(result.arch) : undefined
  const cpuModel = result?.cpuModel ? String(result.cpuModel) : undefined
  const cpuCores = typeof result?.cpuCores === "number" ? result.cpuCores : undefined
  const nodeVersion = result?.nodeVersion ? String(result.nodeVersion) : undefined
  const uptimeSeconds = typeof result?.uptimeSeconds === "number" ? result.uptimeSeconds : undefined

  const totalMemory = typeof result?.totalMemoryBytes === "number" ? result.totalMemoryBytes : 0
  const freeMemory = typeof result?.freeMemoryBytes === "number" ? result.freeMemoryBytes : 0
  const usedMemory = totalMemory - freeMemory

  const diskTotal = typeof result?.diskTotalBytes === "number" ? result.diskTotalBytes : 0
  const diskUsed = typeof result?.diskUsedBytes === "number" ? result.diskUsedBytes : 0

  function fmtUptime(s: number): string {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">System Info</span>
          {platform && <span className="rk-path-chip shrink-0">{platform}</span>}
          {arch && <span className="rk-path-chip shrink-0">{arch}</span>}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      <div className="divide-y">
        {cpuModel && (
          <div className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
            <span className="text-muted-foreground w-20 shrink-0 font-mono text-[10px]">cpu</span>
            <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
              {cpuModel}
            </span>
            {cpuCores != null && (
              <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                {cpuCores} cores
              </span>
            )}
          </div>
        )}
        {nodeVersion && (
          <div className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
            <span className="text-muted-foreground w-20 shrink-0 font-mono text-[10px]">node</span>
            <span className="text-foreground/80 font-mono text-[11px]">{nodeVersion}</span>
          </div>
        )}
        {uptimeSeconds != null && (
          <div className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
            <span className="text-muted-foreground w-20 shrink-0 font-mono text-[10px]">
              uptime
            </span>
            <span className="text-foreground/80 font-mono text-[11px]">
              {fmtUptime(uptimeSeconds)}
            </span>
          </div>
        )}
        {totalMemory > 0 && <UsageBar used={usedMemory} total={totalMemory} label="memory" />}
        {diskTotal > 0 && <UsageBar used={diskUsed} total={diskTotal} label="disk" />}
      </div>
    </ToolRendererShell>
  )
}

// ── ProcessListRenderer ───────────────────────────────────────────────────────

export function ProcessListRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined

  const totalCount = typeof result?.totalCount === "number" ? result.totalCount : 0
  const filter = result?.filter ? String(result.filter) : undefined
  const processes = Array.isArray(result?.processes)
    ? (result.processes as Record<string, unknown>[])
    : []

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Processes</span>
          <ToolStatusBadge variant="neutral">{totalCount}</ToolStatusBadge>
          {filter && <span className="rk-path-chip max-w-28 min-w-0 truncate">{filter}</span>}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {processes.length === 0 ? (
        <EmptyState>No processes</EmptyState>
      ) : (
        <div className="rk-scrollbar max-h-[50vh] overflow-auto">
          <div className="flex items-center gap-2 border-b px-3 py-1">
            <span className="text-muted-foreground w-12 shrink-0 font-mono text-[10px]">PID</span>
            <span className="text-muted-foreground min-w-0 flex-1 font-mono text-[10px]">name</span>
            <span className="text-muted-foreground w-12 shrink-0 font-mono text-[10px]">CPU%</span>
            <span className="text-muted-foreground w-12 shrink-0 font-mono text-[10px]">MEM%</span>
          </div>
          <div className="divide-y">
            {processes.map((proc, i) => {
              const pid = proc.pid != null ? String(proc.pid) : ""
              const name = proc.name ? String(proc.name) : String(proc.command ?? "")
              const cpu = typeof proc.cpu === "number" ? proc.cpu.toFixed(1) : undefined
              const mem = typeof proc.mem === "number" ? proc.mem.toFixed(1) : undefined
              return (
                <div key={i} className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1">
                  <span className="text-muted-foreground w-12 shrink-0 font-mono text-[10px]">
                    {pid}
                  </span>
                  <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
                    {name}
                  </span>
                  <span className="text-foreground/60 w-12 shrink-0 font-mono text-[10px]">
                    {cpu ?? "-"}
                  </span>
                  <span className="text-foreground/60 w-12 shrink-0 font-mono text-[10px]">
                    {mem ?? "-"}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </ToolRendererShell>
  )
}

// ── ClipboardReadRenderer ─────────────────────────────────────────────────────

export function ClipboardReadRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined

  const content = result?.content ? String(result.content) : ""
  const length = typeof result?.length === "number" ? result.length : content.length

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Clipboard</span>
          <span className="text-muted-foreground font-mono text-[10px]">{length} chars</span>
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {!content ? (
        <EmptyState>Clipboard is empty</EmptyState>
      ) : (
        <div className="relative px-3 py-2">
          <pre className="text-foreground/80 max-h-[30vh] overflow-auto font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap">
            {content.slice(0, 2000)}
            {content.length > 2000 && <span className="text-muted-foreground">…</span>}
          </pre>
          <div className="absolute top-2 right-2">
            <CopyButton text={content} />
          </div>
        </div>
      )}
    </ToolRendererShell>
  )
}

// ── ClipboardWriteRenderer ────────────────────────────────────────────────────

export function ClipboardWriteRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined
  const length = typeof result?.length === "number" ? result.length : undefined
  const error = result?.error ? String(result.error) : undefined

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">
            Clipboard Write
          </span>
          {error ? (
            <ToolStatusBadge variant="error">failed</ToolStatusBadge>
          ) : (
            <ToolStatusBadge variant="success">copied</ToolStatusBadge>
          )}
          {length != null && !error && (
            <span className="text-muted-foreground font-mono text-[10px]">{length} chars</span>
          )}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {error ? <ErrorBanner>{error}</ErrorBanner> : <EmptyState>Copied to clipboard</EmptyState>}
    </ToolRendererShell>
  )
}

// ── DesktopNotifyRenderer ─────────────────────────────────────────────────────

export function DesktopNotifyRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined
  const title = result?.title ? String(result.title) : undefined
  const message = result?.message ? String(result.message) : undefined
  const error = result?.error ? String(result.error) : undefined

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">
            Desktop Notify
          </span>
          {error ? (
            <ToolStatusBadge variant="error">failed</ToolStatusBadge>
          ) : (
            <ToolStatusBadge variant="success">sent</ToolStatusBadge>
          )}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {error ? (
        <ErrorBanner>{error}</ErrorBanner>
      ) : (
        <div className="divide-y">
          {title && (
            <div className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
              <span className="text-muted-foreground w-16 shrink-0 font-mono text-[10px]">
                title
              </span>
              <span className="text-foreground/80 font-mono text-[11px]">{title}</span>
            </div>
          )}
          {message && (
            <div className="hover:bg-surface-4 px-3 py-1.5">
              <span className="text-muted-foreground font-mono text-[10px]">message</span>
              <p className="text-foreground/80 mt-0.5 font-mono text-[11px] leading-relaxed">
                {message}
              </p>
            </div>
          )}
        </div>
      )}
    </ToolRendererShell>
  )
}
