"use client"

import {
  EmptyState,
  ErrorBanner,
  RawPayloadDisclosure,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

export function GitConflictsRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined

  let files: string[] = []
  if (Array.isArray(result?.files)) {
    files = (result.files as unknown[]).map(String).filter(Boolean)
  } else if (Array.isArray(result?.conflicts)) {
    files = (result.conflicts as unknown[]).map(String).filter(Boolean)
  } else if (typeof result?.output === "string") {
    files = result.output
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
  }

  const hasConflicts = files.length > 0

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Git Conflicts</span>
          {hasConflicts ? (
            <ToolStatusBadge variant="error">
              {files.length} conflict{files.length !== 1 ? "s" : ""}
            </ToolStatusBadge>
          ) : (
            <ToolStatusBadge variant="success">no conflicts</ToolStatusBadge>
          )}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {hasConflicts && (
        <ErrorBanner>Merge conflicts detected — resolve before committing.</ErrorBanner>
      )}
      {!hasConflicts ? (
        <EmptyState>No conflicts found</EmptyState>
      ) : (
        <div className="max-h-[40vh] divide-y overflow-auto">
          {files.map((f, i) => (
            <div key={i} className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
              <span className="text-destructive shrink-0 font-mono text-[10px] font-semibold uppercase">
                conflict
              </span>
              <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
                {f}
              </span>
            </div>
          ))}
        </div>
      )}
    </ToolRendererShell>
  )
}
