"use client"

import { useState } from "react"

import {
  CopyButton,
  EmptyState,
  ErrorBanner,
  RawPayloadDisclosure,
  RendererTab,
  RendererTabBar,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

// ── JsonSchemaValidateRenderer ────────────────────────────────────────────────

export function JsonSchemaValidateRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined

  const valid = result?.valid === true
  const errorCount = typeof result?.errorCount === "number" ? result.errorCount : 0
  const errors = Array.isArray(result?.errors) ? (result.errors as string[]) : []

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">
            JSON Schema Validate
          </span>
          <ToolStatusBadge variant={valid ? "success" : "error"}>
            {valid ? "valid" : "invalid"}
          </ToolStatusBadge>
          {!valid && errorCount > 0 && (
            <span className="text-muted-foreground font-mono text-[10px]">{errorCount} errors</span>
          )}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {valid ? (
        <EmptyState>Schema validation passed</EmptyState>
      ) : errors.length === 0 ? (
        <EmptyState>Validation failed</EmptyState>
      ) : (
        <div className="rk-scrollbar max-h-[40vh] divide-y overflow-auto">
          {errors.map((err, i) => (
            <div key={i} className="hover:bg-surface-4 px-3 py-1.5">
              <p className="text-destructive font-mono text-[11px] leading-relaxed">{err}</p>
            </div>
          ))}
        </div>
      )}
    </ToolRendererShell>
  )
}

// ── CsvToJsonRenderer ─────────────────────────────────────────────────────────

export function CsvToJsonRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined
  const [tab, setTab] = useState<"table" | "json">("table")

  const rowCount = typeof result?.rowCount === "number" ? result.rowCount : 0
  const columns = Array.isArray(result?.columns) ? (result.columns as string[]) : []
  const rows = Array.isArray(result?.rows) ? (result.rows as Record<string, unknown>[]) : []
  const json = result?.json ? String(result.json) : undefined

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">CSV → JSON</span>
          <ToolStatusBadge variant="neutral">{rowCount} rows</ToolStatusBadge>
          {columns.length > 0 && (
            <span className="text-muted-foreground font-mono text-[10px]">
              {columns.length} cols
            </span>
          )}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      <RendererTabBar>
        <RendererTab active={tab === "table"} onClick={() => setTab("table")}>
          Table
        </RendererTab>
        {json && (
          <RendererTab active={tab === "json"} onClick={() => setTab("json")}>
            JSON
          </RendererTab>
        )}
      </RendererTabBar>

      {tab === "table" &&
        (rows.length === 0 ? (
          <EmptyState>No data</EmptyState>
        ) : (
          <div className="rk-scrollbar max-h-[50vh] overflow-auto">
            <table className="w-full min-w-max">
              <thead>
                <tr className="border-b">
                  {columns.map((col, i) => (
                    <th
                      key={i}
                      className="text-muted-foreground px-3 py-1.5 text-left font-mono text-[10px] font-normal"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row, ri) => (
                  <tr key={ri} className="hover:bg-surface-4">
                    {columns.map((col, ci) => (
                      <td
                        key={ci}
                        className="text-foreground/80 max-w-[200px] truncate px-3 py-1 font-mono text-[11px]"
                      >
                        {row[col] != null ? String(row[col]) : ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {tab === "json" && json && (
        <div className="relative">
          <pre className="rk-scrollbar rk-code-block max-h-[50vh] overflow-auto p-3 font-mono text-[10px] leading-relaxed">
            {json.slice(0, 10000)}
            {json.length > 10000 && <span className="text-muted-foreground">…</span>}
          </pre>
          <div className="absolute top-2 right-2">
            <CopyButton text={json} />
          </div>
        </div>
      )}
    </ToolRendererShell>
  )
}

// ── JsonToCsvRenderer ─────────────────────────────────────────────────────────

export function JsonToCsvRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined

  const rowCount = typeof result?.rowCount === "number" ? result.rowCount : 0
  const csv = result?.csv ? String(result.csv) : undefined

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">JSON → CSV</span>
          <ToolStatusBadge variant="neutral">{rowCount} rows</ToolStatusBadge>
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {!csv ? (
        <EmptyState>No CSV output</EmptyState>
      ) : (
        <div className="relative">
          <pre className="rk-scrollbar rk-code-block max-h-[40vh] overflow-auto p-3 font-mono text-[10px] leading-relaxed">
            {csv.slice(0, 10000)}
            {csv.length > 10000 && <span className="text-muted-foreground">…</span>}
          </pre>
          <div className="absolute top-2 right-2">
            <CopyButton text={csv} />
          </div>
        </div>
      )}
    </ToolRendererShell>
  )
}

// ── XmlToJsonRenderer ─────────────────────────────────────────────────────────

export function XmlToJsonRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined

  const error = result?.error ? String(result.error) : undefined
  if (error) {
    return (
      <ToolRendererShell
        header={
          <span className="text-foreground font-mono text-[11px] font-semibold">XML → JSON</span>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        <ErrorBanner>{error}</ErrorBanner>
      </ToolRendererShell>
    )
  }

  const json = result?.json ? String(result.json) : undefined
  const nodeCount = typeof result?.nodeCount === "number" ? result.nodeCount : undefined
  const rootTag = result?.rootTag ? String(result.rootTag) : undefined

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">XML → JSON</span>
          {rootTag && <span className="rk-path-chip shrink-0">&lt;{rootTag}&gt;</span>}
          {nodeCount != null && (
            <span className="text-muted-foreground font-mono text-[10px]">{nodeCount} nodes</span>
          )}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {!json ? (
        <EmptyState>No output</EmptyState>
      ) : (
        <div className="relative">
          <pre className="rk-scrollbar rk-code-block max-h-[50vh] overflow-auto p-3 font-mono text-[10px] leading-relaxed">
            {json.slice(0, 10000)}
            {json.length > 10000 && <span className="text-muted-foreground">…</span>}
          </pre>
          <div className="absolute top-2 right-2">
            <CopyButton text={json} />
          </div>
        </div>
      )}
    </ToolRendererShell>
  )
}

// ── XpathQueryRenderer ────────────────────────────────────────────────────────

export function XpathQueryRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined
  const [tab, setTab] = useState<"nodes" | "html">("nodes")

  const error = result?.error ? String(result.error) : undefined
  if (error) {
    return (
      <ToolRendererShell
        header={
          <span className="text-foreground font-mono text-[11px] font-semibold">XPath Query</span>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        <ErrorBanner>{error}</ErrorBanner>
      </ToolRendererShell>
    )
  }

  const xpath = result?.xpath ? String(result.xpath) : ""
  const matchCount = typeof result?.matchCount === "number" ? result.matchCount : 0
  const nodes = Array.isArray(result?.nodes) ? (result.nodes as Record<string, unknown>[]) : []
  const hasHtml = nodes.some((n) => n.html && String(n.html).length > 0)

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">XPath Query</span>
          {xpath && <span className="rk-path-chip max-w-40 min-w-0 truncate">{xpath}</span>}
          <ToolStatusBadge variant={matchCount > 0 ? "success" : "neutral"}>
            {matchCount} nodes
          </ToolStatusBadge>
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {nodes.length === 0 ? (
        <EmptyState>No matches</EmptyState>
      ) : (
        <>
          {hasHtml && (
            <RendererTabBar>
              <RendererTab active={tab === "nodes"} onClick={() => setTab("nodes")}>
                Text
              </RendererTab>
              <RendererTab active={tab === "html"} onClick={() => setTab("html")}>
                HTML
              </RendererTab>
            </RendererTabBar>
          )}
          <div className="rk-scrollbar max-h-[50vh] divide-y overflow-auto">
            {nodes.map((node, i) => {
              const tag = node.tag ? String(node.tag) : "#text"
              const text = node.text ? String(node.text) : ""
              const html = node.html ? String(node.html) : ""
              return (
                <div key={i} className="hover:bg-surface-4 px-3 py-1.5">
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <span className="rk-path-chip shrink-0">{tag}</span>
                    <span className="text-muted-foreground font-mono text-[10px]">#{i + 1}</span>
                  </div>
                  {tab === "nodes" && text && (
                    <p className="text-foreground/70 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                      {text.slice(0, 300)}
                      {text.length > 300 && <span className="text-muted-foreground">…</span>}
                    </p>
                  )}
                  {tab === "html" && html && (
                    <pre className="text-foreground/70 font-mono text-[10px] leading-relaxed whitespace-pre-wrap">
                      {html.slice(0, 300)}
                      {html.length > 300 && <span className="text-muted-foreground">…</span>}
                    </pre>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </ToolRendererShell>
  )
}
