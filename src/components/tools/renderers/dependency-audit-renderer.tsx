"use client"

import { useState } from "react"

import {
  CopyButton,
  EmptyState,
  ErrorBanner,
  RawPayloadDisclosure,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

// ── shared severity ───────────────────────────────────────────────────────────

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"]

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-destructive border-destructive/25 bg-destructive/10",
  high: "text-orange-500 border-orange-500/25 bg-orange-500/10",
  medium: "text-amber-500 border-amber-500/25 bg-amber-500/10",
  low: "text-blue-500 border-blue-500/25 bg-blue-500/10",
  info: "text-muted-foreground border-border bg-surface-4",
}

function severityClass(sev: string) {
  return SEVERITY_COLORS[sev.toLowerCase()] ?? "text-muted-foreground border-border bg-surface-4"
}

// ── dependency_audit ──────────────────────────────────────────────────────────

interface Vulnerability {
  package: string
  version?: string
  severity: string
  cve?: string
  title?: string
  fixedIn?: string
}

function normalizeVulns(raw: unknown): Vulnerability[] {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.vulnerabilities)
      ? ((raw as Record<string, unknown>).vulnerabilities as unknown[])
      : Array.isArray((raw as Record<string, unknown>)?.advisories)
        ? ((raw as Record<string, unknown>).advisories as unknown[])
        : []
  return arr
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
    .map((r) => ({
      package: String(r.package ?? r.name ?? r.module ?? ""),
      version: r.version ? String(r.version) : undefined,
      severity: String(r.severity ?? r.level ?? "low").toLowerCase(),
      cve: r.cve ? String(r.cve) : r.id ? String(r.id) : undefined,
      title: r.title ? String(r.title) : r.description ? String(r.description) : undefined,
      fixedIn: r.fixedIn ? String(r.fixedIn) : r.patched ? String(r.patched) : undefined,
    }))
}

// ── license_summary ───────────────────────────────────────────────────────────

interface LicenseGroup {
  license: string
  packages: string[]
}

function normalizeLicenses(raw: unknown): LicenseGroup[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
      .map((r) => ({
        license: String(r.license ?? r.name ?? r.spdx ?? "Unknown"),
        packages: Array.isArray(r.packages) ? r.packages.map(String) : [],
      }))
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return Object.entries(raw as Record<string, unknown>).map(([license, pkgs]) => ({
      license,
      packages: Array.isArray(pkgs) ? pkgs.map(String) : [],
    }))
  }
  return []
}

// ── lockfile_risk_summary ─────────────────────────────────────────────────────

interface RiskPackage {
  name: string
  version?: string
  risk: string
  reason?: string
}

function normalizeRisks(raw: unknown): RiskPackage[] {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.packages)
      ? ((raw as Record<string, unknown>).packages as unknown[])
      : Array.isArray((raw as Record<string, unknown>)?.risks)
        ? ((raw as Record<string, unknown>).risks as unknown[])
        : []
  return arr
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
    .map((r) => ({
      name: String(r.name ?? r.package ?? ""),
      version: r.version ? String(r.version) : undefined,
      risk: String(r.risk ?? r.level ?? r.severity ?? "unknown").toLowerCase(),
      reason: r.reason ? String(r.reason) : r.description ? String(r.description) : undefined,
    }))
}

// ── Main renderer ─────────────────────────────────────────────────────────────

export function DependencyAuditRenderer({ part }: { part: ToolResultContentPart }) {
  const type = part.type
  const result = part.toolResult as Record<string, unknown> | undefined
  const [openLicenses, setOpenLicenses] = useState<Set<number>>(new Set())

  const toggleLicense = (i: number) =>
    setOpenLicenses((s) => {
      const next = new Set(s)
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })

  // ── sbom_generate ──────────────────────────────────────────────────────────
  if (type === "sbom_generate") {
    const components = result?.components ?? result?.packages ?? []
    const count = Array.isArray(components)
      ? components.length
      : Number(result?.componentCount ?? result?.count ?? 0)
    const format = String(result?.format ?? result?.sbomFormat ?? "SPDX")
    const sbomJson = JSON.stringify(result, null, 2)

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">SBOM</span>
            <span className="text-muted-foreground border-border bg-surface-4 shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px]">
              {format}
            </span>
            <ToolStatusBadge variant="neutral">
              {count} component{count !== 1 ? "s" : ""}
            </ToolStatusBadge>
            <CopyButton text={sbomJson} className="ml-auto" />
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        <div className="px-3 py-2">
          <span className="text-muted-foreground font-mono text-[11px]">
            Software Bill of Materials generated — use the copy button to export.
          </span>
        </div>
      </ToolRendererShell>
    )
  }

  // ── license_summary ────────────────────────────────────────────────────────
  if (type === "license_summary") {
    const licenses = normalizeLicenses(
      result?.licenses ?? result?.groups ?? result?.summary ?? result ?? []
    )

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">
              License Summary
            </span>
            <ToolStatusBadge variant="neutral">
              {licenses.length} license{licenses.length !== 1 ? "s" : ""}
            </ToolStatusBadge>
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {licenses.length === 0 ? (
          <EmptyState>No license data</EmptyState>
        ) : (
          <div className="max-h-[40vh] divide-y overflow-auto">
            {licenses.map((lg, i) => (
              <div key={i}>
                <button
                  type="button"
                  className="hover:bg-surface-4 flex w-full items-center gap-2 px-3 py-1.5 text-left"
                  onClick={() => toggleLicense(i)}
                >
                  <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
                    {lg.license}
                  </span>
                  <ToolStatusBadge variant="neutral">
                    {lg.packages.length} pkg{lg.packages.length !== 1 ? "s" : ""}
                  </ToolStatusBadge>
                </button>
                {openLicenses.has(i) && lg.packages.length > 0 && (
                  <div className="divide-y border-t bg-(--surface-4)/40">
                    {lg.packages.map((pkg, j) => (
                      <div key={j} className="px-8 py-1">
                        <span className="text-muted-foreground font-mono text-[10px]">{pkg}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ToolRendererShell>
    )
  }

  // ── lockfile_risk_summary ──────────────────────────────────────────────────
  if (type === "lockfile_risk_summary") {
    const risks = normalizeRisks(result?.packages ?? result?.risks ?? result ?? [])
    const highRisk = risks.filter((r) => r.risk === "critical" || r.risk === "high").length

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">
              Lockfile Risk
            </span>
            <ToolStatusBadge variant={highRisk > 0 ? "warning" : "neutral"}>
              {risks.length} package{risks.length !== 1 ? "s" : ""}
            </ToolStatusBadge>
            {highRisk > 0 && (
              <ToolStatusBadge variant="error">{highRisk} high risk</ToolStatusBadge>
            )}
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {risks.length === 0 ? (
          <EmptyState>No risky packages found</EmptyState>
        ) : (
          <div className="max-h-[40vh] divide-y overflow-auto">
            {risks.map((r, i) => (
              <div key={i} className="hover:bg-surface-4 flex items-start gap-2.5 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-foreground/80 min-w-0 truncate font-mono text-[11px]">
                      {r.name}
                    </span>
                    {r.version && (
                      <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                        {r.version}
                      </span>
                    )}
                    <span
                      className={`shrink-0 rounded border px-1 py-px font-mono text-[9px] font-medium ${severityClass(r.risk)}`}
                    >
                      {r.risk}
                    </span>
                  </div>
                  {r.reason && (
                    <span className="text-muted-foreground/70 mt-0.5 block font-mono text-[10px]">
                      {r.reason}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ToolRendererShell>
    )
  }

  // ── dependency_audit (default) ────────────────────────────────────────────
  const vulns = normalizeVulns(
    result?.vulnerabilities ?? result?.advisories ?? result?.findings ?? result ?? []
  )
  const hasHigh = vulns.some((v) => v.severity === "critical" || v.severity === "high")

  const bySeverity = SEVERITY_ORDER.reduce<Record<string, number>>((acc, s) => {
    const count = vulns.filter((v) => v.severity === s).length
    if (count > 0) acc[s] = count
    return acc
  }, {})

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">
            Dependency Audit
          </span>
          <ToolStatusBadge variant={vulns.length === 0 ? "success" : hasHigh ? "error" : "warning"}>
            {vulns.length === 0 ? "clean" : `${vulns.length} vuln${vulns.length !== 1 ? "s" : ""}`}
          </ToolStatusBadge>
          {Object.entries(bySeverity).map(([sev, count]) => (
            <span
              key={sev}
              className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] font-medium ${severityClass(sev)}`}
            >
              {count} {sev}
            </span>
          ))}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {hasHigh && (
        <div className="px-3 pt-2">
          <ErrorBanner>
            Critical or high severity vulnerabilities found. Review and patch immediately.
          </ErrorBanner>
        </div>
      )}
      {vulns.length === 0 ? (
        <EmptyState>No vulnerabilities found</EmptyState>
      ) : (
        <div className="max-h-[40vh] divide-y overflow-auto">
          {vulns.map((v, i) => (
            <div key={i} className="hover:bg-surface-4 flex items-start gap-2.5 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-foreground/80 min-w-0 truncate font-mono text-[11px]">
                    {v.package}
                  </span>
                  {v.version && (
                    <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                      {v.version}
                    </span>
                  )}
                  <span
                    className={`shrink-0 rounded border px-1 py-px font-mono text-[9px] font-medium ${severityClass(v.severity)}`}
                  >
                    {v.severity}
                  </span>
                  {v.cve && (
                    <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                      {v.cve}
                    </span>
                  )}
                </div>
                {v.title && (
                  <span className="text-muted-foreground/70 mt-0.5 block min-w-0 truncate font-mono text-[10px]">
                    {v.title}
                  </span>
                )}
                {v.fixedIn && (
                  <span className="mt-0.5 block font-mono text-[10px] text-emerald-600">
                    fix: {v.fixedIn}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </ToolRendererShell>
  )
}
