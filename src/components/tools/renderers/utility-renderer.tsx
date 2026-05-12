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

// ── JwtDecodeRenderer ─────────────────────────────────────────────────────────

export function JwtDecodeRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined
  const [tab, setTab] = useState<"payload" | "header">("payload")

  const error = result?.error ? String(result.error) : undefined
  if (error) {
    return (
      <ToolRendererShell
        header={
          <span className="text-foreground font-mono text-[11px] font-semibold">JWT Decode</span>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        <ErrorBanner>{error}</ErrorBanner>
      </ToolRendererShell>
    )
  }

  const algorithm = result?.algorithm ? String(result.algorithm) : undefined
  const expired = result?.expired === true
  const expiresAt = result?.expiresAt ? String(result.expiresAt) : undefined
  const header =
    result?.header && typeof result.header === "object"
      ? (result.header as Record<string, unknown>)
      : {}
  const payload =
    result?.payload && typeof result.payload === "object"
      ? (result.payload as Record<string, unknown>)
      : {}

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">JWT Decode</span>
          {algorithm && <span className="rk-path-chip shrink-0">{algorithm}</span>}
          {expiresAt != null && (
            <ToolStatusBadge variant={expired ? "error" : "success"}>
              {expired ? "expired" : "valid"}
            </ToolStatusBadge>
          )}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      <RendererTabBar>
        <RendererTab active={tab === "payload"} onClick={() => setTab("payload")}>
          Payload
        </RendererTab>
        <RendererTab active={tab === "header"} onClick={() => setTab("header")}>
          Header
        </RendererTab>
      </RendererTabBar>
      {tab === "payload" && (
        <div className="rk-scrollbar max-h-[45vh] divide-y overflow-auto">
          {expiresAt && (
            <div className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
              <span className="text-muted-foreground w-24 shrink-0 font-mono text-[10px]">exp</span>
              <span className="text-foreground/80 min-w-0 flex-1 font-mono text-[11px]">
                {expiresAt}
              </span>
            </div>
          )}
          {Object.entries(payload).map(([k, v], i) => (
            <div key={i} className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
              <span className="text-muted-foreground w-24 shrink-0 font-mono text-[10px]">{k}</span>
              <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
                {JSON.stringify(v)}
              </span>
            </div>
          ))}
        </div>
      )}
      {tab === "header" && (
        <div className="rk-scrollbar max-h-[45vh] divide-y overflow-auto">
          {Object.entries(header).map(([k, v], i) => (
            <div key={i} className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
              <span className="text-muted-foreground w-24 shrink-0 font-mono text-[10px]">{k}</span>
              <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
                {JSON.stringify(v)}
              </span>
            </div>
          ))}
        </div>
      )}
    </ToolRendererShell>
  )
}

// ── RegexMatchRenderer ────────────────────────────────────────────────────────

export function RegexMatchRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined

  const error = result?.error ? String(result.error) : undefined
  if (error) {
    return (
      <ToolRendererShell
        header={
          <span className="text-foreground font-mono text-[11px] font-semibold">Regex Match</span>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        <ErrorBanner>{error}</ErrorBanner>
      </ToolRendererShell>
    )
  }

  const pattern = result?.pattern ? String(result.pattern) : ""
  const flags = result?.flags ? String(result.flags) : ""
  const matchCount = typeof result?.matchCount === "number" ? result.matchCount : 0
  const matches = Array.isArray(result?.matches)
    ? (result.matches as Record<string, unknown>[])
    : []

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Regex Match</span>
          <span className="rk-path-chip max-w-40 min-w-0 truncate">{`/${pattern}/${flags}`}</span>
          <ToolStatusBadge variant={matchCount > 0 ? "success" : "neutral"}>
            {matchCount} matches
          </ToolStatusBadge>
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {matches.length === 0 ? (
        <EmptyState>No matches</EmptyState>
      ) : (
        <div className="rk-scrollbar max-h-[45vh] divide-y overflow-auto">
          {matches.map((m, i) => {
            const full = String(m.match ?? "")
            const index = typeof m.index === "number" ? m.index : undefined
            const groups =
              m.groups && typeof m.groups === "object" ? (m.groups as Record<string, string>) : {}
            const captures = Array.isArray(m.captures) ? (m.captures as (string | null)[]) : []
            return (
              <div key={i} className="hover:bg-surface-4 px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                    #{i + 1}
                  </span>
                  <span className="text-foreground/90 min-w-0 flex-1 truncate font-mono text-[11px]">
                    {full}
                  </span>
                  {index != null && (
                    <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                      @{index}
                    </span>
                  )}
                </div>
                {captures.filter(Boolean).length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {captures.map(
                      (cap, j) =>
                        cap != null && (
                          <span key={j} className="rk-path-chip">
                            {cap}
                          </span>
                        )
                    )}
                  </div>
                )}
                {Object.keys(groups).length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {Object.entries(groups).map(([k, v]) => (
                      <span key={k} className="text-muted-foreground font-mono text-[10px]">
                        {k}:{v}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </ToolRendererShell>
  )
}

// ── UuidGenerateRenderer ──────────────────────────────────────────────────────

export function UuidGenerateRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined
  const uuids = Array.isArray(result?.uuids) ? (result.uuids as string[]) : []

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">UUID Generate</span>
          <ToolStatusBadge variant="neutral">{uuids.length} generated</ToolStatusBadge>
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {uuids.length === 0 ? (
        <EmptyState>No UUIDs</EmptyState>
      ) : (
        <div className="rk-scrollbar max-h-[45vh] divide-y overflow-auto">
          {uuids.map((uuid, i) => (
            <div key={i} className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
              <span className="text-foreground/80 min-w-0 flex-1 font-mono text-[11px]">
                {uuid}
              </span>
              <CopyButton text={uuid} />
            </div>
          ))}
        </div>
      )}
    </ToolRendererShell>
  )
}

// ── UrlParseRenderer ──────────────────────────────────────────────────────────

export function UrlParseRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined

  const error = result?.error ? String(result.error) : undefined
  if (error) {
    return (
      <ToolRendererShell
        header={
          <span className="text-foreground font-mono text-[11px] font-semibold">URL Parse</span>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        <ErrorBanner>{error}</ErrorBanner>
      </ToolRendererShell>
    )
  }

  const protocol = result?.protocol ? String(result.protocol) : undefined
  const host = result?.host ? String(result.host) : undefined
  const pathname = result?.pathname ? String(result.pathname) : undefined
  const hash = result?.hash ? String(result.hash) : undefined
  const params =
    result?.params && typeof result.params === "object" && !Array.isArray(result.params)
      ? Object.entries(result.params as Record<string, string>)
      : []

  const rows = [
    { label: "protocol", value: protocol },
    { label: "host", value: host },
    { label: "pathname", value: pathname },
    { label: "hash", value: hash },
  ].filter((r) => r.value)

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">URL Parse</span>
          {host && <span className="rk-path-chip max-w-40 min-w-0 truncate">{host}</span>}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      <div className="rk-scrollbar max-h-[45vh] divide-y overflow-auto">
        {rows.map((row, i) => (
          <div key={i} className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
            <span className="text-muted-foreground w-20 shrink-0 font-mono text-[10px]">
              {row.label}
            </span>
            <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
              {row.value}
            </span>
          </div>
        ))}
        {params.length > 0 && (
          <>
            <div className="px-3 py-1.5">
              <span className="rk-section-label">Query params</span>
            </div>
            {params.map(([k, v], i) => (
              <div key={i} className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
                <span className="text-muted-foreground w-20 shrink-0 font-mono text-[10px]">
                  {k}
                </span>
                <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
                  {v}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </ToolRendererShell>
  )
}

// ── CronExplainRenderer ───────────────────────────────────────────────────────

export function CronExplainRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined

  const expression = result?.expression ? String(result.expression) : ""
  const explanation = result?.explanation ? String(result.explanation) : ""
  const fields =
    result?.fields && typeof result.fields === "object" && !Array.isArray(result.fields)
      ? (result.fields as Record<string, string>)
      : {}

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Cron Explain</span>
          {expression && <span className="rk-path-chip shrink-0">{expression}</span>}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      <div className="rk-scrollbar max-h-[45vh] divide-y overflow-auto">
        {explanation && (
          <div className="px-3 py-2">
            <p className="text-foreground/80 font-mono text-[11px] leading-relaxed">
              {explanation}
            </p>
          </div>
        )}
        {Object.entries(fields).map(([k, v], i) => (
          <div key={i} className="hover:bg-surface-4 flex items-start gap-2 px-3 py-1.5">
            <span className="text-muted-foreground w-20 shrink-0 font-mono text-[10px]">{k}</span>
            <span className="text-foreground/80 min-w-0 flex-1 font-mono text-[11px] leading-relaxed">
              {v}
            </span>
          </div>
        ))}
      </div>
    </ToolRendererShell>
  )
}

// ── ColorConvertRenderer ──────────────────────────────────────────────────────

export function ColorConvertRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined

  const error = result?.error ? String(result.error) : undefined
  if (error) {
    return (
      <ToolRendererShell
        header={
          <span className="text-foreground font-mono text-[11px] font-semibold">Color Convert</span>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        <ErrorBanner>{error}</ErrorBanner>
      </ToolRendererShell>
    )
  }

  const hex = result?.hex ? String(result.hex) : undefined
  const rgb = result?.rgb ? String(result.rgb) : undefined
  const hsl = result?.hsl ? String(result.hsl) : undefined
  const r = typeof result?.r === "number" ? result.r : undefined

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Color Convert</span>
          {hex && (
            <span className="flex items-center gap-1.5">
              <span
                className="h-3 w-3 shrink-0 rounded-sm border border-white/10"
                style={{ backgroundColor: hex }}
              />
              <span className="rk-path-chip shrink-0">{hex}</span>
            </span>
          )}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      <div className="divide-y">
        {[
          { label: "hex", value: hex },
          { label: "rgb", value: rgb },
          { label: "hsl", value: hsl },
        ]
          .filter((row) => row.value)
          .map((row, i) => (
            <div key={i} className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
              <span className="text-muted-foreground w-8 shrink-0 font-mono text-[10px]">
                {row.label}
              </span>
              <span className="text-foreground/80 min-w-0 flex-1 font-mono text-[11px]">
                {row.value}
              </span>
              <CopyButton text={row.value!} />
            </div>
          ))}
        {r != null && (
          <div className="px-3 py-1.5">
            <div className="flex h-4 overflow-hidden rounded-sm">
              <div style={{ width: `${(r / 255) * 33.3}%`, backgroundColor: `rgb(${r},0,0)` }} />
              <div
                style={{
                  width: `${(((result?.g as number) ?? 0) / 255) * 33.3}%`,
                  backgroundColor: `rgb(0,${(result?.g as number) ?? 0},0)`,
                }}
              />
              <div
                style={{
                  width: `${(((result?.b as number) ?? 0) / 255) * 33.3}%`,
                  backgroundColor: `rgb(0,0,${(result?.b as number) ?? 0})`,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </ToolRendererShell>
  )
}

// ── TextDiffRenderer ──────────────────────────────────────────────────────────

export function TextDiffRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined

  const patch = result?.patch ? String(result.patch) : undefined
  const fromLabel = result?.from ? String(result.from) : "a"
  const toLabel = result?.to ? String(result.to) : "b"
  const additions = typeof result?.additions === "number" ? result.additions : undefined
  const deletions = typeof result?.deletions === "number" ? result.deletions : undefined

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Text Diff</span>
          <span className="rk-path-chip max-w-24 min-w-0 truncate">{fromLabel}</span>
          <span className="text-muted-foreground font-mono text-[10px]">→</span>
          <span className="rk-path-chip max-w-24 min-w-0 truncate">{toLabel}</span>
          {additions != null && (
            <span className="text-status-success font-mono text-[10px]">+{additions}</span>
          )}
          {deletions != null && (
            <span className="text-destructive font-mono text-[10px]">-{deletions}</span>
          )}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {!patch ? (
        <EmptyState>No diff</EmptyState>
      ) : (
        <div className="rk-scrollbar max-h-[50vh] overflow-auto">
          <pre className="p-3 font-mono text-[10px] leading-relaxed whitespace-pre-wrap">
            {patch.split("\n").map((line, i) => (
              <span
                key={i}
                className={
                  line.startsWith("+") && !line.startsWith("+++")
                    ? "text-status-success block"
                    : line.startsWith("-") && !line.startsWith("---")
                      ? "text-destructive block"
                      : line.startsWith("@@")
                        ? "text-primary block"
                        : "text-foreground/60 block"
                }
              >
                {line}
              </span>
            ))}
          </pre>
        </div>
      )}
    </ToolRendererShell>
  )
}

// ── JsonDiffRenderer ──────────────────────────────────────────────────────────

export function JsonDiffRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined

  const patch = result?.patch ? String(result.patch) : undefined
  const additions = typeof result?.additions === "number" ? result.additions : undefined
  const deletions = typeof result?.deletions === "number" ? result.deletions : undefined
  const identical = result?.identical === true

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">JSON Diff</span>
          {identical ? (
            <ToolStatusBadge variant="success">identical</ToolStatusBadge>
          ) : (
            <>
              {additions != null && (
                <span className="text-status-success font-mono text-[10px]">+{additions}</span>
              )}
              {deletions != null && (
                <span className="text-destructive font-mono text-[10px]">-{deletions}</span>
              )}
            </>
          )}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {identical ? (
        <EmptyState>Files are identical</EmptyState>
      ) : !patch ? (
        <EmptyState>No diff</EmptyState>
      ) : (
        <div className="rk-scrollbar max-h-[50vh] overflow-auto">
          <pre className="p-3 font-mono text-[10px] leading-relaxed whitespace-pre-wrap">
            {patch.split("\n").map((line, i) => (
              <span
                key={i}
                className={
                  line.startsWith("+") && !line.startsWith("+++")
                    ? "text-status-success block"
                    : line.startsWith("-") && !line.startsWith("---")
                      ? "text-destructive block"
                      : line.startsWith("@@")
                        ? "text-primary block"
                        : "text-foreground/60 block"
                }
              >
                {line}
              </span>
            ))}
          </pre>
        </div>
      )}
    </ToolRendererShell>
  )
}
