"use client"

import { parsePatch } from "diff"

import { FileExtensionIcon } from "@/components/file-extension-icon"

import {
  CopyButton,
  EmptyState,
  ExitCodeBadge,
  RawPayloadDisclosure,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

interface CommitResult {
  hash: string
  author?: string
  date?: string
  message: string
}

function parseCommitResults(output: string): CommitResult[] {
  if (!output.trim()) return []
  const lines = output
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)

  // Detailed format: lines start with "commit <hash>"
  if (lines.some((l) => l.startsWith("commit "))) {
    const results: CommitResult[] = []
    let current: Partial<CommitResult> | null = null
    for (const line of lines) {
      if (line.startsWith("commit ")) {
        if (current?.hash) results.push(current as CommitResult)
        current = { hash: line.slice(7).trim(), message: "" }
      } else if (current && line.startsWith("Author: ")) {
        current.author = line.slice(8).trim()
      } else if (current && line.startsWith("Date:")) {
        current.date = line.replace(/^Date:\s*/, "").trim()
      } else if (current && line && !current.message) {
        current.message = line
      }
    }
    if (current?.hash) results.push(current as CommitResult)
    return results
  }

  // One-liner: "abc1234 message text"
  return lines
    .map((line) => ({ hash: line.slice(0, 7), message: line.slice(8).trim() }))
    .filter((c) => c.hash.trim().length > 0)
}

export function GitCommitSearchRenderer({ part }: { part: ToolResultContentPart }) {
  const type = part.type
  const result = part.toolResult as Record<string, unknown> | undefined

  // ── git_apply_patch ───────────────────────────────────────────────────────
  if (type === "git_apply_patch") {
    const rawExitCode = result?.exitCode
    const exitCode =
      typeof rawExitCode === "number" ? rawExitCode : result?.success === true ? 0 : 1
    const success = exitCode === 0 || result?.success === true
    const output = (result?.output ?? result?.message ?? "") as string

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">Apply Patch</span>
            <ToolStatusBadge variant={success ? "success" : "error"}>
              {success ? "applied" : "failed"}
            </ToolStatusBadge>
            {typeof exitCode === "number" && <ExitCodeBadge code={exitCode} />}
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {output ? (
          <pre className="text-foreground/70 max-h-[30vh] overflow-auto px-3 py-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
            {output}
          </pre>
        ) : (
          <EmptyState>{success ? "Patch applied successfully" : "Patch failed"}</EmptyState>
        )}
      </ToolRendererShell>
    )
  }

  // ── git_patch_preview ─────────────────────────────────────────────────────
  if (type === "git_patch_preview") {
    const patch = (result?.patch ?? result?.output ?? result?.diff ?? "") as string
    const filePath = (result?.path ?? result?.file ?? "") as string
    const parsed = (() => {
      try {
        return parsePatch(patch)
      } catch {
        return []
      }
    })()

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">
              Patch Preview
            </span>
            {filePath && <span className="rk-path-chip max-w-50 min-w-0 truncate">{filePath}</span>}
            {parsed.length > 0 && (
              <ToolStatusBadge variant="neutral">
                {parsed.length} file{parsed.length !== 1 ? "s" : ""}
              </ToolStatusBadge>
            )}
            {patch && <CopyButton text={patch} className="ml-auto" />}
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {!patch ? (
          <EmptyState>No patch content</EmptyState>
        ) : parsed.length > 0 ? (
          <div className="max-h-[50vh] divide-y overflow-auto">
            {parsed.map((file, i) => {
              const name =
                file.newFileName?.replace(/^b\//, "") ?? file.oldFileName?.replace(/^a\//, "") ?? ""
              return (
                <div key={i}>
                  <div className="bg-surface-4 flex items-center gap-1.5 px-3 py-1.5">
                    {name && (
                      <FileExtensionIcon extensionName={name} className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="text-foreground/70 font-mono text-[11px] font-medium">
                      {name}
                    </span>
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
                            className={
                              isAdd ? "bg-emerald-500/10" : isRemove ? "bg-destructive/10" : ""
                            }
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
        ) : (
          <pre className="text-foreground/70 max-h-[50vh] overflow-auto px-3 py-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
            {patch}
          </pre>
        )}
      </ToolRendererShell>
    )
  }

  // ── git_commit_search ─────────────────────────────────────────────────────
  const output = (result?.output ?? "") as string
  const query = (result?.query ?? result?.search ?? part.toolInput?.query ?? "") as string
  const commits = parseCommitResults(output)

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Commit Search</span>
          {query && (
            <span className="text-primary rounded border border-[color-mix(in_srgb,var(--primary)_25%,transparent)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] px-1.5 py-0.5 font-mono text-[10px]">
              {query}
            </span>
          )}
          <ToolStatusBadge variant="neutral">
            {commits.length} result{commits.length !== 1 ? "s" : ""}
          </ToolStatusBadge>
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {commits.length === 0 ? (
        <EmptyState>No commits matched</EmptyState>
      ) : (
        <div className="max-h-[40vh] divide-y overflow-auto">
          {commits.map((c, i) => (
            <div key={i} className="hover:bg-surface-4 flex items-start gap-2.5 px-3 py-2">
              <span className="mt-0.5 shrink-0 rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-amber-600">
                {c.hash.slice(0, 7)}
              </span>
              <div className="min-w-0 flex-1">
                <span className="text-foreground/80 block min-w-0 truncate text-xs leading-relaxed">
                  {c.message}
                </span>
                {(c.author || c.date) && (
                  <span className="text-muted-foreground mt-0.5 block font-mono text-[10px]">
                    {[c.author, c.date].filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </ToolRendererShell>
  )
}
