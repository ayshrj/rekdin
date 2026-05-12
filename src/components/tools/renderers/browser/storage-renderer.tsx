"use client"

import { useState } from "react"

import { ChevronDown, ChevronRight } from "@/lib/icons"

import {
  CopyButton,
  EmptyState,
  RawPayloadDisclosure,
  RendererTab,
  RendererTabBar,
  ToolRendererShell,
  ToolStatusBadge,
} from "../renderer-primitives"
import { type ToolResultContentPart } from "../tool-result-renderer"

// ── Key-value store table ─────────────────────────────────────────────────────

interface KvEntry {
  key: string
  value: string
}

function normalizeKv(raw: unknown): KvEntry[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return []
  return Object.entries(raw as Record<string, unknown>).map(([key, val]) => ({
    key,
    value: val == null ? "" : typeof val === "object" ? JSON.stringify(val) : String(val),
  }))
}

function KvTable({ entries }: { entries: KvEntry[] }) {
  if (entries.length === 0) return <EmptyState>Empty</EmptyState>
  return (
    <div className="rk-scrollbar max-h-[30vh] divide-y overflow-auto">
      {entries.map((e, i) => (
        <div key={i} className="hover:bg-surface-4 flex items-start gap-3 px-3 py-1.5">
          <span className="text-foreground/60 w-32 shrink-0 truncate pt-px font-mono text-[10px]">
            {e.key}
          </span>
          <span className="text-foreground/80 min-w-0 flex-1 font-mono text-[10px] break-all">
            {e.value}
          </span>
          <CopyButton
            text={e.value}
            className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          />
        </div>
      ))}
    </div>
  )
}

// ── Cookies ───────────────────────────────────────────────────────────────────

interface Cookie {
  name: string
  value: string
  domain?: string
  path?: string
  httpOnly?: boolean
  secure?: boolean
}

function normalizeCookies(raw: unknown): Cookie[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
    .map((r) => ({
      name: String(r.name ?? r.key ?? ""),
      value: String(r.value ?? ""),
      domain: r.domain ? String(r.domain) : undefined,
      path: r.path ? String(r.path) : undefined,
      httpOnly: typeof r.httpOnly === "boolean" ? r.httpOnly : undefined,
      secure: typeof r.secure === "boolean" ? r.secure : undefined,
    }))
}

// ── A11y tree ─────────────────────────────────────────────────────────────────

interface A11yNode {
  role: string
  name?: string
  description?: string
  children?: A11yNode[]
}

function normalizeA11yNode(raw: unknown): A11yNode | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  return {
    role: String(r.role ?? r.type ?? "generic"),
    name: r.name ? String(r.name) : undefined,
    description: r.description ? String(r.description) : undefined,
    children: Array.isArray(r.children)
      ? ((r.children as unknown[]).map(normalizeA11yNode).filter(Boolean) as A11yNode[])
      : undefined,
  }
}

function A11yNodeRow({ node, depth }: { node: A11yNode; depth: number }) {
  const [open, setOpen] = useState(depth < 2)
  const hasChildren = (node.children?.length ?? 0) > 0

  return (
    <>
      <div
        className="hover:bg-surface-4 flex items-center gap-1.5 py-0.5"
        style={{ paddingLeft: `${12 + depth * 14}px`, paddingRight: "12px" }}
      >
        <span className="text-muted-foreground/50 w-3 shrink-0">
          {hasChildren ? (
            <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center">
              {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          ) : null}
        </span>
        <span className="text-muted-foreground border-border bg-surface-4 shrink-0 rounded border px-1 py-px font-mono text-[9px]">
          {node.role}
        </span>
        {node.name && (
          <span className="text-foreground/80 min-w-0 truncate font-mono text-[10px]">
            {node.name}
          </span>
        )}
        {node.description && (
          <span className="text-muted-foreground min-w-0 truncate font-mono text-[10px]">
            {node.description}
          </span>
        )}
      </div>
      {open &&
        hasChildren &&
        node.children?.map((child, i) => <A11yNodeRow key={i} node={child} depth={depth + 1} />)}
    </>
  )
}

// ── Main renderer ─────────────────────────────────────────────────────────────

type StorageTab = "localStorage" | "sessionStorage" | "cookies"

export function BrowserStorageRenderer({ part }: { part: ToolResultContentPart }) {
  const type = part.type
  const result = part.toolResult as Record<string, unknown> | undefined

  // ── browser_storage_snapshot (default) ────────────────────────────────────
  const [tab, setTab] = useState<StorageTab>("localStorage")

  // ── browser_set_viewport ───────────────────────────────────────────────────
  if (type === "browser_set_viewport") {
    const input = part.toolInput as Record<string, unknown> | undefined
    const width = Number(result?.width ?? input?.width ?? 0)
    const height = Number(result?.height ?? input?.height ?? 0)
    const deviceScaleFactor = result?.deviceScaleFactor ?? input?.deviceScaleFactor
    const mobile = result?.mobile ?? input?.mobile

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">
              Set Viewport
            </span>
            {(width > 0 || height > 0) && (
              <ToolStatusBadge variant="success">
                {width}×{height}
              </ToolStatusBadge>
            )}
            {mobile != null && (
              <span className="text-muted-foreground font-mono text-[10px]">
                {mobile ? "mobile" : "desktop"}
              </span>
            )}
            {deviceScaleFactor != null && (
              <span className="text-muted-foreground font-mono text-[10px]">
                {String(deviceScaleFactor)}x
              </span>
            )}
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        <EmptyState>Viewport configured</EmptyState>
      </ToolRendererShell>
    )
  }

  // ── browser_accessibility_snapshot ────────────────────────────────────────
  if (type === "browser_accessibility_snapshot") {
    const rawTree = result?.snapshot ?? result?.tree ?? result?.root ?? result
    const root = normalizeA11yNode(rawTree)

    return (
      <ToolRendererShell
        header={
          <span className="text-foreground font-mono text-[11px] font-semibold">
            Accessibility Tree
          </span>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {!root ? (
          <EmptyState>No a11y data</EmptyState>
        ) : (
          <div className="rk-scrollbar max-h-[45vh] overflow-auto py-1">
            <A11yNodeRow node={root} depth={0} />
          </div>
        )}
      </ToolRendererShell>
    )
  }

  const localEntries = normalizeKv(result?.localStorage ?? result?.local ?? {})
  const sessionEntries = normalizeKv(result?.sessionStorage ?? result?.session ?? {})
  const cookies = normalizeCookies(result?.cookies ?? [])

  const totalItems = localEntries.length + sessionEntries.length + cookies.length

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">
            Storage Snapshot
          </span>
          <ToolStatusBadge variant="neutral">
            {totalItems} item{totalItems !== 1 ? "s" : ""}
          </ToolStatusBadge>
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      <RendererTabBar>
        <RendererTab active={tab === "localStorage"} onClick={() => setTab("localStorage")}>
          localStorage ({localEntries.length})
        </RendererTab>
        <RendererTab active={tab === "sessionStorage"} onClick={() => setTab("sessionStorage")}>
          sessionStorage ({sessionEntries.length})
        </RendererTab>
        <RendererTab active={tab === "cookies"} onClick={() => setTab("cookies")}>
          cookies ({cookies.length})
        </RendererTab>
      </RendererTabBar>
      {tab === "localStorage" && <KvTable entries={localEntries} />}
      {tab === "sessionStorage" && <KvTable entries={sessionEntries} />}
      {tab === "cookies" &&
        (cookies.length === 0 ? (
          <EmptyState>No cookies</EmptyState>
        ) : (
          <div className="rk-scrollbar max-h-[30vh] divide-y overflow-auto">
            {cookies.map((c, i) => (
              <div key={i} className="hover:bg-surface-4 flex items-start gap-2.5 px-3 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-foreground/80 min-w-0 truncate font-mono text-[11px]">
                      {c.name}
                    </span>
                    {c.domain && (
                      <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                        {c.domain}
                      </span>
                    )}
                    {c.httpOnly && (
                      <span className="border-border bg-surface-4 text-muted-foreground shrink-0 rounded border px-1 py-px font-mono text-[9px]">
                        httpOnly
                      </span>
                    )}
                    {c.secure && (
                      <span className="shrink-0 rounded border border-emerald-500/25 bg-emerald-500/10 px-1 py-px font-mono text-[9px] text-emerald-600">
                        secure
                      </span>
                    )}
                  </div>
                  <span className="text-muted-foreground mt-0.5 block min-w-0 truncate font-mono text-[10px]">
                    {c.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))}
    </ToolRendererShell>
  )
}
