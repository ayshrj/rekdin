"use client"

import { parsePatch } from "diff"
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

const STATUS_META: Record<string, { label: string; color: string }> = {
  M: { label: "modified", color: "text-amber-500" },
  A: { label: "added", color: "text-emerald-500" },
  D: { label: "deleted", color: "text-destructive" },
  R: { label: "renamed", color: "text-blue-500" },
  C: { label: "copied", color: "text-blue-400" },
  U: { label: "unmerged", color: "text-orange-500" },
  "?": { label: "untracked", color: "text-muted-foreground" },
  "!": { label: "ignored", color: "text-muted-foreground/50" },
}

interface ParsedFile {
  stagedCode: string
  unstagedCode: string
  path: string
  origPath?: string
}

function parseStatusOutput(output: string): { branch: string; files: ParsedFile[] } {
  const lines = output
    .split("\n")
    .map((l) => l.trimEnd())
    .filter(Boolean)
  let branch = ""
  const files: ParsedFile[] = []

  for (const line of lines) {
    if (line.startsWith("##")) {
      const m = line.match(/^##\s+([^\s.]+)/)
      if (m) branch = m[1]
      continue
    }
    if (line.length >= 2) {
      const x = line[0]
      const y = line[1]
      const rest = line.slice(3)
      const arrowIdx = rest.indexOf(" -> ")
      const path = arrowIdx >= 0 ? rest.slice(arrowIdx + 4) : rest
      const origPath = arrowIdx >= 0 ? rest.slice(0, arrowIdx) : undefined
      files.push({ stagedCode: x, unstagedCode: y, path, origPath })
    }
  }
  return { branch, files }
}

function FileRow({ file }: { file: ParsedFile }) {
  const isUntracked = file.stagedCode === "?" && file.unstagedCode === "?"
  const stagedMeta = STATUS_META[file.stagedCode] ?? {
    label: file.stagedCode,
    color: "text-muted-foreground",
  }
  const unstagedMeta = STATUS_META[file.unstagedCode] ?? {
    label: file.unstagedCode,
    color: "text-muted-foreground",
  }

  return (
    <div className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
      <div className="flex shrink-0 gap-1">
        {isUntracked ? (
          <span className="text-muted-foreground w-10 font-mono text-[10px]">??</span>
        ) : (
          <>
            <span
              className={`w-4 text-center font-mono text-[10px] font-semibold ${stagedMeta.color}`}
              title={`staged: ${stagedMeta.label}`}
            >
              {file.stagedCode === " " ? "·" : file.stagedCode}
            </span>
            <span
              className={`w-4 text-center font-mono text-[10px] font-semibold ${unstagedMeta.color}`}
              title={`unstaged: ${unstagedMeta.label}`}
            >
              {file.unstagedCode === " " ? "·" : file.unstagedCode}
            </span>
          </>
        )}
      </div>
      <FileExtensionIcon extensionName={file.path} className="h-3.5 w-3.5 shrink-0" />
      <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
        {file.origPath ? (
          <>
            {file.origPath} <span className="text-muted-foreground">→</span> {file.path}
          </>
        ) : (
          file.path
        )}
      </span>
    </div>
  )
}

function StagedDiffBody({ diff }: { diff: string }) {
  const parsed = (() => {
    try {
      return parsePatch(diff)
    } catch {
      return []
    }
  })()

  if (!diff) return <EmptyState>No staged changes</EmptyState>

  if (parsed.length === 0) {
    return (
      <pre className="text-foreground/70 max-h-[50vh] overflow-auto px-3 py-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
        {diff}
      </pre>
    )
  }

  return (
    <div className="max-h-[55vh] divide-y overflow-auto">
      {parsed.map((file, i) => {
        const name =
          file.newFileName?.replace(/^b\//, "") ?? file.oldFileName?.replace(/^a\//, "") ?? ""
        return (
          <div key={i}>
            <div className="bg-surface-4 text-foreground/70 px-3 py-1.5 font-mono text-[11px] font-medium">
              {name}
            </div>
            {file.hunks.map((hunk, hi) => (
              <div key={hi}>
                <div className="bg-blue-500/5 px-3 py-0.5 font-mono text-[10px] text-blue-500/70">
                  @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                </div>
                {hunk.lines.map((line, li) => {
                  const isAdd = line.startsWith("+")
                  const isRemove = line.startsWith("-")
                  return (
                    <div
                      key={li}
                      className={isAdd ? "bg-emerald-500/10" : isRemove ? "bg-destructive/10" : ""}
                    >
                      <pre
                        className={`px-3 py-px font-mono text-[11px] leading-relaxed whitespace-pre ${
                          isAdd
                            ? "text-emerald-700 dark:text-emerald-400"
                            : isRemove
                              ? "text-destructive"
                              : "text-foreground/60"
                        }`}
                      >
                        {line}
                      </pre>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

export function GitStatusRenderer({ part }: { part: ToolResultContentPart }) {
  const type = part.type
  const result = part.toolResult as Record<string, unknown> | undefined
  const [tab, setTab] = useState<"all" | "staged" | "unstaged">("all")

  // ── git_staged_diff ───────────────────────────────────────────────────────
  if (type === "git_staged_diff") {
    const diff = (result?.diff ?? result?.output ?? "") as string
    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">Staged Diff</span>
            <ToolStatusBadge variant={diff ? "info" : "neutral"}>
              {diff ? "has changes" : "empty"}
            </ToolStatusBadge>
            {diff && <CopyButton text={diff} className="ml-auto" />}
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        <StagedDiffBody diff={diff} />
      </ToolRendererShell>
    )
  }

  // ── git_changed_files ────────────────────────────────────────────────────
  if (type === "git_changed_files") {
    const raw = (result?.output ?? result?.files ?? "") as string | string[]
    const files = Array.isArray(raw)
      ? raw.map(String).filter(Boolean)
      : raw
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">
              Changed Files
            </span>
            <ToolStatusBadge variant="neutral">
              {files.length} file{files.length !== 1 ? "s" : ""}
            </ToolStatusBadge>
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {files.length === 0 ? (
          <EmptyState>No changed files</EmptyState>
        ) : (
          <div className="max-h-[40vh] divide-y overflow-auto">
            {files.map((f, i) => (
              <div key={i} className="hover:bg-surface-4 px-3 py-1.5">
                <span className="text-foreground/80 font-mono text-[11px]">{f}</span>
              </div>
            ))}
          </div>
        )}
      </ToolRendererShell>
    )
  }

  // ── git_status ────────────────────────────────────────────────────────────
  const output = (result?.output ?? "") as string
  const { branch, files } = parseStatusOutput(output)

  const staged = files.filter((f) => f.stagedCode !== " " && f.stagedCode !== "?")
  const unstaged = files.filter(
    (f) =>
      (f.unstagedCode !== " " && f.stagedCode === " ") ||
      (f.stagedCode === "?" && f.unstagedCode === "?")
  )
  const isClean = files.length === 0
  const hasBothZones = staged.length > 0 && unstaged.length > 0

  const displayFiles = tab === "staged" ? staged : tab === "unstaged" ? unstaged : files

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Git Status</span>
          {branch && (
            <span className="text-primary rounded border border-[color-mix(in_srgb,var(--primary)_25%,transparent)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] px-1.5 py-0.5 font-mono text-[10px]">
              {branch}
            </span>
          )}
          {isClean ? (
            <ToolStatusBadge variant="success">clean</ToolStatusBadge>
          ) : (
            <ToolStatusBadge variant="warning">{files.length} changed</ToolStatusBadge>
          )}
          {!isClean && (
            <div className="ml-auto flex items-center gap-3">
              {staged.length > 0 && (
                <span className="font-mono text-[10px] text-emerald-600">
                  {staged.length} staged
                </span>
              )}
              {unstaged.length > 0 && (
                <span className="font-mono text-[10px] text-amber-500">
                  {unstaged.length} unstaged
                </span>
              )}
            </div>
          )}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {isClean ? (
        <EmptyState>Working tree clean</EmptyState>
      ) : (
        <>
          {hasBothZones && (
            <RendererTabBar>
              <RendererTab active={tab === "all"} onClick={() => setTab("all")}>
                All ({files.length})
              </RendererTab>
              <RendererTab active={tab === "staged"} onClick={() => setTab("staged")}>
                Staged ({staged.length})
              </RendererTab>
              <RendererTab active={tab === "unstaged"} onClick={() => setTab("unstaged")}>
                Unstaged ({unstaged.length})
              </RendererTab>
            </RendererTabBar>
          )}
          <div className="max-h-[40vh] divide-y overflow-auto">
            {displayFiles.map((file, i) => (
              <FileRow key={i} file={file} />
            ))}
          </div>
        </>
      )}
    </ToolRendererShell>
  )
}
