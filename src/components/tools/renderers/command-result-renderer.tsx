"use client"

import React from "react"

import { cn } from "@/lib/utils"

import {
  CopyButton,
  EmptyState,
  ExitCodeBadge,
  RawPayloadDisclosure,
  ToolRendererShell,
} from "./renderer-primitives"
import { ToolResultContentPart } from "./tool-result-renderer"

// ─── Command tokenizer ───────────────────────────────────────────────────────
// Colours the command line inline: verb, flags, paths, strings, operators.

function TokenizedCommand({ command }: { command: string }) {
  const patterns: { re: RegExp; cls: string }[] = [
    { re: /^\$\w+|\$\{\w+\}/, cls: "text-[color:var(--tool-command)] opacity-70" },
    { re: /^(["'])(?:(?=(\\?))\2.)*?\1/, cls: "text-foreground/60" },
    { re: /^(?:\/|\.\.?\/|~\/)[\w./\\_-]*/, cls: "text-foreground/70" },
    { re: /^-{1,2}[\w-]+/, cls: "text-muted-foreground" },
    {
      re: /^(?:>|>>|<|<<|2>|2>>|&>)(?=\s|$)/,
      cls: "text-[color:var(--tool-command)] font-semibold",
    },
    { re: /^(?:\|{1,2}|;|&&)(?=\s|$)/, cls: "text-destructive/70 font-semibold" },
  ]

  const nodes: React.ReactNode[] = []
  let remaining = command
  let key = 0
  let firstToken = true

  while (remaining.length) {
    if (firstToken) {
      const m = remaining.match(/^[\w.-]+/)
      if (m) {
        nodes.push(
          <span key={key++} className="font-semibold text-[color:var(--tool-command)]">
            {m[0]}
          </span>
        )
        remaining = remaining.slice(m[0].length)
        firstToken = false
        continue
      }
    }
    let matched = false
    for (const { re, cls } of patterns) {
      const m = remaining.match(re)
      if (m) {
        nodes.push(
          <span key={key++} className={cls}>
            {m[0]}
          </span>
        )
        remaining = remaining.slice(m[0].length)
        if (remaining.startsWith(" ")) firstToken = false
        matched = true
        break
      }
    }
    if (!matched) {
      if (remaining[0] === "\n") firstToken = true
      nodes.push(
        <span key={key++} className="text-foreground/70">
          {remaining[0]}
        </span>
      )
      remaining = remaining.slice(1)
    }
  }
  return <>{nodes}</>
}

// ─── Stream pane ─────────────────────────────────────────────────────────────

function StreamPane({ label, content, isErr }: { label: string; content: string; isErr: boolean }) {
  return (
    <div
      className={isErr ? "bg-[color-mix(in_srgb,var(--destructive)_5%,transparent)]" : undefined}
    >
      <div
        className={cn(
          "flex items-center justify-between border-b border-dashed px-3 py-1",
          isErr
            ? "border-[color-mix(in_srgb,var(--destructive)_20%,transparent)]"
            : "border-[var(--border)]"
        )}
      >
        <span className={cn("rk-section-label", isErr && "text-[color:var(--destructive)]/60")}>
          {label}
        </span>
        <CopyButton text={content} />
      </div>
      <pre
        className={cn(
          "rk-scrollbar max-h-[55vh] overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed wrap-anywhere whitespace-pre-wrap",
          isErr ? "text-[color:var(--destructive)]" : "text-foreground/80"
        )}
      >
        {content}
      </pre>
    </div>
  )
}

// ─── CommandResultRenderer ───────────────────────────────────────────────────

export const CommandResultRenderer: React.FC<{
  part: ToolResultContentPart
  onAction?: (action: string, data: unknown) => void
}> = ({ part }) => {
  const command: string =
    typeof part.command === "string"
      ? part.command
      : typeof part.toolInput?.command === "string"
        ? part.toolInput.command
        : ""
  const cwd: string =
    typeof part.cwd === "string"
      ? part.cwd
      : typeof part.toolInput?.cwd === "string"
        ? part.toolInput.cwd
        : typeof part.toolResult?.cwd === "string"
          ? part.toolResult.cwd
          : ""
  const stdout: string =
    typeof part.stdout === "string"
      ? part.stdout
      : typeof part.toolResult?.stdout === "string"
        ? part.toolResult.stdout
        : typeof part.toolResult?.output === "string"
          ? part.toolResult.output
          : ""
  const stderr: string =
    typeof part.stderr === "string"
      ? part.stderr
      : typeof part.toolResult?.stderr === "string"
        ? part.toolResult.stderr
        : typeof part.toolResult?.error === "string"
          ? part.toolResult.error
          : ""
  const exitCode = part.exitCode ?? part.toolResult?.exitCode ?? part.toolResult?.exit_code
  const duration: number | undefined = part.toolResult?.duration

  if (!command && !stdout && !stderr) {
    return <EmptyState>Command result is empty</EmptyState>
  }

  return (
    <ToolRendererShell
      header={
        <>
          {/* Terminal dots — identity marker for shell context */}
          <span className="flex shrink-0 gap-1" aria-hidden>
            <span className="h-2 w-2 rounded-full bg-[color:var(--tool-command)]/80" />
            <span className="h-2 w-2 rounded-full bg-[color:var(--tool-command)]/50" />
            <span className="h-2 w-2 rounded-full bg-[color:var(--tool-command)]/25" />
          </span>

          <span className="font-mono text-[11px] font-semibold text-[color:var(--tool-command)]">
            Terminal
          </span>

          {cwd && (
            <span className="rk-path-chip max-w-[40%] min-w-0 truncate" title={cwd}>
              {cwd}
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            {duration !== undefined && (
              <span className="text-muted-foreground font-mono text-[10px]">
                {(duration / 1000).toFixed(2)}s
              </span>
            )}
            {exitCode !== undefined && <ExitCodeBadge code={exitCode} />}
            <CopyButton text={`$ ${command}\n${stdout}${stderr ? `\nSTDERR:\n${stderr}` : ""}`} />
          </div>
        </>
      }
      footer={<RawPayloadDisclosure payload={part.toolResult ?? part.toolInput} />}
    >
      {/* Command line */}
      {command && (
        <div className="border-b px-3 py-2">
          <div className="flex items-start gap-2 font-mono text-[12px]">
            <span className="shrink-0 font-bold text-[color:var(--tool-command)] select-none">
              $
            </span>
            <div className="min-w-0 flex-1 leading-relaxed break-all">
              {command.split("\n").map((line, i) => (
                <div key={i} className="whitespace-nowrap">
                  <TokenizedCommand command={line} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {stdout && <StreamPane label="Output" content={stdout} isErr={false} />}
      {stderr && <StreamPane label="Stderr" content={stderr} isErr />}
    </ToolRendererShell>
  )
}
