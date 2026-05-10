"use client"

import React, { useState } from "react"

import { Play } from "@/lib/icons"
import { cn } from "@/lib/utils"

import {
  CopyButton,
  EmptyState,
  ExitCodeBadge,
  RawPayloadDisclosure,
  SegmentedControl,
} from "./renderer-primitives"
import { SimpleCodeEditor } from "./simple-code-editor"
import { ToolResultContentPart } from "./tool-result-renderer"

const LANG_FROM_INTERPRETER: Record<string, string> = {
  python: "python",
  python3: "python",
  node: "javascript",
  nodejs: "javascript",
  bash: "bash",
  sh: "bash",
  zsh: "bash",
  ruby: "ruby",
  php: "php",
  java: "java",
  go: "go",
  rust: "rust",
  cpp: "cpp",
  gcc: "c",
  clang: "c",
}
const LANG_EXT: Record<string, string> = {
  javascript: "js",
  typescript: "ts",
  python: "py",
  bash: "sh",
  ruby: "rb",
  php: "php",
  java: "java",
  go: "go",
  rust: "rs",
  cpp: "cpp",
  c: "c",
}

function StreamPane({ label, content, isErr }: { label: string; content: string; isErr: boolean }) {
  return (
    <div
      className={isErr ? "bg-[color-mix(in_srgb,var(--destructive)_5%,transparent)]" : undefined}
    >
      <div
        className={cn(
          "flex items-center justify-between border-b border-dashed px-3 py-1",
          isErr ? "border-[color-mix(in_srgb,var(--destructive)_20%,transparent)]" : "border-border"
        )}
      >
        <span className={cn("rk-section-label", isErr && "text-destructive/60")}>{label}</span>
        <CopyButton text={content} />
      </div>
      <pre
        className={cn(
          "rk-scrollbar max-h-[50vh] overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed wrap-anywhere whitespace-pre-wrap",
          isErr ? "text-destructive" : "text-foreground/80"
        )}
      >
        {content}
      </pre>
    </div>
  )
}

type DisplayMode = "both" | "script" | "output"

export const ScriptResultRenderer: React.FC<{
  part: ToolResultContentPart
  onAction?: (action: string, data: unknown) => void
}> = ({ part }) => {
  const [mode, setMode] = useState<DisplayMode>("both")

  const script = part.script || part.toolInput?.script || part.toolInput?.code || ""
  const interpreter = part.interpreter || part.toolInput?.interpreter || "python"
  const stdout = part.stdout || part.toolResult?.stdout || part.toolResult?.output || ""
  const stderr = part.stderr || part.toolResult?.stderr || part.toolResult?.error || ""
  const exitCode = part.exitCode ?? part.toolResult?.exitCode ?? part.toolResult?.exit_code
  const duration: number | undefined = part.toolResult?.duration

  if (!script && !stdout && !stderr) {
    return <EmptyState>Script result is empty</EmptyState>
  }

  const language = LANG_FROM_INTERPRETER[interpreter.toLowerCase()] || "text"
  const ext = LANG_EXT[language] || "txt"
  const hasOutput = Boolean(stdout || stderr)

  return (
    <div className="w-full min-w-0 space-y-2">
      {/* ── Mode toggle ── */}
      <div className="flex items-center gap-2">
        <SegmentedControl<DisplayMode>
          options={[
            { value: "both", label: "Both" },
            { value: "script", label: "Script" },
            { value: "output", label: "Output" },
          ]}
          value={mode}
          onChange={setMode}
        />
      </div>

      {/* ── Script ── */}
      {(mode === "both" || mode === "script") && script && (
        <SimpleCodeEditor
          code={script}
          language={language}
          fileName={`script.${ext}`}
          showLineNumbers
          maxHeight={mode === "both" ? "35vh" : "65vh"}
        />
      )}

      {/* ── Execution output ── */}
      {(mode === "both" || mode === "output") && hasOutput && (
        <div className="bg-surface-3 overflow-hidden rounded-lg border">
          {/* Output header */}
          <div className="bg-surface-3 flex items-center gap-2 border-b px-3 py-2">
            <span className="flex shrink-0 gap-1" aria-hidden>
              <span className="h-2 w-2 rounded-full bg-(--tool-command)/80" />
              <span className="h-2 w-2 rounded-full bg-(--tool-command)/50" />
              <span className="h-2 w-2 rounded-full bg-(--tool-command)/25" />
            </span>
            <Play className="text-tool-command h-3 w-3 shrink-0" aria-hidden />
            <span className="text-tool-command font-mono text-[11px] font-semibold">
              {interpreter}
            </span>
            <div className="ml-auto flex items-center gap-2">
              {duration !== undefined && (
                <span className="text-muted-foreground font-mono text-[10px]">
                  {(duration / 1000).toFixed(2)}s
                </span>
              )}
              {exitCode !== undefined && <ExitCodeBadge code={exitCode} />}
              <CopyButton text={`${stdout}${stderr ? `\nSTDERR:\n${stderr}` : ""}`} />
            </div>
          </div>
          {stdout && <StreamPane label="Output" content={stdout} isErr={false} />}
          {stderr && <StreamPane label="Stderr" content={stderr} isErr />}
          <RawPayloadDisclosure payload={part.toolResult ?? part.toolInput} />
        </div>
      )}
    </div>
  )
}
