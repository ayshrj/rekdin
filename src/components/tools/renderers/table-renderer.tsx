"use client"

import { useMemo } from "react"

import {
  CopyButton,
  EmptyState,
  RawPayloadDisclosure,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

const MAX_ROWS = 200

const TYPE_LABELS: Record<string, string> = {
  csv_preview: "CSV",
  csv_query: "CSV Query",
  html_table_extract: "Table Extract",
  sqlite_query: "SQLite",
  browser_table_extract: "Table Extract",
}

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCSV(text: string): string[][] {
  const lines = text.trim().split(/\r?\n/)
  return lines.map((line) => {
    const cells: string[] = []
    let current = ""
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuote = !inQuote
        }
      } else if (ch === "," && !inQuote) {
        cells.push(current.trim())
        current = ""
      } else {
        current += ch
      }
    }
    cells.push(current.trim())
    return cells
  })
}

// ── Normalization ─────────────────────────────────────────────────────────────

interface TableData {
  columns: string[]
  rows: string[][]
  totalRows: number
  query?: string
  source?: string
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function normalizeTable(result: Record<string, unknown> | undefined, type: string): TableData {
  if (!result) return { columns: [], rows: [], totalRows: 0 }

  const query = (result.query ?? result.expression ?? result.sql ?? "") as string
  const source = (result.source ?? result.file ?? result.table ?? result.url ?? "") as string

  // columns + rows arrays (most structured)
  if (Array.isArray(result.rows) && result.rows.length > 0) {
    const columns = Array.isArray(result.columns)
      ? result.columns.map(String)
      : Array.isArray(result.headers)
        ? result.headers.map(String)
        : []
    const rows = (result.rows as unknown[]).map((r) => (Array.isArray(r) ? r.map(String) : []))
    const total = typeof result.totalRows === "number" ? result.totalRows : rows.length
    return {
      columns,
      rows: rows.slice(0, MAX_ROWS),
      totalRows: total,
      query: String(query),
      source: String(source),
    }
  }

  // array of objects
  const dataArr = Array.isArray(result.data)
    ? result.data
    : Array.isArray(result.results)
      ? result.results
      : Array.isArray(result.records)
        ? result.records
        : null

  if (dataArr && dataArr.length > 0) {
    const first = dataArr[0]
    if (first && typeof first === "object" && !Array.isArray(first)) {
      const columns = Object.keys(first as Record<string, unknown>)
      const rows = (dataArr as Record<string, unknown>[]).map((obj) =>
        columns.map((c) => {
          const v = obj[c]
          return v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)
        })
      )
      const total = typeof result.totalRows === "number" ? result.totalRows : rows.length
      return {
        columns,
        rows: rows.slice(0, MAX_ROWS),
        totalRows: total,
        query: String(query),
        source: String(source),
      }
    }
    // array of arrays — first row is headers
    if (Array.isArray(dataArr[0])) {
      const [headerRow, ...bodyRows] = dataArr as string[][]
      const columns = headerRow.map(String)
      const rows = bodyRows.map((r) => r.map(String))
      return {
        columns,
        rows: rows.slice(0, MAX_ROWS),
        totalRows: rows.length,
        query: String(query),
        source: String(source),
      }
    }
  }

  // CSV string
  const csvText = (result.csv ?? result.output ?? result.content ?? result.text ?? "") as string
  if (typeof csvText === "string" && csvText.trim()) {
    const parsed = parseCSV(csvText)
    if (parsed.length >= 1) {
      const [headerRow, ...bodyRows] = parsed
      return {
        columns: headerRow,
        rows: bodyRows.slice(0, MAX_ROWS),
        totalRows: bodyRows.length,
        query: String(query),
        source: String(source),
      }
    }
  }

  // Fallback: result itself is an array of objects
  if (Array.isArray(result) && result.length > 0) {
    const first = result[0]
    if (first && typeof first === "object" && !Array.isArray(first)) {
      const columns = Object.keys(first as Record<string, unknown>)
      const rows = (result as Record<string, unknown>[]).map((obj) =>
        columns.map((c) => {
          const v = obj[c]
          return v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)
        })
      )
      return {
        columns,
        rows: rows.slice(0, MAX_ROWS),
        totalRows: rows.length,
        query: String(query),
        source: String(source),
      }
    }
  }

  return { columns: [], rows: [], totalRows: 0, query: String(query), source: String(source) }
}

// ── CSV export helper ─────────────────────────────────────────────────────────

function toCsv(columns: string[], rows: string[][]): string {
  const escape = (v: string) =>
    v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v
  return [columns.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n")
}

// ── Main renderer ─────────────────────────────────────────────────────────────

export function TableRenderer({ part }: { part: ToolResultContentPart }) {
  const type = part.type
  const result = part.toolResult as Record<string, unknown> | undefined
  const { columns, rows, totalRows, query, source } = useMemo(
    () => normalizeTable(result, type),
    [result, type]
  )

  const truncated = totalRows > rows.length
  const csvText = useMemo(() => toCsv(columns, rows), [columns, rows])
  const label = TYPE_LABELS[type] ?? "Table"

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">{label}</span>
          {source && (
            <span className="rk-path-chip max-w-40 min-w-0 truncate">{String(source)}</span>
          )}
          {query && (
            <span className="text-primary rounded border border-[color-mix(in_srgb,var(--primary)_25%,transparent)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] px-1.5 py-0.5 font-mono text-[10px]">
              {String(query)}
            </span>
          )}
          <ToolStatusBadge variant="neutral">
            {rows.length} row{rows.length !== 1 ? "s" : ""}
          </ToolStatusBadge>
          {columns.length > 0 && (
            <span className="text-muted-foreground font-mono text-[10px]">
              {columns.length} col{columns.length !== 1 ? "s" : ""}
            </span>
          )}
          {rows.length > 0 && <CopyButton text={csvText} className="ml-auto" />}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {columns.length === 0 ? (
        <EmptyState>No data</EmptyState>
      ) : (
        <>
          <div className="rk-scrollbar max-h-[45vh] overflow-auto">
            <table className="w-full min-w-max border-collapse font-mono text-[11px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-surface-4 border-b">
                  {columns.map((col, i) => (
                    <th
                      key={i}
                      className="text-foreground/70 px-3 py-1.5 text-left font-semibold whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row, ri) => (
                  <tr key={ri} className="hover:bg-surface-4">
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="text-foreground/80 max-w-60 truncate px-3 py-1 whitespace-nowrap"
                        title={cell}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {truncated && (
            <div className="border-t px-3 py-1.5">
              <span className="text-muted-foreground font-mono text-[10px]">
                Showing {rows.length} of {totalRows} rows
              </span>
            </div>
          )}
        </>
      )}
    </ToolRendererShell>
  )
}
