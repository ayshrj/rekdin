"use client"

import {
  CopyButton,
  EmptyState,
  RawPayloadDisclosure,
  ToolMetaRow,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

// ── token_count ───────────────────────────────────────────────────────────────

function TokenCountView({ result }: { result: Record<string, unknown> }) {
  const count = Number(result.tokens ?? result.tokenCount ?? result.count ?? 0)
  const limit =
    result.limit != null
      ? Number(result.limit)
      : result.contextWindow != null
        ? Number(result.contextWindow)
        : null
  const model = (result.model ?? result.modelId ?? "") as string
  const pct = limit != null && limit > 0 ? Math.min(100, Math.round((count / limit) * 100)) : null

  const barColor =
    pct == null
      ? "bg-primary"
      : pct >= 90
        ? "bg-destructive"
        : pct >= 70
          ? "bg-amber-500"
          : "bg-emerald-500"

  return (
    <div className="divide-y">
      {model && (
        <ToolMetaRow label="model" mono>
          {model}
        </ToolMetaRow>
      )}
      <ToolMetaRow label="tokens" mono>
        {count.toLocaleString()}
      </ToolMetaRow>
      {limit != null && (
        <ToolMetaRow label="limit" mono>
          {limit.toLocaleString()}
        </ToolMetaRow>
      )}
      {pct != null && (
        <div className="px-3 py-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-muted-foreground font-mono text-[10px]">context usage</span>
            <span className="text-muted-foreground font-mono text-[10px]">{pct}%</span>
          </div>
          <div className="bg-surface-4 h-1.5 w-full overflow-hidden rounded-full">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── text_keywords ─────────────────────────────────────────────────────────────

interface Keyword {
  word: string
  score?: number
  count?: number
}

function normalizeKeywords(raw: unknown): Keyword[] {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.keywords)
      ? ((raw as Record<string, unknown>).keywords as unknown[])
      : []
  return arr
    .filter((r): r is Record<string, unknown> | string => Boolean(r))
    .map((r) => {
      if (typeof r === "string") return { word: r }
      if (typeof r === "object" && r !== null) {
        return {
          word: String(r.word ?? r.keyword ?? r.term ?? r.text ?? ""),
          score:
            typeof r.score === "number"
              ? r.score
              : typeof r.relevance === "number"
                ? r.relevance
                : undefined,
          count: typeof r.count === "number" ? r.count : undefined,
        }
      }
      return { word: String(r) }
    })
}

// ── text_entities ─────────────────────────────────────────────────────────────

interface Entity {
  text: string
  type: string
  score?: number
}

const ENTITY_COLORS: Record<string, string> = {
  PERSON: "text-purple-500 border-purple-500/25 bg-purple-500/10",
  ORG: "text-blue-500 border-blue-500/25 bg-blue-500/10",
  ORGANIZATION: "text-blue-500 border-blue-500/25 bg-blue-500/10",
  LOC: "text-emerald-500 border-emerald-500/25 bg-emerald-500/10",
  LOCATION: "text-emerald-500 border-emerald-500/25 bg-emerald-500/10",
  GPE: "text-emerald-500 border-emerald-500/25 bg-emerald-500/10",
  DATE: "text-amber-500 border-amber-500/25 bg-amber-500/10",
  TIME: "text-amber-400 border-amber-400/25 bg-amber-400/10",
  MONEY: "text-orange-500 border-orange-500/25 bg-orange-500/10",
  EMAIL: "text-sky-500 border-sky-500/25 bg-sky-500/10",
  URL: "text-sky-500 border-sky-500/25 bg-sky-500/10",
}

function entityClass(type: string) {
  return ENTITY_COLORS[type.toUpperCase()] ?? "text-muted-foreground border-border bg-surface-4"
}

function normalizeEntities(raw: unknown): Entity[] {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.entities)
      ? ((raw as Record<string, unknown>).entities as unknown[])
      : []
  return arr
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
    .map((r) => ({
      text: String(r.text ?? r.value ?? r.entity ?? r.name ?? ""),
      type: String(r.type ?? r.label ?? r.kind ?? "OTHER").toUpperCase(),
      score:
        typeof r.score === "number"
          ? r.score
          : typeof r.confidence === "number"
            ? r.confidence
            : undefined,
    }))
}

// ── markdown_frontmatter ──────────────────────────────────────────────────────

function normalizeFrontmatter(raw: unknown): Array<{ key: string; value: string }> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return []
  return Object.entries(raw as Record<string, unknown>).map(([key, val]) => ({
    key,
    value: val == null ? "" : typeof val === "object" ? JSON.stringify(val) : String(val),
  }))
}

// ── Main renderer ─────────────────────────────────────────────────────────────

export function TextAnalysisRenderer({ part }: { part: ToolResultContentPart }) {
  const type = part.type
  const result = part.toolResult as Record<string, unknown> | undefined

  // ── token_count ────────────────────────────────────────────────────────────
  if (type === "token_count") {
    const count = Number(result?.tokens ?? result?.tokenCount ?? result?.count ?? 0)
    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">Token Count</span>
            <ToolStatusBadge variant="neutral">{count.toLocaleString()} tokens</ToolStatusBadge>
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {!result ? <EmptyState>No data</EmptyState> : <TokenCountView result={result} />}
      </ToolRendererShell>
    )
  }

  // ── text_keywords ──────────────────────────────────────────────────────────
  if (type === "text_keywords") {
    const keywords = normalizeKeywords(result?.keywords ?? result?.results ?? result ?? [])

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">Keywords</span>
            <ToolStatusBadge variant="neutral">
              {keywords.length} keyword{keywords.length !== 1 ? "s" : ""}
            </ToolStatusBadge>
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {keywords.length === 0 ? (
          <EmptyState>No keywords found</EmptyState>
        ) : (
          <div className="flex flex-wrap gap-1.5 px-3 py-2.5">
            {keywords.map((kw, i) => (
              <span
                key={i}
                className="text-primary inline-flex items-center gap-1 rounded border border-[color-mix(in_srgb,var(--primary)_20%,transparent)] bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] px-2 py-0.5 font-mono text-[10px]"
              >
                {kw.word}
                {kw.score != null && (
                  <span className="text-primary/50 text-[9px]">{kw.score.toFixed(2)}</span>
                )}
                {kw.count != null && (
                  <span className="text-primary/50 text-[9px]">×{kw.count}</span>
                )}
              </span>
            ))}
          </div>
        )}
      </ToolRendererShell>
    )
  }

  // ── text_entities ──────────────────────────────────────────────────────────
  if (type === "text_entities") {
    const entities = normalizeEntities(result?.entities ?? result?.results ?? result ?? [])

    // Group by type
    const groups = entities.reduce<Record<string, Entity[]>>((acc, e) => {
      ;(acc[e.type] ??= []).push(e)
      return acc
    }, {})

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">Entities</span>
            <ToolStatusBadge variant="neutral">{entities.length} found</ToolStatusBadge>
            {Object.keys(groups).length > 0 && (
              <span className="text-muted-foreground font-mono text-[10px]">
                {Object.keys(groups).length} type{Object.keys(groups).length !== 1 ? "s" : ""}
              </span>
            )}
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {entities.length === 0 ? (
          <EmptyState>No entities found</EmptyState>
        ) : (
          <div className="max-h-[40vh] divide-y overflow-auto">
            {Object.entries(groups).map(([entityType, items]) => (
              <div key={entityType} className="px-3 py-2">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span
                    className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold ${entityClass(entityType)}`}
                  >
                    {entityType}
                  </span>
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {items.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {items.map((e, i) => (
                    <span
                      key={i}
                      className="text-foreground/80 bg-surface-4 rounded px-1.5 py-0.5 font-mono text-[10px]"
                    >
                      {e.text}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </ToolRendererShell>
    )
  }

  // ── markdown_frontmatter ───────────────────────────────────────────────────
  if (type === "markdown_frontmatter") {
    const frontmatterRaw = result?.frontmatter ?? result?.data ?? result?.fields ?? result ?? {}
    const fields = normalizeFrontmatter(frontmatterRaw)
    const yamlStr = fields.map((f) => `${f.key}: ${f.value}`).join("\n")
    const filePath = (result?.file ?? result?.path ?? "") as string

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">Frontmatter</span>
            {filePath && <span className="rk-path-chip max-w-40 min-w-0 truncate">{filePath}</span>}
            <ToolStatusBadge variant="neutral">
              {fields.length} field{fields.length !== 1 ? "s" : ""}
            </ToolStatusBadge>
            {yamlStr && <CopyButton text={yamlStr} className="ml-auto" />}
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {fields.length === 0 ? (
          <EmptyState>No frontmatter</EmptyState>
        ) : (
          <div className="divide-y">
            {fields.map((f, i) => (
              <ToolMetaRow key={i} label={f.key} mono>
                {f.value}
              </ToolMetaRow>
            ))}
          </div>
        )}
      </ToolRendererShell>
    )
  }

  return <EmptyState>Unknown text analysis type</EmptyState>
}
