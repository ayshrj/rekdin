"use client"

import {
  EmptyState,
  ErrorBanner,
  RawPayloadDisclosure,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

// ── SecurityCheckRenderer ─────────────────────────────────────────────────────

interface PermEntry {
  path: string
  permissions: string
  owner?: string
  worldWritable: boolean
}

function normalizePermissions(raw: unknown): PermEntry[] {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.files)
      ? ((raw as Record<string, unknown>).files as unknown[])
      : Array.isArray((raw as Record<string, unknown>)?.entries)
        ? ((raw as Record<string, unknown>).entries as unknown[])
        : []
  return arr
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
    .map((r) => {
      const perms = String(r.permissions ?? r.mode ?? r.perms ?? "")
      return {
        path: String(r.path ?? r.file ?? r.name ?? ""),
        permissions: perms,
        owner: r.owner ? String(r.owner) : r.user ? String(r.user) : undefined,
        worldWritable:
          r.worldWritable === true ||
          perms.includes("777") ||
          (perms.length >= 10 && perms[8] === "w"),
      }
    })
}

export function SecurityCheckRenderer({ part }: { part: ToolResultContentPart }) {
  const type = part.type
  const result = part.toolResult as Record<string, unknown> | undefined

  // ── url_safety_check ────────────────────────────────────────────────────────
  if (type === "url_safety_check") {
    const input = part.toolInput as Record<string, unknown> | undefined
    const url = (result?.url ?? input?.url ?? "") as string
    const safe = result?.safe === true || result?.status === "safe" || result?.verdict === "safe"
    const unsafe =
      result?.safe === false || result?.status === "unsafe" || result?.malicious === true
    const warning = !safe && !unsafe
    const provider = (result?.provider ?? result?.source ?? "") as string
    const threats = Array.isArray(result?.threats)
      ? result.threats.map(String)
      : Array.isArray(result?.categories)
        ? result.categories.map(String)
        : []
    const verdict = (result?.verdict ??
      result?.status ??
      (safe ? "safe" : unsafe ? "unsafe" : "unknown")) as string

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">URL Safety</span>
            {url && <span className="rk-path-chip max-w-60 min-w-0 truncate">{url}</span>}
            <ToolStatusBadge variant={safe ? "success" : unsafe ? "error" : "warning"}>
              {verdict}
            </ToolStatusBadge>
            {provider && (
              <span className="text-muted-foreground border-border bg-surface-4 shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px]">
                {provider}
              </span>
            )}
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {unsafe && threats.length === 0 && <ErrorBanner>URL flagged as unsafe</ErrorBanner>}
        {threats.length > 0 ? (
          <div className="divide-y">
            {unsafe && <ErrorBanner>URL flagged as unsafe</ErrorBanner>}
            <div className="px-3 py-2">
              <span className="rk-section-label mb-1.5 block">Threat Categories</span>
              <div className="flex flex-wrap gap-1">
                {threats.map((t, i) => (
                  <span
                    key={i}
                    className="border-destructive/30 bg-destructive/10 text-destructive rounded border px-1.5 py-0.5 font-mono text-[10px]"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState>
            {safe ? "URL is safe" : warning ? "No threat data" : "URL flagged"}
          </EmptyState>
        )}
      </ToolRendererShell>
    )
  }

  // ── workspace_permissions_scan ─────────────────────────────────────────────
  const entries = normalizePermissions(result?.files ?? result?.entries ?? result ?? [])
  const worldWritableCount = entries.filter((e) => e.worldWritable).length

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">
            Permissions Scan
          </span>
          <ToolStatusBadge variant={worldWritableCount > 0 ? "warning" : "success"}>
            {entries.length} file{entries.length !== 1 ? "s" : ""}
          </ToolStatusBadge>
          {worldWritableCount > 0 && (
            <ToolStatusBadge variant="warning">{worldWritableCount} world-writable</ToolStatusBadge>
          )}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {entries.length === 0 ? (
        <EmptyState>No files scanned</EmptyState>
      ) : (
        <div className="rk-scrollbar max-h-[40vh] divide-y overflow-auto">
          {entries.map((e, i) => (
            <div
              key={i}
              className={`flex items-center gap-2.5 px-3 py-1.5 ${e.worldWritable ? "bg-status-warning/5" : "hover:bg-surface-4"}`}
            >
              <span
                className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] ${
                  e.worldWritable
                    ? "border-status-warning/40 bg-status-warning/10 text-status-warning"
                    : "border-border bg-surface-4 text-muted-foreground"
                }`}
              >
                {e.permissions || "???"}
              </span>
              {e.owner && (
                <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                  {e.owner}
                </span>
              )}
              <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[10px]">
                {e.path}
              </span>
              {e.worldWritable && (
                <ToolStatusBadge variant="warning">world-writable</ToolStatusBadge>
              )}
            </div>
          ))}
        </div>
      )}
    </ToolRendererShell>
  )
}
