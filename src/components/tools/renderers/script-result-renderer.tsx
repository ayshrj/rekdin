"use client"

import { motion } from "framer-motion"
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

const highlightCommand = (command: string) => {
  return (
    <div className="command-line whitespace-nowrap">
      <span className="text-tool-command font-semibold">{command}</span>
    </div>
  )
}

export const ScriptResultRenderer: React.FC<ScriptResultRendererProps> = ({ part }) => {
  const [displayMode, setDisplayMode] = useState<"both" | "script" | "execution">("both")
  const [copied, setCopied] = useState(false)

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

  const copyToClipboard = async () => {
    const textToCopy = `${script}\n\n# Output:\n${stdout}${stderr ? `\n# Error:\n${stderr}` : ""}`
    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="flex justify-center">
        <div className="inline-flex rounded-md shadow-sm" role="group">
          <button
            type="button"
            onClick={() => setDisplayMode("both")}
            className={`border-border rounded-l-lg border px-3 py-1.5 text-xs font-medium ${
              displayMode === "both"
                ? "bg-tool-command/10 text-tool-command"
                : "bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            <div className="flex items-center">
              <CodeBracket size={12} className="mr-1.5" />
              <span>Both</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setDisplayMode("script")}
            className={`border-border border-t border-b px-3 py-1.5 text-xs font-medium ${
              displayMode === "script"
                ? "bg-tool-command/10 text-tool-command"
                : "bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            <div className="flex items-center">
              <CodeBracket size={12} className="mr-1.5" />
              <span>Script</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setDisplayMode("execution")}
            className={`border-border rounded-r-lg border border-l-0 px-3 py-1.5 text-xs font-medium ${
              displayMode === "execution"
                ? "bg-tool-command/10 text-tool-command"
                : "bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            <div className="flex items-center">
              <CommandLine size={12} className="mr-1.5" />
              <span>Execution</span>
            </div>
          </button>
        </div>
      </div>

      {(displayMode === "both" || displayMode === "script") && script ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <SimpleCodeEditor
            code={script}
            language={language}
            fileName={`script.${LANGUAGE_EXTENSIONS[language] || "txt"}`}
            showLineNumbers
            maxHeight={displayMode === "both" ? "40vh" : "80vh"}
          />
        </motion.div>
      ) : null}

      {(displayMode === "both" || displayMode === "execution") && hasOutput ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: displayMode === "both" ? 0.1 : 0 }}
        >
          <div className="border-border overflow-hidden rounded-lg border shadow-[0_8px_24px_rgba(0,0,0,0.15)]">
            <div className="border-border bg-muted/60 flex flex-wrap items-center justify-between gap-2 border-b px-3 py-1.5">
              <div className="flex items-center">
                <div className="mr-3 flex shrink-0 space-x-1.5">
                  <div className="bg-tool-command/80 h-3 w-3 rounded-full shadow-sm" />
                  <div className="bg-tool-command/60 h-3 w-3 rounded-full shadow-sm" />
                  <div className="bg-tool-command/40 h-3 w-3 rounded-full shadow-sm" />
                </div>
                <div className="text-tool-command flex items-center gap-2 text-xs font-medium">
                  <Play size={10} />
                  <span>Script Execution - {interpreter}</span>
                  {exitCode !== undefined ? (
                    <span
                      className={`ml-2 rounded px-1.5 py-0.5 text-[10px] ${
                        isError
                          ? "border-destructive/30 bg-destructive/10 text-destructive border"
                          : "border-tool-command/30 bg-tool-command/10 text-tool-command border"
                      }`}
                    >
                      exit {exitCode}
                    </span>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                onClick={copyToClipboard}
                className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1.5 transition-colors"
                title="Copy script and output"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>

            <div className="bg-card max-h-[80vh] min-w-0 overflow-auto p-3 font-mono text-sm">
              <div className="space-y-1">
                <div className="flex items-start">
                  <span className="text-tool-command mr-2 font-bold select-none">$</span>
                  <div className="text-foreground flex-1">
                    {highlightCommand(`${interpreter} << 'EOF'`)}
                  </div>
                </div>

                {stdout ? (
                  <div className="mt-2 ml-4">
                    <pre className="text-foreground leading-relaxed wrap-anywhere whitespace-pre-wrap">
                      {stdout}
                    </pre>
                  </div>
                ) : null}

                {stderr ? (
                  <div className="mt-2 ml-4">
                    <pre className="text-destructive leading-relaxed wrap-anywhere whitespace-pre-wrap">
                      {stderr}
                    </pre>
                  </div>
                ) : null}

                <div className="mt-2 flex items-start">
                  <span className="text-tool-command mr-2 font-bold select-none">$</span>
                  <span className="text-muted-foreground text-xs">EOF</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </div>
  )
}
