"use client"

import { motion } from "motion/react"
import React, { useState } from "react"

import { Check, ClipboardDocumentList as Copy, CodeBracket, CommandLine, Play } from "@/lib/icons"

import { SimpleCodeEditor } from "./simple-code-editor"
import { ToolResultContentPart } from "./tool-result-renderer"

interface ScriptResultRendererProps {
  part: ToolResultContentPart
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAction?: (action: string, data: any) => void
}

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  javascript: "js",
  typescript: "ts",
  python: "py",
  bash: "sh",
  shell: "sh",
  ruby: "rb",
  php: "php",
  java: "java",
  go: "go",
  rust: "rs",
  cpp: "cpp",
  c: "c",
}

const getLanguageFromInterpreter = (interpreter: string): string => {
  const languageMap: Record<string, string> = {
    python: "python",
    python3: "python",
    node: "javascript",
    nodejs: "javascript",
    bash: "bash",
    sh: "bash",
    ruby: "ruby",
    php: "php",
    java: "java",
    go: "go",
    rust: "rust",
    cpp: "cpp",
    "c++": "cpp",
    gcc: "c",
    clang: "c",
  }
  return languageMap[interpreter.toLowerCase()] || "text"
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

export const ScriptResultRenderer: React.FC<ScriptResultRendererProps> = ({ part }) => {
  const [displayMode, setDisplayMode] = useState<"both" | "script" | "execution">("both")

  const script = part.script || part.toolInput?.script || part.toolInput?.code || ""
  const interpreter = part.interpreter || part.toolInput?.interpreter || "python"
  const stdout = part.stdout || part.toolResult?.stdout || part.toolResult?.output || ""
  const stderr = part.stderr || part.toolResult?.stderr || part.toolResult?.error || ""
  const exitCode = part.exitCode ?? part.toolResult?.exitCode ?? part.toolResult?.exit_code

  if (!script && !stdout && !stderr) {
    return <div className="text-muted-foreground italic">Script result is empty</div>
  }

  const isError = exitCode !== 0 && exitCode !== undefined
  const hasOutput = stdout || stderr
  const language = getLanguageFromInterpreter(interpreter)

  const tabs = [
    { id: "both" as const, label: "Both", icon: CodeBracket },
    { id: "script" as const, label: "Script", icon: CodeBracket },
    { id: "execution" as const, label: "Output", icon: CommandLine },
  ]

  return (
    <div className="w-full min-w-0 space-y-3">
      {/* Tab bar */}
      <div className="flex justify-center">
        <div className="bg-muted/40 inline-flex gap-0.5 rounded-lg p-0.5">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setDisplayMode(id)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                displayMode === id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Script */}
      {(displayMode === "both" || displayMode === "script") && script ? (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <SimpleCodeEditor
            code={script}
            language={language}
            fileName={`script.${LANGUAGE_EXTENSIONS[language] || "txt"}`}
            showLineNumbers
            maxHeight={displayMode === "both" ? "35vh" : "70vh"}
          />
        </motion.div>
      ) : null}

      {/* Execution output */}
      {(displayMode === "both" || displayMode === "execution") && hasOutput ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: displayMode === "both" ? 0.05 : 0 }}
          className="overflow-hidden rounded-lg border shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
        >
          {/* Terminal header */}
          <div className="bg-muted/60 flex items-center justify-between gap-2 border-b px-3 py-1.5">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="bg-tool-command/80 h-2.5 w-2.5 rounded-full" />
                <div className="bg-tool-command/50 h-2.5 w-2.5 rounded-full" />
                <div className="bg-tool-command/30 h-2.5 w-2.5 rounded-full" />
              </div>
              <Play className="text-tool-command h-3 w-3" />
              <span className="text-tool-command text-xs font-medium">{interpreter}</span>
              {exitCode !== undefined && (
                <span
                  className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                    isError
                      ? "bg-destructive/10 text-destructive border-destructive/20"
                      : "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
                  }`}
                >
                  exit {exitCode}
                </span>
              )}
            </div>
            <CopyBtn text={`${stdout}${stderr ? `\nSTDERR:\n${stderr}` : ""}`} />
          </div>

          {/* Stdout */}
          {stdout && (
            <div className="bg-card border-b last:border-b-0">
              <div className="border-muted flex items-center justify-between border-b border-dashed px-3 py-1">
                <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                  Output
                </span>
                <CopyBtn text={stdout} />
              </div>
              <pre className="text-foreground/80 max-h-[50vh] overflow-auto px-3 py-2 font-mono text-xs leading-relaxed wrap-anywhere whitespace-pre-wrap">
                {stdout}
              </pre>
            </div>
          )}

          {/* Stderr */}
          {stderr && (
            <div className="bg-destructive/5">
              <div className="border-destructive/20 flex items-center justify-between border-b border-dashed px-3 py-1">
                <span className="text-destructive/70 text-[10px] font-medium tracking-wide uppercase">
                  Errors
                </span>
                <CopyBtn text={stderr} />
              </div>
              <pre className="text-destructive max-h-[30vh] overflow-auto px-3 py-2 font-mono text-xs leading-relaxed wrap-anywhere whitespace-pre-wrap">
                {stderr}
              </pre>
            </div>
          )}
        </motion.div>
      ) : null}
    </div>
  )
}
