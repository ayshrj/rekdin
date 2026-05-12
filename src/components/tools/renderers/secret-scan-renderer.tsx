"use client"

import { FileExtensionIcon } from "@/components/file-extension-icon"

import {
  EmptyState,
  ErrorBanner,
  RawPayloadDisclosure,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

interface SecretFinding {
  file: string
  line?: number
  rule: string
  preview?: string
}

function normalizeFindings(raw: unknown): SecretFinding[] {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.findings)
      ? ((raw as Record<string, unknown>).findings as unknown[])
      : Array.isArray((raw as Record<string, unknown>)?.results)
        ? ((raw as Record<string, unknown>).results as unknown[])
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
      rule: String(r.rule ?? r.ruleName ?? r.type ?? r.kind ?? "secret"),
      // Never expose raw secret values — show redacted placeholder only
      preview: r.preview ? String(r.preview) : r.value != null ? "***redacted***" : undefined,
    }))
}

export function SecretScanRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined
  const findings = normalizeFindings(result?.findings ?? result?.results ?? result ?? [])
  const clean = findings.length === 0
  const scannedFiles = result?.scannedFiles ?? result?.fileCount

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Secret Scan</span>
          <ToolStatusBadge variant={clean ? "success" : "warning"}>
            {clean ? "clean" : `${findings.length} finding${findings.length !== 1 ? "s" : ""}`}
          </ToolStatusBadge>
          {scannedFiles != null && (
            <span className="text-muted-foreground font-mono text-[10px]">
              {String(scannedFiles)} files scanned
            </span>
          )}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {!clean && (
        <div className="px-3 pt-2">
          <ErrorBanner>
            {findings.length} potential secret{findings.length !== 1 ? "s" : ""} detected — review
            and rotate if confirmed.
          </ErrorBanner>
        </div>
      )}
      {clean ? (
        <EmptyState>No secrets found</EmptyState>
      ) : (
        <div className="max-h-[40vh] divide-y overflow-auto">
          {findings.map((f, i) => (
            <div key={i} className="hover:bg-surface-4 flex items-start gap-2.5 px-3 py-2">
              <FileExtensionIcon extensionName={f.file} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-foreground/80 min-w-0 truncate font-mono text-[11px]">
                    {f.file}
                  </span>
                  {f.line != null && (
                    <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                      :{f.line}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="shrink-0 rounded border border-amber-500/25 bg-amber-500/10 px-1 py-px font-mono text-[9px] font-medium text-amber-600">
                    {f.rule}
                  </span>
                  {f.preview && (
                    <span className="text-muted-foreground/60 min-w-0 truncate font-mono text-[10px]">
                      {f.preview}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </ToolRendererShell>
  )
}
