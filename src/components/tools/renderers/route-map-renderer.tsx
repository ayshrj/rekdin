"use client"

import { useState } from "react"

import { FileExtensionIcon } from "@/components/file-extension-icon"

import {
  CopyButton,
  EmptyState,
  RawPayloadDisclosure,
  RendererTab,
  RendererTabBar,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

// ── route_map ────────────────────────────────────────────────────────────────

interface RouteEntry {
  method: string
  path: string
  file?: string
  line?: number
  handler?: string
}

const METHOD_COLORS: Record<string, string> = {
  GET: "text-emerald-600 bg-emerald-500/10 border-emerald-500/25",
  POST: "text-blue-500 bg-blue-500/10 border-blue-500/25",
  PUT: "text-amber-500 bg-amber-500/10 border-amber-500/25",
  PATCH: "text-amber-400 bg-amber-400/10 border-amber-400/25",
  DELETE: "text-destructive bg-destructive/10 border-destructive/25",
  HEAD: "text-muted-foreground bg-surface-4 border-border",
  OPTIONS: "text-muted-foreground bg-surface-4 border-border",
}

function normalizeRoutes(raw: unknown): RouteEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
    .map((r) => ({
      method: String(r.method ?? r.verb ?? "GET").toUpperCase(),
      path: String(r.path ?? r.route ?? r.url ?? "/"),
      file: r.file ? String(r.file) : undefined,
      line: typeof r.line === "number" ? r.line : undefined,
      handler: r.handler ? String(r.handler) : undefined,
    }))
}

function RouteTable({ routes }: { routes: RouteEntry[] }) {
  if (routes.length === 0) return <EmptyState>No routes found</EmptyState>
  return (
    <div className="max-h-[40vh] divide-y overflow-auto">
      {routes.map((r, i) => {
        const mc = METHOD_COLORS[r.method] ?? "text-muted-foreground bg-surface-4 border-border"
        return (
          <div key={i} className="hover:bg-surface-4 flex items-center gap-2.5 px-3 py-1.5">
            <span
              className={`w-14 shrink-0 rounded border px-1.5 py-0.5 text-center font-mono text-[9px] font-semibold ${mc}`}
            >
              {r.method}
            </span>
            <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
              {r.path}
            </span>
            {r.file && (
              <div className="flex max-w-40 min-w-0 shrink-0 items-center gap-1">
                <FileExtensionIcon extensionName={r.file} className="h-3 w-3 shrink-0" />
                <span className="text-muted-foreground min-w-0 truncate font-mono text-[10px]">
                  {r.file}
                  {r.line != null ? `:${r.line}` : ""}
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── test_map ─────────────────────────────────────────────────────────────────

interface TestFileEntry {
  file: string
  tests: string[]
  count?: number
}

function normalizeTests(raw: unknown): TestFileEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
    .map((r) => ({
      file: String(r.file ?? r.path ?? ""),
      tests: Array.isArray(r.tests) ? r.tests.map(String) : [],
      count: typeof r.count === "number" ? r.count : undefined,
    }))
}

function TestTable({ tests }: { tests: TestFileEntry[] }) {
  const [openFiles, setOpenFiles] = useState<Set<number>>(new Set())

  const toggle = (i: number) =>
    setOpenFiles((s) => {
      const next = new Set(s)
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })

  if (tests.length === 0) return <EmptyState>No test files found</EmptyState>

  return (
    <div className="max-h-[40vh] divide-y overflow-auto">
      {tests.map((t, i) => (
        <div key={i}>
          <button
            type="button"
            className="hover:bg-surface-4 flex w-full items-center gap-2 px-3 py-1.5 text-left"
            onClick={() => toggle(i)}
          >
            <FileExtensionIcon extensionName={t.file} className="h-3 w-3 shrink-0" />
            <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
              {t.file}
            </span>
            <ToolStatusBadge variant="neutral">
              {t.count ?? t.tests.length} test{(t.count ?? t.tests.length) !== 1 ? "s" : ""}
            </ToolStatusBadge>
          </button>
          {openFiles.has(i) && t.tests.length > 0 && (
            <div className="divide-y border-t bg-(--surface-4)/40">
              {t.tests.map((name, j) => (
                <div key={j} className="px-8 py-1">
                  <span className="text-muted-foreground font-mono text-[10px]">{name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── config_inventory ─────────────────────────────────────────────────────────

interface ConfigEntry {
  path: string
  type?: string
  description?: string
}

function normalizeConfigs(raw: unknown): ConfigEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
    .map((r) => ({
      path: String(r.path ?? r.file ?? r.name ?? ""),
      type: r.type ? String(r.type) : undefined,
      description: r.description ? String(r.description) : undefined,
    }))
}

// ── env_inventory ─────────────────────────────────────────────────────────────

interface EnvEntry {
  name: string
  source?: string
  hasValue?: boolean
  value?: string
}

function normalizeEnvVars(raw: unknown): EnvEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
    .map((r) => ({
      name: String(r.name ?? r.key ?? r.variable ?? ""),
      source: r.source ? String(r.source) : undefined,
      hasValue: typeof r.hasValue === "boolean" ? r.hasValue : r.value != null,
      value: r.value ? String(r.value) : undefined,
    }))
}

// ── lockfile_summary ─────────────────────────────────────────────────────────

interface LockfilePackage {
  name: string
  version: string
  resolved?: string
}

function normalizeLockfile(raw: unknown): LockfilePackage[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
    .map((r) => ({
      name: String(r.name ?? r.package ?? ""),
      version: String(r.version ?? r.ver ?? ""),
      resolved: r.resolved ? String(r.resolved) : undefined,
    }))
}

// ── Main renderer ─────────────────────────────────────────────────────────────

type ActiveTab = "routes" | "tests" | "config" | "env" | "lockfile"

export function RouteMapRenderer({ part }: { part: ToolResultContentPart }) {
  const type = part.type
  const result = part.toolResult as Record<string, unknown> | undefined
  const [showValues, setShowValues] = useState(false)
  // Fallback multi-tab view when type is unexpected
  const [tab, setTab] = useState<ActiveTab>("routes")

  if (type === "route_map") {
    const routes = normalizeRoutes(result?.routes ?? result?.items ?? result ?? [])
    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">Route Map</span>
            <ToolStatusBadge variant="neutral">
              {routes.length} route{routes.length !== 1 ? "s" : ""}
            </ToolStatusBadge>
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        <RouteTable routes={routes} />
      </ToolRendererShell>
    )
  }

  if (type === "test_map") {
    const tests = normalizeTests(result?.files ?? result?.tests ?? result ?? [])
    const totalTests = tests.reduce((n, t) => n + (t.count ?? t.tests.length), 0)
    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">Test Map</span>
            <ToolStatusBadge variant="neutral">
              {tests.length} file{tests.length !== 1 ? "s" : ""}
            </ToolStatusBadge>
            {totalTests > 0 && (
              <span className="text-muted-foreground font-mono text-[10px]">
                {totalTests} tests
              </span>
            )}
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        <TestTable tests={tests} />
      </ToolRendererShell>
    )
  }

  if (type === "config_inventory") {
    const configs = normalizeConfigs(result?.files ?? result?.configs ?? result ?? [])
    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">
              Config Inventory
            </span>
            <ToolStatusBadge variant="neutral">
              {configs.length} file{configs.length !== 1 ? "s" : ""}
            </ToolStatusBadge>
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {configs.length === 0 ? (
          <EmptyState>No config files found</EmptyState>
        ) : (
          <div className="max-h-[40vh] divide-y overflow-auto">
            {configs.map((c, i) => (
              <div key={i} className="hover:bg-surface-4 flex items-center gap-2.5 px-3 py-1.5">
                <FileExtensionIcon extensionName={c.path} className="h-3 w-3 shrink-0" />
                <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
                  {c.path}
                </span>
                {c.type && (
                  <span className="text-muted-foreground border-border bg-surface-4 shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px]">
                    {c.type}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </ToolRendererShell>
    )
  }

  if (type === "env_inventory") {
    const vars = normalizeEnvVars(result?.variables ?? result?.vars ?? result ?? [])
    const missing = vars.filter((v) => !v.hasValue).length
    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">
              Env Inventory
            </span>
            <ToolStatusBadge variant="neutral">
              {vars.length} variable{vars.length !== 1 ? "s" : ""}
            </ToolStatusBadge>
            {missing > 0 && <ToolStatusBadge variant="warning">{missing} unset</ToolStatusBadge>}
            <button
              type="button"
              onClick={() => setShowValues((v) => !v)}
              className="rk-flat-button ml-auto text-[10px]"
            >
              {showValues ? "hide values" : "show values"}
            </button>
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {vars.length === 0 ? (
          <EmptyState>No environment variables found</EmptyState>
        ) : (
          <div className="max-h-[40vh] divide-y overflow-auto">
            {vars.map((v, i) => (
              <div key={i} className="hover:bg-surface-4 flex items-center gap-2.5 px-3 py-1.5">
                <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
                  {v.name}
                </span>
                {v.source && (
                  <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                    {v.source}
                  </span>
                )}
                {showValues && v.value ? (
                  <span className="text-foreground/50 max-w-30 min-w-0 truncate font-mono text-[10px]">
                    {v.value}
                  </span>
                ) : (
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-medium ${
                      v.hasValue
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "text-destructive bg-destructive/10"
                    }`}
                  >
                    {v.hasValue ? "set" : "unset"}
                  </span>
                )}
                {showValues && v.value && <CopyButton text={v.value} />}
              </div>
            ))}
          </div>
        )}
      </ToolRendererShell>
    )
  }

  if (type === "lockfile_summary") {
    const packages = normalizeLockfile(result?.packages ?? result?.dependencies ?? result ?? [])
    const lockFile = (result?.file ?? result?.lockfile ?? "") as string
    const total = result?.totalPackages ?? packages.length
    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">Lockfile</span>
            {lockFile && <span className="rk-path-chip max-w-40 min-w-0 truncate">{lockFile}</span>}
            <ToolStatusBadge variant="neutral">
              {String(total)} package{Number(total) !== 1 ? "s" : ""}
            </ToolStatusBadge>
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {packages.length === 0 ? (
          <EmptyState>No packages</EmptyState>
        ) : (
          <div className="max-h-[40vh] divide-y overflow-auto">
            {packages.map((p, i) => (
              <div key={i} className="hover:bg-surface-4 flex items-center gap-2.5 px-3 py-1.5">
                <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
                  {p.name}
                </span>
                <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                  {p.version}
                </span>
              </div>
            ))}
          </div>
        )}
      </ToolRendererShell>
    )
  }

  const routes = normalizeRoutes(result?.routes ?? [])
  const tests = normalizeTests(result?.tests ?? [])

  return (
    <ToolRendererShell
      header={
        <span className="text-foreground font-mono text-[11px] font-semibold">Project Map</span>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      <RendererTabBar>
        <RendererTab active={tab === "routes"} onClick={() => setTab("routes")}>
          Routes ({routes.length})
        </RendererTab>
        <RendererTab active={tab === "tests"} onClick={() => setTab("tests")}>
          Tests ({tests.length})
        </RendererTab>
      </RendererTabBar>
      {tab === "routes" && <RouteTable routes={routes} />}
      {tab === "tests" && <TestTable tests={tests} />}
    </ToolRendererShell>
  )
}
