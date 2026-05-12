"use client"

import {
  EmptyState,
  ErrorBanner,
  RawPayloadDisclosure,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

// ── DnsLookupRenderer ─────────────────────────────────────────────────────────

export function DnsLookupRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined

  const error = result?.error ? String(result.error) : undefined
  if (error) {
    return (
      <ToolRendererShell
        header={
          <span className="text-foreground font-mono text-[11px] font-semibold">DNS Lookup</span>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        <ErrorBanner>{error}</ErrorBanner>
      </ToolRendererShell>
    )
  }

  const hostname = result?.hostname ? String(result.hostname) : ""
  const records =
    result?.records && typeof result.records === "object" && !Array.isArray(result.records)
      ? (result.records as Record<string, unknown[]>)
      : {}

  const totalRecords = Object.values(records).reduce((sum, arr) => sum + arr.length, 0)

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">DNS Lookup</span>
          {hostname && <span className="rk-path-chip max-w-40 min-w-0 truncate">{hostname}</span>}
          <ToolStatusBadge variant="neutral">{totalRecords} records</ToolStatusBadge>
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {totalRecords === 0 ? (
        <EmptyState>No records found</EmptyState>
      ) : (
        <div className="rk-scrollbar max-h-[50vh] divide-y overflow-auto">
          {Object.entries(records).map(([type, values]) =>
            values.map((value, i) => (
              <div
                key={`${type}-${i}`}
                className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5"
              >
                <span className="rk-path-chip w-10 shrink-0 text-center">{type}</span>
                <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
                  {typeof value === "object" ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </ToolRendererShell>
  )
}

// ── SslCheckRenderer ──────────────────────────────────────────────────────────

export function SslCheckRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined

  const error = result?.error ? String(result.error) : undefined
  if (error) {
    return (
      <ToolRendererShell
        header={
          <span className="text-foreground font-mono text-[11px] font-semibold">SSL Check</span>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        <ErrorBanner>{error}</ErrorBanner>
      </ToolRendererShell>
    )
  }

  const domain = result?.domain ? String(result.domain) : ""
  const valid = result?.valid === true
  const daysUntilExpiry =
    typeof result?.daysUntilExpiry === "number" ? result.daysUntilExpiry : undefined
  const subject = result?.subject ? String(result.subject) : undefined
  const issuer = result?.issuer ? String(result.issuer) : undefined
  const validFrom = result?.validFrom ? String(result.validFrom) : undefined
  const validTo = result?.validTo ? String(result.validTo) : undefined
  const sans = Array.isArray(result?.sans) ? (result.sans as string[]) : []

  const expiryVariant =
    daysUntilExpiry == null
      ? "neutral"
      : daysUntilExpiry < 7
        ? "error"
        : daysUntilExpiry < 30
          ? "warning"
          : "success"

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">SSL Check</span>
          {domain && <span className="rk-path-chip max-w-40 min-w-0 truncate">{domain}</span>}
          <ToolStatusBadge variant={valid ? "success" : "error"}>
            {valid ? "valid" : "invalid"}
          </ToolStatusBadge>
          {daysUntilExpiry != null && (
            <ToolStatusBadge variant={expiryVariant}>{daysUntilExpiry}d left</ToolStatusBadge>
          )}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      <div className="rk-scrollbar max-h-[50vh] divide-y overflow-auto">
        {subject && (
          <div className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
            <span className="text-muted-foreground w-20 shrink-0 font-mono text-[10px]">
              subject
            </span>
            <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
              {subject}
            </span>
          </div>
        )}
        {issuer && (
          <div className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
            <span className="text-muted-foreground w-20 shrink-0 font-mono text-[10px]">
              issuer
            </span>
            <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
              {issuer}
            </span>
          </div>
        )}
        {validFrom && (
          <div className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
            <span className="text-muted-foreground w-20 shrink-0 font-mono text-[10px]">
              valid from
            </span>
            <span className="text-foreground/80 font-mono text-[11px]">{validFrom}</span>
          </div>
        )}
        {validTo && (
          <div className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
            <span className="text-muted-foreground w-20 shrink-0 font-mono text-[10px]">
              expires
            </span>
            <span className="text-foreground/80 font-mono text-[11px]">{validTo}</span>
          </div>
        )}
        {sans.length > 0 && (
          <>
            <div className="px-3 py-1.5">
              <span className="rk-section-label">SANs ({sans.length})</span>
            </div>
            {sans.slice(0, 20).map((san, i) => (
              <div key={i} className="hover:bg-surface-4 px-3 py-1">
                <span className="text-foreground/70 font-mono text-[10px]">{san}</span>
              </div>
            ))}
            {sans.length > 20 && (
              <div className="px-3 py-1">
                <span className="text-muted-foreground font-mono text-[10px]">
                  +{sans.length - 20} more
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </ToolRendererShell>
  )
}

// ── PingRenderer ──────────────────────────────────────────────────────────────

export function PingRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined

  const error = result?.error ? String(result.error) : undefined
  if (error) {
    return (
      <ToolRendererShell
        header={<span className="text-foreground font-mono text-[11px] font-semibold">Ping</span>}
        footer={<RawPayloadDisclosure payload={result} />}
      >
        <ErrorBanner>{error}</ErrorBanner>
      </ToolRendererShell>
    )
  }

  const host = result?.host ? String(result.host) : ""
  const reachable = result?.reachable === true
  const packetsSent = typeof result?.packetsSent === "number" ? result.packetsSent : undefined
  const packetsReceived =
    typeof result?.packetsReceived === "number" ? result.packetsReceived : undefined
  const rttMin = typeof result?.rttMin === "number" ? result.rttMin : undefined
  const rttAvg = typeof result?.rttAvg === "number" ? result.rttAvg : undefined
  const rttMax = typeof result?.rttMax === "number" ? result.rttMax : undefined

  function fmtMs(ms: number): string {
    return `${ms.toFixed(2)}ms`
  }

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Ping</span>
          {host && <span className="rk-path-chip max-w-40 min-w-0 truncate">{host}</span>}
          <ToolStatusBadge variant={reachable ? "success" : "error"}>
            {reachable ? "reachable" : "unreachable"}
          </ToolStatusBadge>
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      <div className="divide-y">
        {packetsSent != null && (
          <div className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
            <span className="text-muted-foreground w-24 shrink-0 font-mono text-[10px]">
              packets
            </span>
            <span className="text-foreground/80 font-mono text-[11px]">
              {packetsReceived}/{packetsSent} received
            </span>
          </div>
        )}
        {rttMin != null && (
          <div className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
            <span className="text-muted-foreground w-24 shrink-0 font-mono text-[10px]">
              rtt min
            </span>
            <span className="text-foreground/80 font-mono text-[11px]">{fmtMs(rttMin)}</span>
          </div>
        )}
        {rttAvg != null && (
          <div className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
            <span className="text-muted-foreground w-24 shrink-0 font-mono text-[10px]">
              rtt avg
            </span>
            <span className="text-foreground/90 font-mono text-[11px] font-medium">
              {fmtMs(rttAvg)}
            </span>
          </div>
        )}
        {rttMax != null && (
          <div className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
            <span className="text-muted-foreground w-24 shrink-0 font-mono text-[10px]">
              rtt max
            </span>
            <span className="text-foreground/80 font-mono text-[11px]">{fmtMs(rttMax)}</span>
          </div>
        )}
      </div>
    </ToolRendererShell>
  )
}

// ── WhoisLookupRenderer ───────────────────────────────────────────────────────

export function WhoisLookupRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined

  const error = result?.error ? String(result.error) : undefined
  if (error) {
    return (
      <ToolRendererShell
        header={<span className="text-foreground font-mono text-[11px] font-semibold">WHOIS</span>}
        footer={<RawPayloadDisclosure payload={result} />}
      >
        <ErrorBanner>{error}</ErrorBanner>
      </ToolRendererShell>
    )
  }

  const domain = result?.domain ? String(result.domain) : ""
  const registrar = result?.registrar ? String(result.registrar) : undefined
  const registeredDate = result?.registeredDate ? String(result.registeredDate) : undefined
  const expiryDate = result?.expiryDate ? String(result.expiryDate) : undefined
  const updatedDate = result?.updatedDate ? String(result.updatedDate) : undefined
  const status = Array.isArray(result?.status) ? (result.status as string[]) : []
  const nameservers = Array.isArray(result?.nameservers) ? (result.nameservers as string[]) : []

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">WHOIS</span>
          {domain && <span className="rk-path-chip max-w-40 min-w-0 truncate">{domain}</span>}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      <div className="rk-scrollbar max-h-[50vh] divide-y overflow-auto">
        {[
          { label: "registrar", value: registrar },
          { label: "registered", value: registeredDate },
          { label: "expires", value: expiryDate },
          { label: "updated", value: updatedDate },
        ]
          .filter((r) => r.value)
          .map((row, i) => (
            <div key={i} className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
              <span className="text-muted-foreground w-20 shrink-0 font-mono text-[10px]">
                {row.label}
              </span>
              <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
                {row.value}
              </span>
            </div>
          ))}
        {status.length > 0 && (
          <>
            <div className="px-3 py-1.5">
              <span className="rk-section-label">Status</span>
            </div>
            {status.map((s, i) => (
              <div key={i} className="hover:bg-surface-4 px-3 py-1">
                <span className="text-foreground/70 font-mono text-[10px]">{s}</span>
              </div>
            ))}
          </>
        )}
        {nameservers.length > 0 && (
          <>
            <div className="px-3 py-1.5">
              <span className="rk-section-label">Nameservers</span>
            </div>
            {nameservers.map((ns, i) => (
              <div key={i} className="hover:bg-surface-4 px-3 py-1">
                <span className="text-foreground/70 font-mono text-[10px]">{ns}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </ToolRendererShell>
  )
}
