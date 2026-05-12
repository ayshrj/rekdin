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
  ToolMetaRow,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

interface CommitInfo {
  hash: string
  author: string
  date: string
  message: string
  diffBody: string
}

function parseShowOutput(raw: string): CommitInfo {
  const lines = raw.split("\n")
  let hash = ""
  let author = ""
  let date = ""
  const messageLines: string[] = []
  let inMessage = false
  let bodyStart = lines.length

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith("commit ")) {
      hash = line.slice(7).trim()
    } else if (line.startsWith("Author: ")) {
      author = line.slice(8).trim()
    } else if (line.startsWith("Date:")) {
      date = line.replace(/^Date:\s*/, "").trim()
    } else if (line === "" && hash && !inMessage) {
      inMessage = true
    } else if (inMessage) {
      if (line.startsWith("diff --git") || line.startsWith("---")) {
        bodyStart = i
        break
      }
      messageLines.push(line.replace(/^ {4}/, ""))
    }
  }

  return {
    hash,
    author,
    date,
    message: messageLines.join("\n").trim(),
    diffBody: lines.slice(bodyStart).join("\n"),
  }
}

function DiffBody({ raw }: { raw: string }) {
  const parsed = (() => {
    try {
      return parsePatch(raw)
    } catch {
      return []
    }
  })()

  if (parsed.length === 0) {
    return (
      <pre className="text-foreground/70 max-h-[50vh] overflow-auto px-3 py-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
        {raw}
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
            <div className="bg-surface-4 flex items-center gap-1.5 px-3 py-1.5">
              {name && <FileExtensionIcon extensionName={name} className="h-3.5 w-3.5 shrink-0" />}
              <span className="text-foreground/70 font-mono text-[11px] font-medium">{name}</span>
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

export function GitShowRenderer({ part }: { part: ToolResultContentPart }) {
  const type = part.type
  const result = part.toolResult as Record<string, unknown> | undefined
  const [tab, setTab] = useState<"commit" | "diff">("commit")

  const output = (result?.output ?? result?.diff ?? "") as string
  const info = parseShowOutput(output)

  const parsedFiles = (() => {
    if (!info.diffBody) return []
    try {
      return parsePatch(info.diffBody)
    } catch {
      return []
    }
  })()

  const totalAdded = parsedFiles.reduce(
    (n, f) => n + f.hunks.reduce((m, h) => m + h.lines.filter((l) => l.startsWith("+")).length, 0),
    0
  )
  const totalRemoved = parsedFiles.reduce(
    (n, f) => n + f.hunks.reduce((m, h) => m + h.lines.filter((l) => l.startsWith("-")).length, 0),
    0
  )

  const hasCommit = Boolean(info.hash || info.author)
  const hasDiff = parsedFiles.length > 0 || Boolean(info.diffBody)
  const isCompare = type === "git_compare_refs"
  const title = isCompare ? "Compare Refs" : "Git Show"

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">{title}</span>
          {info.hash && (
            <span className="rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-amber-600">
              {info.hash.slice(0, 7)}
            </span>
          )}
          {parsedFiles.length > 0 && (
            <>
              <ToolStatusBadge variant="neutral">
                {parsedFiles.length} file{parsedFiles.length !== 1 ? "s" : ""}
              </ToolStatusBadge>
              <span className="font-mono text-[10px] text-emerald-600">+{totalAdded}</span>
              <span className="text-destructive font-mono text-[10px]">−{totalRemoved}</span>
            </>
          )}
          {output && <CopyButton text={output} className="ml-auto" />}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {!output ? (
        <EmptyState>No output</EmptyState>
      ) : (
        <>
          {hasCommit && hasDiff && (
            <RendererTabBar>
              <RendererTab active={tab === "commit"} onClick={() => setTab("commit")}>
                Commit
              </RendererTab>
              <RendererTab active={tab === "diff"} onClick={() => setTab("diff")}>
                Diff ({parsedFiles.length})
              </RendererTab>
            </RendererTabBar>
          )}

          {(tab === "commit" || !hasDiff) && hasCommit && (
            <div className="divide-y">
              {info.hash && (
                <ToolMetaRow label="hash" mono>
                  {info.hash}
                </ToolMetaRow>
              )}
              {info.author && (
                <ToolMetaRow label="author" mono>
                  {info.author}
                </ToolMetaRow>
              )}
              {info.date && (
                <ToolMetaRow label="date" mono>
                  {info.date}
                </ToolMetaRow>
              )}
              {info.message && (
                <div className="px-3 py-2">
                  <span className="rk-section-label mb-1 block">message</span>
                  <pre className="text-foreground/80 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                    {info.message}
                  </pre>
                </div>
              )}
            </div>
          )}

          {(tab === "diff" || !hasCommit) && hasDiff && <DiffBody raw={info.diffBody || output} />}
        </>
      )}
    </ToolRendererShell>
  )
}
