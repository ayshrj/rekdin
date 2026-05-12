"use client"

import {
  EmptyState,
  ErrorBanner,
  RawPayloadDisclosure,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

function statusVariant(s: string | undefined) {
  if (!s) return "neutral" as const
  if (s === "success") return "success" as const
  if (s === "error" || s === "failed") return "error" as const
  return "neutral" as const
}

// ── GitCommitRenderer ─────────────────────────────────────────────────────────

export function GitCommitRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined

  const error = result?.error ? String(result.error) : undefined
  if (error) {
    return (
      <ToolRendererShell
        header={
          <span className="text-foreground font-mono text-[11px] font-semibold">Git Commit</span>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        <ErrorBanner>{error}</ErrorBanner>
      </ToolRendererShell>
    )
  }

  const hash = result?.hash ? String(result.hash) : undefined
  const shortHash = hash ? hash.slice(0, 7) : undefined
  const message = result?.message ? String(result.message) : undefined
  const author = result?.author ? String(result.author) : undefined
  const filesChanged = typeof result?.filesChanged === "number" ? result.filesChanged : undefined
  const insertions = typeof result?.insertions === "number" ? result.insertions : undefined
  const deletions = typeof result?.deletions === "number" ? result.deletions : undefined
  const files = Array.isArray(result?.files) ? (result.files as string[]) : []

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Git Commit</span>
          {shortHash && <span className="rk-path-chip shrink-0">{shortHash}</span>}
          <ToolStatusBadge variant="success">committed</ToolStatusBadge>
          {filesChanged != null && (
            <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
              {filesChanged} files
            </span>
          )}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      <div className="divide-y">
        {message && (
          <div className="px-3 py-2">
            <p className="text-foreground/90 font-mono text-[11px] leading-relaxed">{message}</p>
          </div>
        )}
        {author && (
          <div className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
            <span className="text-muted-foreground w-16 shrink-0 font-mono text-[10px]">
              author
            </span>
            <span className="text-foreground/70 font-mono text-[11px]">{author}</span>
          </div>
        )}
        {(insertions != null || deletions != null) && (
          <div className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
            <span className="text-muted-foreground w-16 shrink-0 font-mono text-[10px]">
              changes
            </span>
            {insertions != null && (
              <span className="text-status-success font-mono text-[10px]">+{insertions}</span>
            )}
            {deletions != null && (
              <span className="text-destructive font-mono text-[10px]">-{deletions}</span>
            )}
          </div>
        )}
        {files.length > 0 && (
          <>
            <div className="px-3 py-1.5">
              <span className="rk-section-label">Files</span>
            </div>
            {files.map((f, i) => (
              <div key={i} className="hover:bg-surface-4 px-3 py-1">
                <span className="text-foreground/70 font-mono text-[10px]">{f}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </ToolRendererShell>
  )
}

// ── GitCheckoutRenderer ───────────────────────────────────────────────────────

export function GitCheckoutRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined

  const error = result?.error ? String(result.error) : undefined
  if (error) {
    return (
      <ToolRendererShell
        header={
          <span className="text-foreground font-mono text-[11px] font-semibold">Git Checkout</span>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        <ErrorBanner>{error}</ErrorBanner>
      </ToolRendererShell>
    )
  }

  const branch = result?.branch ? String(result.branch) : undefined
  const created = result?.created === true
  const status = result?.status ? String(result.status) : undefined

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Git Checkout</span>
          {branch && <span className="rk-path-chip max-w-40 min-w-0 truncate">{branch}</span>}
          <ToolStatusBadge variant="success">{created ? "created" : "switched"}</ToolStatusBadge>
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {status ? (
        <div className="px-3 py-2">
          <p className="text-foreground/70 font-mono text-[11px] leading-relaxed">{status}</p>
        </div>
      ) : (
        <EmptyState>
          {created ? `Created and switched to ${branch}` : `Switched to ${branch}`}
        </EmptyState>
      )}
    </ToolRendererShell>
  )
}

// ── GitStashRenderer ──────────────────────────────────────────────────────────

export function GitStashRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined

  const error = result?.error ? String(result.error) : undefined
  if (error) {
    return (
      <ToolRendererShell
        header={
          <span className="text-foreground font-mono text-[11px] font-semibold">Git Stash</span>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        <ErrorBanner>{error}</ErrorBanner>
      </ToolRendererShell>
    )
  }

  const action = result?.action ? String(result.action) : "push"
  const stashName = result?.stashName ? String(result.stashName) : undefined
  const filesStashed = typeof result?.filesStashed === "number" ? result.filesStashed : undefined
  const entries = Array.isArray(result?.entries) ? (result.entries as string[]) : []
  const output = result?.output ? String(result.output) : undefined

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Git Stash</span>
          <span className="rk-path-chip shrink-0">{action}</span>
          {stashName && <span className="rk-path-chip max-w-32 min-w-0 truncate">{stashName}</span>}
          {filesStashed != null && (
            <span className="text-muted-foreground font-mono text-[10px]">
              {filesStashed} files
            </span>
          )}
          <ToolStatusBadge variant="success">ok</ToolStatusBadge>
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {entries.length > 0 ? (
        <div className="rk-scrollbar max-h-[40vh] divide-y overflow-auto">
          {entries.map((e, i) => (
            <div key={i} className="hover:bg-surface-4 px-3 py-1.5">
              <span className="text-foreground/70 font-mono text-[11px]">{e}</span>
            </div>
          ))}
        </div>
      ) : output ? (
        <div className="px-3 py-2">
          <p className="text-foreground/70 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
            {output}
          </p>
        </div>
      ) : (
        <EmptyState>
          {action === "push" ? "Stash saved" : action === "pop" ? "Stash applied" : "Done"}
        </EmptyState>
      )}
    </ToolRendererShell>
  )
}

// ── GitPushRenderer ───────────────────────────────────────────────────────────

export function GitPushRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined

  const error = result?.error ? String(result.error) : undefined
  if (error) {
    return (
      <ToolRendererShell
        header={
          <span className="text-foreground font-mono text-[11px] font-semibold">Git Push</span>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        <ErrorBanner>{error}</ErrorBanner>
      </ToolRendererShell>
    )
  }

  const remote = result?.remote ? String(result.remote) : "origin"
  const branch = result?.branch ? String(result.branch) : undefined
  const commitRange = result?.commitRange ? String(result.commitRange) : undefined
  const status = result?.status ? String(result.status) : undefined

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Git Push</span>
          <span className="rk-path-chip shrink-0">{remote}</span>
          {branch && <span className="rk-path-chip max-w-32 min-w-0 truncate">{branch}</span>}
          <ToolStatusBadge variant={statusVariant(result?.status as string)}>
            pushed
          </ToolStatusBadge>
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      <div className="divide-y">
        {commitRange && (
          <div className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
            <span className="text-muted-foreground w-16 shrink-0 font-mono text-[10px]">
              commits
            </span>
            <span className="text-foreground/80 font-mono text-[11px]">{commitRange}</span>
          </div>
        )}
        {status && (
          <div className="px-3 py-2">
            <p className="text-foreground/70 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
              {status}
            </p>
          </div>
        )}
      </div>
    </ToolRendererShell>
  )
}
