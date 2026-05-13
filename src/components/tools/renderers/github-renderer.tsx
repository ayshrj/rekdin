"use client"

import { useState } from "react"

import {
  EmptyState,
  RawPayloadDisclosure,
  RendererTab,
  RendererTabBar,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { getNumber, getResult, getString, pickArray, stableKey } from "./renderer-utils"
import { SimpleCodeEditor } from "./simple-code-editor"
import { type ToolResultContentPart } from "./tool-result-renderer"

export function GithubRenderer({ part }: { part: ToolResultContentPart }) {
  const result = getResult(part)
  const isActionLogs = part.type === "github_action_logs_analyze"
  const [tab, setTab] = useState<"summary" | "files" | "commits" | "logs" | "raw">(
    isActionLogs ? "logs" : "summary"
  )
  const files = pickArray(result, ["files", "changedFiles", "items"])
  const commits = pickArray(result, ["commits"])
  const errors = pickArray(result, ["errors", "failures", "findings"])
  const log = getString(result.log ?? result.output ?? result.excerpt)
  const title = getString(
    result.title ?? result.prTitle ?? result.issueTitle ?? result.workflow ?? part.toolName
  )

  return (
    <ToolRendererShell
      className="border-tool-research/25"
      header={
        <>
          <span className="text-foreground min-w-0 flex-1 truncate font-mono text-[11px] font-semibold">
            {getString(part.toolName ?? part.type, "github")}
          </span>
          {title ? (
            <span className="text-muted-foreground min-w-0 truncate font-mono text-[10px]">
              {title}
            </span>
          ) : null}
          {files.length ? (
            <ToolStatusBadge variant="neutral">{files.length} files</ToolStatusBadge>
          ) : null}
          {commits.length ? (
            <ToolStatusBadge variant="neutral">{commits.length} commits</ToolStatusBadge>
          ) : null}
          {errors.length ? (
            <ToolStatusBadge variant="error">{errors.length} errors</ToolStatusBadge>
          ) : null}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      <RendererTabBar>
        {!isActionLogs ? (
          <RendererTab active={tab === "summary"} onClick={() => setTab("summary")}>
            Summary
          </RendererTab>
        ) : null}
        {!isActionLogs && files.length ? (
          <RendererTab active={tab === "files"} onClick={() => setTab("files")}>
            Files
          </RendererTab>
        ) : null}
        {!isActionLogs && commits.length ? (
          <RendererTab active={tab === "commits"} onClick={() => setTab("commits")}>
            Commits
          </RendererTab>
        ) : null}
        {isActionLogs || log ? (
          <RendererTab active={tab === "logs"} onClick={() => setTab("logs")}>
            Logs
          </RendererTab>
        ) : null}
        <RendererTab active={tab === "raw"} onClick={() => setTab("raw")}>
          Raw
        </RendererTab>
      </RendererTabBar>
      {tab === "summary" ? (
        <div className="space-y-2 px-3 py-2">
          <div className="text-foreground/85 text-[11px] leading-relaxed">
            {getString(result.summary ?? result.description ?? result.body, "No summary returned")}
          </div>
          {getString(result.risk ?? result.riskLevel) ? (
            <ToolStatusBadge variant="warning">
              risk: {getString(result.risk ?? result.riskLevel)}
            </ToolStatusBadge>
          ) : null}
        </div>
      ) : tab === "files" ? (
        files.length === 0 ? (
          <EmptyState>No files returned</EmptyState>
        ) : (
          <div className="max-h-[44vh] divide-y overflow-auto">
            {files.map((file, index) => (
              <div
                key={stableKey(index, file.path)}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-1.5 font-mono text-[11px]"
              >
                <span className="rk-path-chip min-w-0 truncate">
                  {getString(file.path ?? file.file ?? file.filename)}
                </span>
                <span className="text-status-success">
                  +{getNumber(file.additions ?? file.added)}
                </span>
                <span className="text-destructive">
                  -{getNumber(file.deletions ?? file.removed)}
                </span>
                <span className="text-muted-foreground">{getString(file.risk ?? file.status)}</span>
              </div>
            ))}
          </div>
        )
      ) : tab === "commits" ? (
        commits.length === 0 ? (
          <EmptyState>No commits returned</EmptyState>
        ) : (
          <div className="divide-y">
            {commits.map((commit, index) => (
              <div
                key={stableKey(index, commit.sha)}
                className="grid grid-cols-[5rem_1fr_auto] gap-2 px-3 py-1.5 font-mono text-[11px]"
              >
                <span className="text-muted-foreground">
                  {getString(commit.sha ?? commit.hash).slice(0, 7)}
                </span>
                <span className="text-foreground/85 min-w-0 truncate">
                  {getString(commit.message ?? commit.title)}
                </span>
                <span className="text-muted-foreground">{getString(commit.author)}</span>
              </div>
            ))}
          </div>
        )
      ) : tab === "logs" ? (
        log ? (
          <div className="p-3">
            <SimpleCodeEditor
              code={log}
              language="log"
              fileName="actions.log"
              maxHeight="44vh"
              fontSize={11}
            />
          </div>
        ) : (
          <EmptyState>No log excerpt returned</EmptyState>
        )
      ) : (
        <RawPayloadDisclosure payload={result} defaultOpen />
      )}
    </ToolRendererShell>
  )
}
