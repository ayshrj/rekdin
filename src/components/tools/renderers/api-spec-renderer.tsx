"use client"

import { useState } from "react"

import {
  EmptyState,
  ErrorBanner,
  RawPayloadDisclosure,
  RendererTab,
  RendererTabBar,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

function methodVariant(method: string) {
  switch (method.toUpperCase()) {
    case "GET":
      return "success" as const
    case "POST":
      return "info" as const
    case "PUT":
      return "warning" as const
    case "PATCH":
      return "warning" as const
    case "DELETE":
      return "error" as const
    default:
      return "neutral" as const
  }
}

// ── OpenApiInspectRenderer ────────────────────────────────────────────────────

export function OpenApiInspectRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined
  const [tab, setTab] = useState<"endpoints" | "info">("endpoints")

  const error = result?.error ? String(result.error) : undefined
  if (error) {
    return (
      <ToolRendererShell
        header={
          <span className="text-foreground font-mono text-[11px] font-semibold">OpenAPI</span>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        <ErrorBanner>{error}</ErrorBanner>
      </ToolRendererShell>
    )
  }

  const title = result?.title ? String(result.title) : undefined
  const version = result?.version ? String(result.version) : undefined
  const specVersion = result?.specVersion ? String(result.specVersion) : undefined
  const endpointCount = typeof result?.endpointCount === "number" ? result.endpointCount : 0
  const tagCount = typeof result?.tagCount === "number" ? result.tagCount : 0

  const tags = Array.isArray(result?.tags) ? (result.tags as Record<string, unknown>[]) : []

  const info =
    result?.info && typeof result.info === "object" ? (result.info as Record<string, unknown>) : {}

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">OpenAPI</span>
          {title && <span className="rk-path-chip max-w-40 min-w-0 truncate">{title}</span>}
          {version && <span className="rk-path-chip shrink-0">{version}</span>}
          <ToolStatusBadge variant="neutral">{endpointCount} endpoints</ToolStatusBadge>
          {specVersion && (
            <span className="text-muted-foreground font-mono text-[10px]">{specVersion}</span>
          )}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      <RendererTabBar>
        <RendererTab active={tab === "endpoints"} onClick={() => setTab("endpoints")}>
          Endpoints
        </RendererTab>
        {Object.keys(info).length > 0 && (
          <RendererTab active={tab === "info"} onClick={() => setTab("info")}>
            Info
          </RendererTab>
        )}
      </RendererTabBar>

      {tab === "endpoints" && (
        <div className="rk-scrollbar max-h-[55vh] overflow-auto">
          {tags.length === 0 ? (
            <EmptyState>No endpoints</EmptyState>
          ) : (
            tags.map((tag, ti) => {
              const tagName = String(tag.name ?? `Group ${ti + 1}`)
              const endpoints = Array.isArray(tag.endpoints)
                ? (tag.endpoints as Record<string, unknown>[])
                : []
              return (
                <div key={ti}>
                  <div className="border-t border-b px-3 py-1.5">
                    <span className="rk-section-label">{tagName}</span>
                    <span className="text-muted-foreground ml-2 font-mono text-[10px]">
                      {endpoints.length}
                    </span>
                  </div>
                  <div className="divide-y">
                    {endpoints.map((ep, ei) => {
                      const method = ep.method ? String(ep.method) : "GET"
                      const path = ep.path ? String(ep.path) : ""
                      const summary = ep.summary ? String(ep.summary) : undefined
                      const auth = ep.requiresAuth === true

                      return (
                        <div
                          key={ei}
                          className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5"
                        >
                          <ToolStatusBadge
                            variant={methodVariant(method)}
                            className="w-10 shrink-0 text-center"
                          >
                            {method.toUpperCase()}
                          </ToolStatusBadge>
                          <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
                            {path}
                          </span>
                          {summary && (
                            <span className="text-muted-foreground max-w-32 shrink-0 truncate font-mono text-[10px]">
                              {summary}
                            </span>
                          )}
                          {auth && (
                            <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                              🔒
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
          {tagCount > tags.length && (
            <div className="px-3 py-1.5">
              <span className="text-muted-foreground font-mono text-[10px]">
                +{tagCount - tags.length} more groups omitted
              </span>
            </div>
          )}
        </div>
      )}

      {tab === "info" && (
        <div className="rk-scrollbar max-h-[55vh] divide-y overflow-auto">
          {Object.entries(info).map(([k, v], i) => (
            <div key={i} className="hover:bg-surface-4 flex items-start gap-2 px-3 py-1.5">
              <span className="text-muted-foreground w-24 shrink-0 font-mono text-[10px]">{k}</span>
              <span className="text-foreground/80 min-w-0 flex-1 font-mono text-[11px] leading-relaxed">
                {typeof v === "object" ? JSON.stringify(v) : String(v)}
              </span>
            </div>
          ))}
        </div>
      )}
    </ToolRendererShell>
  )
}

// ── GraphqlIntrospectRenderer ─────────────────────────────────────────────────

export function GraphqlIntrospectRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined
  const [tab, setTab] = useState<"queries" | "mutations" | "types">("queries")

  const error = result?.error ? String(result.error) : undefined
  if (error) {
    return (
      <ToolRendererShell
        header={
          <span className="text-foreground font-mono text-[11px] font-semibold">GraphQL</span>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        <ErrorBanner>{error}</ErrorBanner>
      </ToolRendererShell>
    )
  }

  const endpoint = result?.endpoint ? String(result.endpoint) : undefined
  const typeCount = typeof result?.typeCount === "number" ? result.typeCount : 0
  const queries = Array.isArray(result?.queries)
    ? (result.queries as Record<string, unknown>[])
    : []
  const mutations = Array.isArray(result?.mutations)
    ? (result.mutations as Record<string, unknown>[])
    : []
  const types = Array.isArray(result?.types) ? (result.types as Record<string, unknown>[]) : []

  const hasMutations = mutations.length > 0

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">GraphQL</span>
          {endpoint && <span className="rk-path-chip max-w-40 min-w-0 truncate">{endpoint}</span>}
          <ToolStatusBadge variant="neutral">{typeCount} types</ToolStatusBadge>
          <span className="text-muted-foreground font-mono text-[10px]">
            {queries.length}Q · {mutations.length}M
          </span>
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      <RendererTabBar>
        <RendererTab active={tab === "queries"} onClick={() => setTab("queries")}>
          Queries
        </RendererTab>
        {hasMutations && (
          <RendererTab active={tab === "mutations"} onClick={() => setTab("mutations")}>
            Mutations
          </RendererTab>
        )}
        <RendererTab active={tab === "types"} onClick={() => setTab("types")}>
          Types
        </RendererTab>
      </RendererTabBar>

      {(tab === "queries" || tab === "mutations") && (
        <div className="rk-scrollbar max-h-[50vh] divide-y overflow-auto">
          {(tab === "queries" ? queries : mutations).length === 0 ? (
            <EmptyState>None</EmptyState>
          ) : (
            (tab === "queries" ? queries : mutations).map((field, i) => {
              const name = field.name ? String(field.name) : ""
              const type = field.type ? String(field.type) : undefined
              const description = field.description ? String(field.description) : undefined
              return (
                <div key={i} className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
                  <span className="text-foreground/90 min-w-0 flex-1 font-mono text-[11px]">
                    {name}
                  </span>
                  {type && (
                    <span className="rk-path-chip max-w-28 min-w-0 shrink-0 truncate">{type}</span>
                  )}
                  {description && (
                    <span className="text-muted-foreground max-w-32 shrink-0 truncate font-mono text-[10px]">
                      {description}
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {tab === "types" && (
        <div className="rk-scrollbar max-h-[50vh] divide-y overflow-auto">
          {types.length === 0 ? (
            <EmptyState>No types</EmptyState>
          ) : (
            types.map((t, i) => {
              const name = t.name ? String(t.name) : ""
              const kind = t.kind ? String(t.kind) : undefined
              const fieldCount = typeof t.fieldCount === "number" ? t.fieldCount : undefined
              return (
                <div key={i} className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
                  <span className="text-foreground/80 min-w-0 flex-1 font-mono text-[11px]">
                    {name}
                  </span>
                  {kind && <span className="rk-path-chip shrink-0">{kind}</span>}
                  {fieldCount != null && (
                    <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                      {fieldCount} fields
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </ToolRendererShell>
  )
}
