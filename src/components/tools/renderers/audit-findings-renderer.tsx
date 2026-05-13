"use client"

import { useState } from "react"

import {
  CopyButton,
  EmptyState,
  RawPayloadDisclosure,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { getResult, getString, pathWithLine, pickArray, stringifyPayload } from "./renderer-utils"
import { type ToolResultContentPart } from "./tool-result-renderer"

type Severity = "error" | "warning" | "info"

const severityRank: Record<Severity, number> = { error: 0, warning: 1, info: 2 }

function normalizeSeverity(value: unknown): Severity {
  const text = getString(value).toLowerCase()
  if (["critical", "high", "error", "fail", "failed"].includes(text)) return "error"
  if (["medium", "warn", "warning", "risk"].includes(text)) return "warning"
  return "info"
}

function badgeVariant(severity: Severity) {
  if (severity === "error") return "error" as const
  if (severity === "warning") return "warning" as const
  return "info" as const
}

export function AuditFindingsRenderer({ part }: { part: ToolResultContentPart }) {
  const result = getResult(part)
  const rawFindings = pickArray(result, ["findings", "issues", "warnings", "results", "items"])
  const [showAll, setShowAll] = useState(false)

  const findings = rawFindings
    .map((item, index) => ({
      id: index,
      severity: normalizeSeverity(item.severity ?? item.level ?? item.status ?? item.type),
      file: pathWithLine(item),
      message: getString(item.message ?? item.title ?? item.text ?? item.reason),
      hint: getString(item.hint ?? item.suggestion ?? item.fix ?? item.recommendation),
    }))
    .sort(
      (a, b) => severityRank[a.severity] - severityRank[b.severity] || a.file.localeCompare(b.file)
    )

  const counts = findings.reduce(
    (acc, finding) => {
      acc[finding.severity] += 1
      return acc
    },
    { error: 0, warning: 0, info: 0 }
  )
  const visible = showAll ? findings : findings.slice(0, 12)
  const title = getString(part.toolName ?? part.type, "audit")

  return (
    <ToolRendererShell
      className="border-tool-search/25"
      header={
        <>
          <span className="text-foreground min-w-0 flex-1 truncate font-mono text-[11px] font-semibold">
            {title}
          </span>
          {counts.error ? (
            <ToolStatusBadge variant="error">{counts.error} errors</ToolStatusBadge>
          ) : null}
          {counts.warning ? (
            <ToolStatusBadge variant="warning">{counts.warning} warnings</ToolStatusBadge>
          ) : null}
          {counts.info ? (
            <ToolStatusBadge variant="info">{counts.info} info</ToolStatusBadge>
          ) : null}
          <CopyButton text={stringifyPayload(result)} />
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {findings.length === 0 ? (
        <EmptyState>No findings returned</EmptyState>
      ) : (
        <div className="divide-y">
          {visible.map((finding) => (
            <div key={finding.id} className="px-3 py-2">
              <div className="flex min-w-0 items-start gap-2">
                <ToolStatusBadge variant={badgeVariant(finding.severity)}>
                  {finding.severity}
                </ToolStatusBadge>
                <div className="min-w-0 flex-1">
                  {finding.file ? (
                    <div className="rk-path-chip mb-1 inline-flex max-w-full truncate">
                      {finding.file}
                    </div>
                  ) : null}
                  <div className="text-foreground/85 text-[11px] leading-relaxed wrap-break-word">
                    {finding.message || "Finding without message"}
                  </div>
                  {finding.hint ? (
                    <div className="text-muted-foreground mt-1 text-[10px] leading-relaxed wrap-break-word">
                      {finding.hint}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          {findings.length > visible.length ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="text-muted-foreground hover:text-foreground w-full px-3 py-2 text-left font-mono text-[10px]"
            >
              Show {findings.length - visible.length} more findings
            </button>
          ) : null}
        </div>
      )}
    </ToolRendererShell>
  )
}
