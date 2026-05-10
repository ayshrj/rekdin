"use client"

import {
  CopyButton,
  EmptyState,
  RawPayloadDisclosure,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

interface TagEntry {
  name: string
  hash?: string
  date?: string
  message?: string
}

function parseTags(output: string): TagEntry[] {
  return output
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/)
      const name = parts[0]
      const maybeHash = parts[1]
      const hash =
        maybeHash && (maybeHash.length === 7 || maybeHash.length === 40) ? maybeHash : undefined
      const dateIdx = hash ? 2 : 1
      const dateCandidate = parts[dateIdx]
      const date =
        dateCandidate && /^\d{4}-\d{2}-\d{2}/.test(dateCandidate) ? dateCandidate : undefined
      const msgStart = date ? dateIdx + 1 : hash ? 2 : 1
      const message = parts.slice(msgStart).join(" ") || undefined
      return { name, hash, date, message }
    })
}

interface RemoteEntry {
  name: string
  fetchUrl?: string
  pushUrl?: string
}

function parseRemotes(output: string): RemoteEntry[] {
  const map = new Map<string, RemoteEntry>()
  for (const line of output
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)) {
    const m = line.match(/^(\S+)\s+(\S+)\s+\((\w+)\)$/)
    if (!m) continue
    const [, name, url, type] = m
    const entry = map.get(name) ?? { name }
    if (type === "fetch") entry.fetchUrl = url
    if (type === "push") entry.pushUrl = url
    map.set(name, entry)
  }
  return Array.from(map.values())
}

export function GitTagsRenderer({ part }: { part: ToolResultContentPart }) {
  const type = part.type
  const result = part.toolResult as Record<string, unknown> | undefined
  const output = (result?.output ?? "") as string

  // ── git_remote_info ───────────────────────────────────────────────────────
  if (type === "git_remote_info") {
    const remotes = Array.isArray(result?.remotes)
      ? (result.remotes as RemoteEntry[])
      : parseRemotes(output)

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">Remote Info</span>
            <ToolStatusBadge variant="neutral">
              {remotes.length} remote{remotes.length !== 1 ? "s" : ""}
            </ToolStatusBadge>
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {remotes.length === 0 ? (
          <EmptyState>No remotes configured</EmptyState>
        ) : (
          <div className="divide-y">
            {remotes.map((r, i) => (
              <div key={i} className="px-3 py-2">
                <div className="mb-1">
                  <span className="text-foreground font-mono text-[11px] font-semibold">
                    {r.name}
                  </span>
                </div>
                {r.fetchUrl && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-10 shrink-0 font-mono text-[10px]">
                      fetch
                    </span>
                    <span className="text-foreground/70 min-w-0 flex-1 truncate font-mono text-[11px]">
                      {r.fetchUrl}
                    </span>
                    <CopyButton text={r.fetchUrl} />
                  </div>
                )}
                {r.pushUrl && r.pushUrl !== r.fetchUrl && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-10 shrink-0 font-mono text-[10px]">
                      push
                    </span>
                    <span className="text-foreground/70 min-w-0 flex-1 truncate font-mono text-[11px]">
                      {r.pushUrl}
                    </span>
                    <CopyButton text={r.pushUrl} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ToolRendererShell>
    )
  }

  // ── git_tags ──────────────────────────────────────────────────────────────
  const tags = Array.isArray(result?.tags) ? (result.tags as TagEntry[]) : parseTags(output)

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Git Tags</span>
          <ToolStatusBadge variant="neutral">
            {tags.length} tag{tags.length !== 1 ? "s" : ""}
          </ToolStatusBadge>
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {tags.length === 0 ? (
        <EmptyState>No tags found</EmptyState>
      ) : (
        <div className="max-h-[40vh] divide-y overflow-auto">
          {tags.map((tag, i) => (
            <div key={i} className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
              <span className="text-foreground/90 min-w-0 flex-1 truncate font-mono text-[11px] font-medium">
                {tag.name}
              </span>
              {tag.hash && (
                <span className="shrink-0 rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] text-amber-600">
                  {tag.hash.slice(0, 7)}
                </span>
              )}
              {tag.date && (
                <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                  {tag.date}
                </span>
              )}
              {tag.message && (
                <span className="text-foreground/50 max-w-50 min-w-0 truncate font-mono text-[10px]">
                  {tag.message}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </ToolRendererShell>
  )
}
