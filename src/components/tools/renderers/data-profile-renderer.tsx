"use client"

import {
  EmptyState,
  RawPayloadDisclosure,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import {
  formatNumber,
  getNumber,
  getResult,
  getString,
  pickArray,
  pickStringArray,
  stableKey,
} from "./renderer-utils"
import { type ToolResultContentPart } from "./tool-result-renderer"

export function DataProfileRenderer({ part }: { part: ToolResultContentPart }) {
  const result = getResult(part)
  const columns = pickArray(result, ["columns", "fields", "items"])
  const clusters = pickArray(result, ["clusters", "errors", "groups", "items"])
  const rows = getNumber(result.rows ?? result.rowCount)
  const warnings = getNumber(result.warnings ?? result.warningCount)
  const isLog = ["log_parse", "log_error_cluster"].includes(part.type)

  return (
    <ToolRendererShell
      className="border-tool-data/25"
      header={
        <>
          <span className="text-foreground min-w-0 flex-1 truncate font-mono text-[11px] font-semibold">
            {getString(part.toolName ?? part.type, "data_profile")}
          </span>
          {isLog ? (
            <ToolStatusBadge variant="neutral">{clusters.length} clusters</ToolStatusBadge>
          ) : (
            <ToolStatusBadge variant="neutral">{columns.length} columns</ToolStatusBadge>
          )}
          {rows ? (
            <ToolStatusBadge variant="neutral">{formatNumber(rows)} rows</ToolStatusBadge>
          ) : null}
          {warnings ? (
            <ToolStatusBadge variant="warning">{warnings} warnings</ToolStatusBadge>
          ) : null}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {isLog ? (
        clusters.length === 0 ? (
          <EmptyState>No log clusters returned</EmptyState>
        ) : (
          <div className="max-h-[44vh] divide-y overflow-auto">
            {clusters.map((cluster, index) => (
              <div key={stableKey(index, cluster.pattern)} className="px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <ToolStatusBadge
                    variant={
                      getString(cluster.severity).toLowerCase().includes("error")
                        ? "error"
                        : "warning"
                    }
                  >
                    {getNumber(cluster.count, 1)} hits
                  </ToolStatusBadge>
                  <span className="text-foreground/85 min-w-0 truncate font-mono text-[11px]">
                    {getString(cluster.pattern ?? cluster.message ?? cluster.error)}
                  </span>
                </div>
                <pre className="bg-surface-4 text-muted-foreground mt-2 overflow-auto rounded px-2 py-1 font-mono text-[10px] whitespace-pre-wrap">
                  {getString(cluster.sample ?? cluster.representative ?? cluster.line)}
                </pre>
              </div>
            ))}
          </div>
        )
      ) : columns.length === 0 ? (
        <EmptyState>No profile columns returned</EmptyState>
      ) : (
        <div className="max-h-[44vh] overflow-auto">
          <div className="text-muted-foreground grid min-w-[720px] grid-cols-[10rem_6rem_5rem_5rem_8rem_8rem_1fr] gap-2 border-b px-3 py-1.5 font-mono text-[10px]">
            <span>Column</span>
            <span>Type</span>
            <span>Nulls</span>
            <span>Unique</span>
            <span>Min</span>
            <span>Max</span>
            <span>Sample</span>
          </div>
          {columns.map((column, index) => (
            <div
              key={stableKey(index, column.name)}
              className="grid min-w-[720px] grid-cols-[10rem_6rem_5rem_5rem_8rem_8rem_1fr] gap-2 border-b px-3 py-1.5 font-mono text-[10px] last:border-b-0"
            >
              <span className="text-foreground/85 truncate">
                {getString(column.name ?? column.column)}
              </span>
              <span className="text-muted-foreground">
                {getString(column.type ?? column.inferredType)}
              </span>
              <span className="text-muted-foreground">
                {getNumber(column.nulls ?? column.nullCount)}
              </span>
              <span className="text-muted-foreground">
                {getNumber(column.unique ?? column.uniqueCount)}
              </span>
              <span className="text-muted-foreground truncate">{getString(column.min)}</span>
              <span className="text-muted-foreground truncate">{getString(column.max)}</span>
              <span className="text-muted-foreground truncate">
                {pickStringArray(column, ["sample", "samples", "values"]).join(", ") ||
                  getString(column.sample)}
              </span>
            </div>
          ))}
        </div>
      )}
    </ToolRendererShell>
  )
}
