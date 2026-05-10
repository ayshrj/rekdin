"use client"

import { FileExtensionIcon } from "@/components/file-extension-icon"

import {
  EmptyState,
  RawPayloadDisclosure,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

// ── shared severity ───────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  error: "text-destructive border-destructive/25 bg-destructive/10",
  high: "text-destructive border-destructive/25 bg-destructive/10",
  warning: "text-amber-500 border-amber-500/25 bg-amber-500/10",
  medium: "text-amber-500 border-amber-500/25 bg-amber-500/10",
  info: "text-blue-500 border-blue-500/25 bg-blue-500/10",
  low: "text-blue-500 border-blue-500/25 bg-blue-500/10",
  note: "text-muted-foreground border-border bg-surface-4",
}

function sevClass(s?: string) {
  if (!s) return "text-muted-foreground border-border bg-surface-4"
  return SEVERITY_COLORS[s.toLowerCase()] ?? "text-muted-foreground border-border bg-surface-4"
}

// ── semgrep / dockerfile scan ─────────────────────────────────────────────────

interface ScanFinding {
  file: string
  line?: number
  rule?: string
  message?: string
  severity?: string
}

function normalizeScanFindings(raw: unknown): ScanFinding[] {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.findings)
      ? ((raw as Record<string, unknown>).findings as unknown[])
      : Array.isArray((raw as Record<string, unknown>)?.results)
        ? ((raw as Record<string, unknown>).results as unknown[])
        : Array.isArray((raw as Record<string, unknown>)?.issues)
          ? ((raw as Record<string, unknown>).issues as unknown[])
          : []
  return arr
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
    .map((r) => ({
      file: String(r.file ?? r.path ?? r.location ?? ""),
      line:
        typeof r.line === "number"
          ? r.line
          : typeof r.lineNumber === "number"
            ? r.lineNumber
            : undefined,
      rule: r.rule
        ? String(r.rule)
        : r.ruleId
          ? String(r.ruleId)
          : r.check
            ? String(r.check)
            : undefined,
      message: r.message ? String(r.message) : r.description ? String(r.description) : undefined,
      severity: r.severity ? String(r.severity) : r.level ? String(r.level) : undefined,
    }))
}

// ── dead_code_candidates ──────────────────────────────────────────────────────

interface DeadCodeEntry {
  file: string
  line?: number
  name?: string
  kind?: string
  reason?: string
}

function normalizeDeadCode(raw: unknown): DeadCodeEntry[] {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.candidates)
      ? ((raw as Record<string, unknown>).candidates as unknown[])
      : Array.isArray((raw as Record<string, unknown>)?.results)
        ? ((raw as Record<string, unknown>).results as unknown[])
        : []
  return arr
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
    .map((r) => ({
      file: String(r.file ?? r.path ?? ""),
      line: typeof r.line === "number" ? r.line : undefined,
      name: r.name ? String(r.name) : r.symbol ? String(r.symbol) : undefined,
      kind: r.kind ? String(r.kind) : r.type ? String(r.type) : undefined,
      reason: r.reason ? String(r.reason) : undefined,
    }))
}

// ── duplicate_code_candidates ─────────────────────────────────────────────────

interface DuplicateEntry {
  fileA: string
  lineA?: number
  fileB: string
  lineB?: number
  similarity?: number
  lines?: number
}

function normalizeDuplicates(raw: unknown): DuplicateEntry[] {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.candidates)
      ? ((raw as Record<string, unknown>).candidates as unknown[])
      : Array.isArray((raw as Record<string, unknown>)?.duplicates)
        ? ((raw as Record<string, unknown>).duplicates as unknown[])
        : []
  return arr
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
    .map((r) => {
      const locs = Array.isArray(r.locations) ? (r.locations as Record<string, unknown>[]) : null
      const dup = r.duplicate as Record<string, unknown> | undefined
      const fileA = locs ? String(locs[0]?.file ?? "") : String(r.fileA ?? r.file ?? r.source ?? "")
      const fileB = locs
        ? String(locs[1]?.file ?? "")
        : String(r.fileB ?? dup?.file ?? r.target ?? "")
      const lineA = locs
        ? typeof locs[0]?.line === "number"
          ? (locs[0].line as number)
          : undefined
        : typeof r.lineA === "number"
          ? r.lineA
          : typeof r.lineStart === "number"
            ? r.lineStart
            : undefined
      const lineB = locs
        ? typeof locs[1]?.line === "number"
          ? (locs[1].line as number)
          : undefined
        : typeof r.lineB === "number"
          ? r.lineB
          : typeof dup?.lineStart === "number"
            ? (dup.lineStart as number)
            : undefined
      return {
        fileA,
        lineA,
        fileB,
        lineB,
        similarity: typeof r.similarity === "number" ? r.similarity : undefined,
        lines:
          typeof r.lines === "number"
            ? r.lines
            : typeof r.lineCount === "number"
              ? r.lineCount
              : undefined,
      }
    })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScanFindingRow({ finding }: { finding: ScanFinding }) {
  return (
    <div className="hover:bg-surface-4 flex items-start gap-2.5 px-3 py-2">
      <FileExtensionIcon extensionName={finding.file} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-foreground/80 min-w-0 truncate font-mono text-[11px]">
            {finding.file}
          </span>
          {finding.line != null && (
            <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
              :{finding.line}
            </span>
          )}
          {finding.severity && (
            <span
              className={`shrink-0 rounded border px-1 py-px font-mono text-[9px] font-medium ${sevClass(finding.severity)}`}
            >
              {finding.severity}
            </span>
          )}
        </div>
        {finding.rule && (
          <span className="mt-0.5 block font-mono text-[10px] text-amber-600/80">
            {finding.rule}
          </span>
        )}
        {finding.message && (
          <span className="text-muted-foreground/70 mt-0.5 block min-w-0 truncate font-mono text-[10px]">
            {finding.message}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Main renderer ─────────────────────────────────────────────────────────────

export function CodeQualityRenderer({ part }: { part: ToolResultContentPart }) {
  const type = part.type
  const result = part.toolResult as Record<string, unknown> | undefined

  // ── duplicate_code_candidates ──────────────────────────────────────────────
  if (type === "duplicate_code_candidates") {
    const dupes = normalizeDuplicates(result?.candidates ?? result?.duplicates ?? result ?? [])
    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">
              Duplicate Code
            </span>
            <ToolStatusBadge variant={dupes.length === 0 ? "success" : "warning"}>
              {dupes.length} candidate{dupes.length !== 1 ? "s" : ""}
            </ToolStatusBadge>
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {dupes.length === 0 ? (
          <EmptyState>No duplicate code found</EmptyState>
        ) : (
          <div className="max-h-[40vh] divide-y overflow-auto">
            {dupes.map((d, i) => (
              <div
                key={i}
                className="hover:bg-surface-4 flex flex-wrap items-center gap-1.5 px-3 py-2"
              >
                <FileExtensionIcon extensionName={d.fileA} className="h-3 w-3 shrink-0" />
                <span className="rk-path-chip max-w-40 min-w-0 truncate">
                  {d.fileA}
                  {d.lineA != null ? `:${d.lineA}` : ""}
                </span>
                <span className="text-muted-foreground text-[10px]">↔</span>
                <FileExtensionIcon extensionName={d.fileB} className="h-3 w-3 shrink-0" />
                <span className="rk-path-chip max-w-40 min-w-0 truncate">
                  {d.fileB}
                  {d.lineB != null ? `:${d.lineB}` : ""}
                </span>
                {d.lines != null && (
                  <span className="text-muted-foreground ml-auto shrink-0 font-mono text-[10px]">
                    {d.lines} lines
                  </span>
                )}
                {d.similarity != null && (
                  <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                    {Math.round(d.similarity * 100)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </ToolRendererShell>
    )
  }

  // ── dead_code_candidates ───────────────────────────────────────────────────
  if (type === "dead_code_candidates") {
    const dead = normalizeDeadCode(result?.candidates ?? result?.results ?? result ?? [])
    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">Dead Code</span>
            <ToolStatusBadge variant={dead.length === 0 ? "success" : "warning"}>
              {dead.length} candidate{dead.length !== 1 ? "s" : ""}
            </ToolStatusBadge>
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {dead.length === 0 ? (
          <EmptyState>No dead code found</EmptyState>
        ) : (
          <div className="max-h-[40vh] divide-y overflow-auto">
            {dead.map((d, i) => (
              <div key={i} className="hover:bg-surface-4 flex items-start gap-2.5 px-3 py-2">
                <FileExtensionIcon extensionName={d.file} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-foreground/80 min-w-0 truncate font-mono text-[11px]">
                      {d.file}
                    </span>
                    {d.line != null && (
                      <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                        :{d.line}
                      </span>
                    )}
                    {d.kind && (
                      <span className="text-muted-foreground border-border bg-surface-4 shrink-0 rounded border px-1 py-px font-mono text-[9px]">
                        {d.kind}
                      </span>
                    )}
                  </div>
                  {d.name && (
                    <span className="text-foreground/60 mt-0.5 block font-mono text-[10px]">
                      {d.name}
                    </span>
                  )}
                  {d.reason && (
                    <span className="text-muted-foreground/70 mt-0.5 block font-mono text-[10px]">
                      {d.reason}
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

  // ── dockerfile_scan ────────────────────────────────────────────────────────
  if (type === "dockerfile_scan") {
    const findings = normalizeScanFindings(
      result?.findings ?? result?.issues ?? result?.results ?? result ?? []
    )
    const dockerfilePath = String(result?.file ?? result?.path ?? "")

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">
              Dockerfile Scan
            </span>
            {dockerfilePath && (
              <span className="rk-path-chip max-w-40 min-w-0 truncate">{dockerfilePath}</span>
            )}
            <ToolStatusBadge variant={findings.length === 0 ? "success" : "warning"}>
              {findings.length === 0
                ? "clean"
                : `${findings.length} issue${findings.length !== 1 ? "s" : ""}`}
            </ToolStatusBadge>
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {findings.length === 0 ? (
          <EmptyState>No issues found</EmptyState>
        ) : (
          <div className="max-h-[40vh] divide-y overflow-auto">
            {findings.map((f, i) => (
              <ScanFindingRow key={i} finding={f} />
            ))}
          </div>
        )}
      </ToolRendererShell>
    )
  }

  // ── semgrep_scan (default) ────────────────────────────────────────────────
  const findings = normalizeScanFindings(
    result?.findings ?? result?.results ?? result?.issues ?? result ?? []
  )
  const tool = String(result?.tool ?? result?.scanner ?? "Semgrep")

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Code Scan</span>
          <span className="text-muted-foreground border-border bg-surface-4 shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px]">
            {tool}
          </span>
          <ToolStatusBadge variant={findings.length === 0 ? "success" : "warning"}>
            {findings.length === 0
              ? "clean"
              : `${findings.length} finding${findings.length !== 1 ? "s" : ""}`}
          </ToolStatusBadge>
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {findings.length === 0 ? (
        <EmptyState>No findings</EmptyState>
      ) : (
        <div className="max-h-[40vh] divide-y overflow-auto">
          {findings.map((f, i) => (
            <ScanFindingRow key={i} finding={f} />
          ))}
        </div>
      )}
    </ToolRendererShell>
  )
}
