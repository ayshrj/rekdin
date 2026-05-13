"use client"

import { parsePatch } from "diff"
import { useState } from "react"

import {
  CopyButton,
  EmptyState,
  RawPayloadDisclosure,
  RendererTab,
  RendererTabBar,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { getBoolean, getNumber, getResult, getString, stringifyPayload } from "./renderer-utils"
import { SimpleCodeEditor } from "./simple-code-editor"
import { type ToolResultContentPart } from "./tool-result-renderer"

function patchText(result: Record<string, unknown>): string {
  return getString(
    result.patch ?? result.diff ?? result.unifiedDiff ?? result.preview ?? result.content
  )
}

export function PatchPreviewRenderer({ part }: { part: ToolResultContentPart }) {
  const result = getResult(part)
  const patch = patchText(result)
  const [tab, setTab] = useState<"overview" | "diff">("overview")
  const dryRun = getBoolean(result.dryRun ?? result.dry_run, false)
  const parsed = (() => {
    if (!patch) return []
    try {
      return parsePatch(patch)
    } catch {
      return []
    }
  })()

  const files = parsed.map((file) => {
    const path =
      file.newFileName?.replace(/^b\//, "") ?? file.oldFileName?.replace(/^a\//, "") ?? "unknown"
    const added = file.hunks.reduce(
      (n, h) => n + h.lines.filter((line) => line.startsWith("+")).length,
      0
    )
    const removed = file.hunks.reduce(
      (n, h) => n + h.lines.filter((line) => line.startsWith("-")).length,
      0
    )
    return { path, added, removed, total: added + removed }
  })

  const fileCount = getNumber(result.fileCount ?? result.filesChanged, files.length)
  const changeCount = files.reduce((n, file) => n + file.total, 0)
  const title = getString(
    result.summary ?? result.operation ?? result.title ?? part.toolName ?? part.type
  )

  return (
    <ToolRendererShell
      className="border-tool-code/25"
      header={
        <>
          <span className="text-foreground min-w-0 flex-1 truncate font-mono text-[11px] font-semibold">
            {getString(part.toolName ?? part.type, "patch_preview")}
          </span>
          {dryRun ? <ToolStatusBadge variant="warning">DRY RUN</ToolStatusBadge> : null}
          <ToolStatusBadge variant="neutral">{fileCount} files</ToolStatusBadge>
          <ToolStatusBadge variant="neutral">{changeCount} changes</ToolStatusBadge>
          <CopyButton text={patch || stringifyPayload(result)} />
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      <RendererTabBar>
        <RendererTab active={tab === "overview"} onClick={() => setTab("overview")}>
          Overview
        </RendererTab>
        <RendererTab active={tab === "diff"} onClick={() => setTab("diff")}>
          Diff
        </RendererTab>
      </RendererTabBar>
      {tab === "overview" ? (
        <div>
          {title ? (
            <div className="text-foreground/80 border-b px-3 py-2 font-mono text-[11px]">
              {title}
            </div>
          ) : null}
          {files.length === 0 ? (
            <EmptyState>No parseable patch files returned</EmptyState>
          ) : (
            <div className="divide-y">
              {files.map((file) => (
                <div
                  key={file.path}
                  className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-3 py-1.5 font-mono text-[11px]"
                >
                  <span className="rk-path-chip min-w-0 truncate">{file.path}</span>
                  <span className="text-status-success">+{file.added}</span>
                  <span className="text-destructive">-{file.removed}</span>
                  <span className="text-muted-foreground">{file.total} lines</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : patch ? (
        <div className="p-3">
          <SimpleCodeEditor
            code={patch}
            language="diff"
            fileName="patch.diff"
            maxHeight="48vh"
            fontSize={11}
          />
        </div>
      ) : (
        <EmptyState>No diff content returned</EmptyState>
      )}
    </ToolRendererShell>
  )
}
