"use client"

import {
  EmptyState,
  RawPayloadDisclosure,
  ToolMetaRow,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

const STATUS_LABELS: Record<string, string> = {
  dev_server_start: "Dev Server",
  dev_server_stop: "Dev Server",
  dev_server_status: "Dev Server",
  port_probe: "Port Probe",
  http_health_check: "Health Check",
}

function serverVariant(status: string) {
  const s = status.toLowerCase()
  if (s === "running" || s === "started" || s === "up") return "success" as const
  if (s === "stopped" || s === "down") return "neutral" as const
  if (s === "error" || s === "failed") return "error" as const
  return "neutral" as const
}

export function DevServerRenderer({ part }: { part: ToolResultContentPart }) {
  const type = part.type
  const result = part.toolResult as Record<string, unknown> | undefined

  // ── port_probe ─────────────────────────────────────────────────────────────
  if (type === "port_probe") {
    const input = part.toolInput as Record<string, unknown> | undefined
    const host = (result?.host ?? input?.host ?? "localhost") as string
    const port = result?.port ?? input?.port
    const open = result?.open === true || result?.status === "open" || result?.reachable === true
    const latency =
      typeof result?.latency === "number"
        ? result.latency
        : typeof result?.responseTime === "number"
          ? result.responseTime
          : null

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">Port Probe</span>
            <span className="rk-path-chip font-mono text-[10px]">
              {host}
              {port != null ? `:${port}` : ""}
            </span>
            <ToolStatusBadge variant={open ? "success" : "error"}>
              {open ? "open" : "closed"}
            </ToolStatusBadge>
            {latency != null && (
              <span className="text-muted-foreground font-mono text-[10px]">{latency}ms</span>
            )}
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        <EmptyState>{open ? "Port is reachable" : "Port is not reachable"}</EmptyState>
      </ToolRendererShell>
    )
  }

  // ── http_health_check ──────────────────────────────────────────────────────
  if (type === "http_health_check") {
    const input = part.toolInput as Record<string, unknown> | undefined
    const url = (result?.url ?? input?.url ?? "") as string
    const status =
      typeof result?.status === "number"
        ? result.status
        : typeof result?.statusCode === "number"
          ? result.statusCode
          : null
    const healthy =
      result?.healthy === true ||
      result?.ok === true ||
      (status != null && status >= 200 && status < 300)
    const responseTime =
      typeof result?.responseTime === "number"
        ? result.responseTime
        : typeof result?.duration === "number"
          ? result.duration
          : typeof result?.latency === "number"
            ? result.latency
            : null
    const message = (result?.message ?? result?.body ?? "") as string

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">
              Health Check
            </span>
            {url && <span className="rk-path-chip max-w-50 min-w-0 truncate">{url}</span>}
            <ToolStatusBadge variant={healthy ? "success" : "error"}>
              {healthy ? "healthy" : "unhealthy"}
            </ToolStatusBadge>
            {status != null && (
              <span
                className={`font-mono text-[10px] font-semibold ${status < 300 ? "text-emerald-600" : status < 400 ? "text-amber-500" : "text-destructive"}`}
              >
                {status}
              </span>
            )}
            {responseTime != null && (
              <span className="text-muted-foreground font-mono text-[10px]">{responseTime}ms</span>
            )}
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {message ? (
          <div className="px-3 py-2">
            <span className="text-foreground/70 font-mono text-[11px]">{message}</span>
          </div>
        ) : (
          <EmptyState>{healthy ? "Service is healthy" : "Service is unhealthy"}</EmptyState>
        )}
      </ToolRendererShell>
    )
  }

  // ── dev_server_start / dev_server_stop / dev_server_status ────────────────
  const serverUrl = (result?.url ?? result?.serverUrl ?? result?.address ?? "") as string
  const port = result?.port ?? result?.listenPort
  const pid = result?.pid ?? result?.processId
  const rawStatus = (result?.status ??
    (type === "dev_server_stop" ? "stopped" : "running")) as string
  const logs = (result?.logs ?? result?.output ?? result?.startupLogs ?? "") as string
  const title = STATUS_LABELS[type] ?? "Dev Server"

  const actionLabel =
    type === "dev_server_start" ? "started" : type === "dev_server_stop" ? "stopped" : rawStatus

  const variant = type === "dev_server_stop" ? ("neutral" as const) : serverVariant(rawStatus)

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">{title}</span>
          {serverUrl && (
            <a
              href={serverUrl}
              target="_blank"
              rel="noreferrer"
              className="rk-path-chip max-w-50 min-w-0 truncate hover:underline"
            >
              {serverUrl}
            </a>
          )}
          <ToolStatusBadge variant={variant}>{actionLabel}</ToolStatusBadge>
          {port != null && (
            <span className="text-muted-foreground font-mono text-[10px]">:{String(port)}</span>
          )}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {pid != null || logs ? (
        <div className="divide-y">
          {pid != null && (
            <ToolMetaRow label="pid" mono>
              {String(pid)}
            </ToolMetaRow>
          )}
          {logs && (
            <div>
              <div className="bg-surface-4 border-b px-3 py-1">
                <span className="rk-section-label">logs</span>
              </div>
              <pre className="rk-scrollbar text-foreground/70 max-h-[25vh] overflow-auto px-3 py-2 font-mono text-[10px] leading-relaxed whitespace-pre-wrap">
                {logs}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <EmptyState>{type === "dev_server_stop" ? "Server stopped" : "Server running"}</EmptyState>
      )}
    </ToolRendererShell>
  )
}
