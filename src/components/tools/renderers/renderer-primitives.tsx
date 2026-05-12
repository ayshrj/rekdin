/**
 * renderer-primitives.tsx
 *
 * Shared micro-components for tool result renderers.
 * Every renderer uses these — do not import outside of renderers/.
 *
 * Design rules enforced here:
 *  - Outer shell:   ToolRendererShell — border, rounded-lg, bg-surface-3
 *  - Header zone:   px-3 py-2, border-b, bg-surface-3, gap-2 items-center
 *  - Body zone:     bg-surface-3
 *  - Footer/disc:   border-t, px-3 py-1.5
 *  - Title text:    font-mono text-[11px] font-semibold text-foreground
 *  - Meta text:     font-mono text-[10px] text-muted-foreground  (rk-section-label)
 *  - Body text:     font-mono text-[11px] leading-relaxed text-foreground/80
 *  - Tabs (multi):  RendererTab / RendererTabBar  → rk-tab / rk-tab-active (h-10 underline)
 *  - Toggle (2-opt):SegmentedControl              → compact pill, no underline
 *  - Badges:        ToolStatusBadge / ExitCodeBadge  — CSS variable tokens only
 *  - Copy:          CopyButton — ghost, no background, p-1 rounded, h-3 w-3 icon
 *  - Empty:         EmptyState — centered, px-3 py-4, font-mono text-[11px] italic muted
 *  - Error banner:  ErrorBanner — border-b, bg-destructive/10, text-[11px]
 */

"use client"

import React, { useCallback, useState } from "react"

import { useChat } from "@/contexts/chat-context"
import {
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardDocumentList as Copy,
  Search,
  XMark as X,
} from "@/lib/icons"
import { cn } from "@/lib/utils"

// ─── CopyButton ──────────────────────────────────────────────────────────────
// Ghost, no background. Sits inline in headers and body rows.

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "inline-flex items-center justify-center rounded p-1 transition-colors duration-150",
        "text-muted-foreground hover:text-foreground",
        className
      )}
      title="Copy to clipboard"
      aria-label="Copy to clipboard"
    >
      {copied ? <Check className="text-status-success h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

// ─── ToolStatusBadge ─────────────────────────────────────────────────────────
// Always uses CSS variable tokens. Never raw Tailwind color names.

type StatusVariant = "success" | "error" | "warning" | "info" | "neutral"

const STATUS_CLASSES: Record<StatusVariant, string> = {
  success:
    "bg-[color-mix(in_srgb,var(--status-success)_12%,transparent)] text-status-success border-[color-mix(in_srgb,var(--status-success)_25%,transparent)]",
  error:
    "bg-[color-mix(in_srgb,var(--destructive)_12%,transparent)] text-destructive border-[color-mix(in_srgb,var(--destructive)_25%,transparent)]",
  warning:
    "bg-[color-mix(in_srgb,var(--status-warning)_12%,transparent)] text-status-warning border-[color-mix(in_srgb,var(--status-warning)_25%,transparent)]",
  info: "bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-primary border-[color-mix(in_srgb,var(--primary)_25%,transparent)]",
  neutral: "bg-surface-4 text-muted-foreground border-border",
}

export function ToolStatusBadge({
  variant = "neutral",
  children,
  className,
}: {
  variant?: StatusVariant
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] leading-none font-medium",
        STATUS_CLASSES[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

// ─── ExitCodeBadge ───────────────────────────────────────────────────────────
// Specific badge for shell exit codes. Used in CommandResultRenderer and
// ScriptResultRenderer — replaces hand-rolled inline class strings.

export function ExitCodeBadge({ code }: { code: number }) {
  return (
    <ToolStatusBadge variant={code !== 0 ? "error" : "success"}>exit&nbsp;{code}</ToolStatusBadge>
  )
}

// ─── RendererTabBar / RendererTab ─────────────────────────────────────────────
// Underline tab system using rk-tab / rk-tab-active from globals.css.
// Use for 3+ options (json tree/raw/headers, http overview/headers/body,
// deep-research summary/sources/insights).

export function RendererTabBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex border-b" role="tablist">
      {children}
    </div>
  )
}

export function RendererTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn("rk-tab", active && "rk-tab-active")}
    >
      {children}
    </button>
  )
}

// ─── SegmentedControl ────────────────────────────────────────────────────────
// Two-option compact toggle (tree/raw, preview/raw, both/script/output).
// Different from RendererTab: no underline, surface-5 active fill.

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex overflow-hidden rounded border" role="group">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={cn(
            "px-2 py-0.5 font-mono text-[10px] font-medium transition-colors duration-150",
            value === opt.value
              ? "text-foreground bg-surface-5"
              : "text-muted-foreground hover:text-foreground bg-surface-3"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ─── EmptyState ──────────────────────────────────────────────────────────────

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground px-3 py-4 text-center font-mono text-[11px] italic">
      {children}
    </div>
  )
}

// ─── ErrorBanner ─────────────────────────────────────────────────────────────
// Full-width error strip, sits between header and body or as body content.

export function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-destructive border-b border-[color-mix(in_srgb,var(--destructive)_25%,transparent)] bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] px-3 py-2 font-mono text-[11px]">
      {children}
    </div>
  )
}

// ─── ToolMetaRow ─────────────────────────────────────────────────────────────
// Label + value row in an overview / metadata table.

export function ToolMetaRow({
  label,
  children,
  mono = false,
}: {
  label: string
  children: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex items-start gap-3 px-3 py-1.5">
      <span className="text-muted-foreground w-20 shrink-0 pt-px font-mono text-[10px]">
        {label}
      </span>
      <span
        className={cn(
          "text-foreground/80 min-w-0 flex-1 text-[11px] break-all",
          mono && "font-mono"
        )}
      >
        {children}
      </span>
    </div>
  )
}

// ─── MonoField ───────────────────────────────────────────────────────────────
// Labelled monospace pre block — selectors, commands, values in browser actions.

export function MonoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2">
      <span className="rk-section-label mb-1 block">{label}</span>
      <pre className="text-foreground/80 bg-surface-4 rounded px-2 py-1 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap">
        {value}
      </pre>
    </div>
  )
}

// ─── CoordRow ────────────────────────────────────────────────────────────────

export function CoordRow({ label, x, y }: { label: string; x: number; y: number }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <span className="rk-section-label w-28 shrink-0">{label}</span>
      <span className="text-foreground/80 font-mono text-[11px]">
        x:&nbsp;{x},&nbsp;y:&nbsp;{y}
      </span>
    </div>
  )
}

// ─── RawPayloadDisclosure ─────────────────────────────────────────────────────
// Collapsible raw JSON footer. Every renderer includes this as zone 3.

export function RawPayloadDisclosure({
  payload,
  label = "Raw",
  defaultOpen = false,
}: {
  payload: unknown
  label?: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2)

  return (
    <div className="border-t">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="hover:bg-surface-4 flex w-full items-center gap-1.5 px-3 py-1.5 text-left transition-colors duration-150"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="text-muted-foreground h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="text-muted-foreground h-3 w-3 shrink-0" />
        )}
        <span className="rk-section-label">{label}</span>
      </button>
      {open && (
        <div className="px-3 pb-2">
          <pre className="rk-code-block max-h-60 text-[10px] leading-relaxed">{text}</pre>
        </div>
      )}
    </div>
  )
}

// ─── SearchInput ─────────────────────────────────────────────────────────────
// Compact filter input for renderer headers. Fits inline at h-6 height.

export function SearchInput({
  value,
  onChange,
  placeholder = "Filter…",
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "bg-surface-4 flex h-6 items-center gap-1 rounded border px-1.5 transition-colors",
        "focus-within:border-border focus-within:ring-border/30 focus-within:ring-1",
        className
      )}
    >
      <Search className="text-muted-foreground h-3 w-3 shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-foreground placeholder:text-muted-foreground/50 w-full bg-transparent font-mono text-[11px] outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
          aria-label="Clear filter"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

// ─── useToolInvoke ───────────────────────────────────────────────────────────
// Shared hook for no-LLM direct tool invocations from renderers.
// Calls /api/tools/invoke with the current session ID.
// Only tools in the allowlist on that route are accepted.

export type ToolInvokeState<T = unknown> = {
  loading: boolean
  result: T | null
  error: string | null
}

export function useToolInvoke<T = unknown>(toolName: string) {
  const { currentSessionId } = useChat()
  const [state, setState] = useState<ToolInvokeState<T>>({
    loading: false,
    result: null,
    error: null,
  })

  const invoke = useCallback(
    async (toolInput: Record<string, unknown> = {}): Promise<T | null> => {
      if (!currentSessionId) return null
      setState({ loading: true, result: null, error: null })
      try {
        const res = await fetch("/api/tools/invoke", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: currentSessionId, toolName, toolInput }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? "Tool invocation failed")
        const result = (
          typeof data.result === "string" ? JSON.parse(data.result) : data.result
        ) as T
        setState({ loading: false, result, error: null })
        return result
      } catch (err) {
        const error = err instanceof Error ? err.message : "Unknown error"
        setState({ loading: false, result: null, error })
        return null
      }
    },
    [currentSessionId, toolName]
  )

  const reset = useCallback(() => setState({ loading: false, result: null, error: null }), [])

  return { ...state, invoke, reset }
}

// ─── InlineToolResult ────────────────────────────────────────────────────────
// Collapsible panel for showing a nested tool result inside another renderer.
// Pass a title (e.g. file path or commit SHA), an onDismiss handler, and
// children as the rendered body content.

export function InlineToolResult({
  title,
  onDismiss,
  error,
  children,
  className,
}: {
  title: string
  onDismiss: () => void
  error?: string | null
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("bg-surface-3 border-t", className)}>
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
          {title}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground shrink-0 rounded p-0.5 transition-colors"
          title="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      {error ? (
        <p className="text-destructive px-3 py-2 font-mono text-[11px]">{error}</p>
      ) : (
        children
      )}
    </div>
  )
}

// ─── toScreenshotSrc ─────────────────────────────────────────────────────────
// Normalises a screenshot value that may be:
//   • a data URI  ("data:image/png;base64,…")  → use as-is
//   • an artifact URL ("/api/artifacts/…") or absolute URL → use as-is
//   • a raw base64 string (no prefix)          → prepend data URI header

export function toScreenshotSrc(s: string): string {
  if (!s) return s
  if (s.startsWith("data:") || s.startsWith("/") || s.startsWith("http")) return s
  return `data:image/png;base64,${s}`
}

// ─── ToolRendererShell ───────────────────────────────────────────────────────
// The single outer wrapper for all renderers.
// header → zone 1 (identity, status, primary metadata)
// children → zone 2 (result body)
// footer → zone 3 (raw disclosure, actions)

export function ToolRendererShell({
  header,
  children,
  footer,
  className,
}: {
  header: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("bg-surface-3 w-full min-w-0 overflow-hidden rounded-lg border", className)}>
      <div className="bg-surface-3 flex min-h-0 items-center gap-2 border-b px-3 py-2">
        {header}
      </div>
      <div className="bg-surface-3">{children}</div>
      {footer && <div className="bg-surface-3">{footer}</div>}
    </div>
  )
}
