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

import React, { useState } from "react"

import { Check, ChevronDown, ChevronRight, ClipboardDocumentList as Copy } from "@/lib/icons"
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
      {copied ? (
        <Check className="h-3 w-3 text-[color:var(--status-success)]" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  )
}

// ─── ToolStatusBadge ─────────────────────────────────────────────────────────
// Always uses CSS variable tokens. Never raw Tailwind color names.

type StatusVariant = "success" | "error" | "warning" | "info" | "neutral"

const STATUS_CLASSES: Record<StatusVariant, string> = {
  success:
    "bg-[color-mix(in_srgb,var(--status-success)_12%,transparent)] text-[color:var(--status-success)] border-[color-mix(in_srgb,var(--status-success)_25%,transparent)]",
  error:
    "bg-[color-mix(in_srgb,var(--destructive)_12%,transparent)] text-[color:var(--destructive)] border-[color-mix(in_srgb,var(--destructive)_25%,transparent)]",
  warning:
    "bg-[color-mix(in_srgb,var(--status-warning)_12%,transparent)] text-[color:var(--status-warning)] border-[color-mix(in_srgb,var(--status-warning)_25%,transparent)]",
  info: "bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[color:var(--primary)] border-[color-mix(in_srgb,var(--primary)_25%,transparent)]",
  neutral: "bg-[var(--surface-4)] text-muted-foreground border-[var(--border)]",
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
              ? "text-foreground bg-[var(--surface-5)]"
              : "text-muted-foreground hover:text-foreground bg-[var(--surface-3)]"
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
    <div className="border-b border-[color-mix(in_srgb,var(--destructive)_25%,transparent)] bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] px-3 py-2 font-mono text-[11px] text-[color:var(--destructive)]">
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
      <pre className="text-foreground/80 rounded bg-[var(--surface-4)] px-2 py-1 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap">
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
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left transition-colors duration-150 hover:bg-[var(--surface-4)]"
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
    <div
      className={cn(
        "w-full min-w-0 overflow-hidden rounded-lg border bg-[var(--surface-3)]",
        className
      )}
    >
      <div className="flex min-h-0 items-center gap-2 border-b bg-[var(--surface-3)] px-3 py-2">
        {header}
      </div>
      <div className="bg-[var(--surface-3)]">{children}</div>
      {footer && <div className="bg-[var(--surface-3)]">{footer}</div>}
    </div>
  )
}
