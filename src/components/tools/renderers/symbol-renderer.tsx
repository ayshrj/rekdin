"use client"

import { FileExtensionIcon } from "@/components/file-extension-icon"

import {
  CopyButton,
  EmptyState,
  RawPayloadDisclosure,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

interface SymbolMatch {
  file: string
  line?: number
  endLine?: number
  kind?: string
  name?: string
  text?: string
  context?: string
}

const KIND_COLORS: Record<string, string> = {
  function: "text-blue-500 border-blue-500/25 bg-blue-500/10",
  method: "text-blue-400 border-blue-400/25 bg-blue-400/10",
  class: "text-purple-500 border-purple-500/25 bg-purple-500/10",
  interface: "text-purple-400 border-purple-400/25 bg-purple-400/10",
  type: "text-purple-300 border-purple-300/25 bg-purple-300/10",
  variable: "text-emerald-500 border-emerald-500/25 bg-emerald-500/10",
  const: "text-emerald-500 border-emerald-500/25 bg-emerald-500/10",
  enum: "text-orange-500 border-orange-500/25 bg-orange-500/10",
  property: "text-amber-500 border-amber-500/25 bg-amber-500/10",
  import: "text-muted-foreground border-border bg-surface-4",
}

function kindClass(kind?: string) {
  if (!kind) return "text-muted-foreground border-border bg-surface-4"
  return KIND_COLORS[kind.toLowerCase()] ?? "text-muted-foreground border-border bg-surface-4"
}

function normalizeMatches(raw: unknown): SymbolMatch[] {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.matches)
      ? ((raw as Record<string, unknown>).matches as unknown[])
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
      endLine: typeof r.endLine === "number" ? r.endLine : undefined,
      kind: r.kind ? String(r.kind) : undefined,
      name: r.name ? String(r.name) : undefined,
      text: r.text ? String(r.text) : r.snippet ? String(r.snippet) : undefined,
      context: r.context ? String(r.context) : undefined,
    }))
}

function MatchRow({ match }: { match: SymbolMatch }) {
  const displayText = match.text ?? match.context ?? ""
  const copyText = [match.file, match.line != null ? `:${match.line}` : ""].join("")

  return (
    <div className="group hover:bg-surface-4 flex items-start gap-2.5 px-3 py-2">
      {match.file && (
        <FileExtensionIcon extensionName={match.file} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-foreground/80 min-w-0 truncate font-mono text-[11px]">
            {match.file}
          </span>
          {match.line != null && (
            <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
              :{match.line}
            </span>
          )}
          {match.kind && (
            <span
              className={`shrink-0 rounded border px-1 py-px font-mono text-[9px] font-medium ${kindClass(match.kind)}`}
            >
              {match.kind}
            </span>
          )}
        </div>
        {match.name && match.name !== match.file && (
          <span className="text-foreground/60 mt-0.5 block font-mono text-[10px]">
            {match.name}
          </span>
        )}
        {displayText && (
          <pre className="text-foreground/50 mt-0.5 truncate font-mono text-[10px] leading-relaxed whitespace-pre">
            {displayText.trim()}
          </pre>
        )}
      </div>
      <CopyButton
        text={copyText}
        className="mt-0.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
      />
    </div>
  )
}

export function SymbolRenderer({ part }: { part: ToolResultContentPart }) {
  const type = part.type
  const result = part.toolResult as Record<string, unknown> | undefined
  const inputQuery =
    (part.toolInput as { query?: string; symbol?: string; name?: string } | undefined)?.query ??
    (part.toolInput as { query?: string; symbol?: string; name?: string } | undefined)?.symbol ??
    (part.toolInput as { query?: string; symbol?: string; name?: string } | undefined)?.name ??
    ""

  const isReferences = type === "symbol_references"
  const title = isReferences ? "Symbol References" : "Symbol Search"

  // Matches can be nested under result.matches, result.references, result.results, or at root
  const rawMatches =
    result?.matches ?? result?.references ?? result?.results ?? result?.symbols ?? result

  const matches = normalizeMatches(rawMatches)

  const query = (result?.query ?? result?.symbol ?? result?.name ?? inputQuery) as string

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">{title}</span>
          {query && (
            <span className="text-primary rounded border border-[color-mix(in_srgb,var(--primary)_25%,transparent)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] px-1.5 py-0.5 font-mono text-[10px]">
              {query}
            </span>
          )}
          <ToolStatusBadge variant="neutral">
            {matches.length} {isReferences ? "reference" : "match"}
            {matches.length !== 1 ? "s" : ""}
          </ToolStatusBadge>
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {matches.length === 0 ? (
        <EmptyState>No {isReferences ? "references" : "matches"} found</EmptyState>
      ) : (
        <div className="max-h-[45vh] divide-y overflow-auto">
          {matches.map((m, i) => (
            <MatchRow key={i} match={m} />
          ))}
        </div>
      )}
    </ToolRendererShell>
  )
}
