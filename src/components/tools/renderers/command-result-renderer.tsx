"use client"

import React, { useState } from "react"

import { Check, ClipboardDocumentList as Copy } from "@/lib/icons"

import { ToolResultContentPart } from "./tool-result-renderer"

interface CommandResultRendererProps {
  part: ToolResultContentPart
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAction?: (action: string, data: any) => void
}

const highlightCommand = (command: string) => {
  const tokenize = (cmd: string) => {
    const parts: React.ReactNode[] = []
    const patterns = [
      {
        pattern: /^[\w.-]+|(?<=\s|;|&&|\|\|)[\w.-]+(?=\s|$)/,
        className: "text-tool-command font-semibold",
      },
      { pattern: /(?<=\s|^)(-{1,2}[\w-]+)(?=\s|=|$)/, className: "text-muted-foreground" },
      {
        pattern: /(?<=\s|=|:|^)\/[\w./\\_-]+|\.\/?[\w./\\_-]+|~\/[\w./\\_-]+/,
        className: "text-accent-foreground",
      },
      { pattern: /(["'])(?:(?=(\\?))\2.)*?\1/, className: "text-secondary-foreground" },
      { pattern: /\$\w+|\$\{\w+\}/, className: "text-tool-command" },
      {
        pattern: /(?<=\s)(>|>>|<|<<|2>|2>>|&>)(?=\s|$)/,
        className: "text-tool-command font-semibold",
      },
      {
        pattern: /(?<=\s)(\||;|&&|\|\|)(?=\s|$)/,
        className: "text-destructive font-semibold",
      },
    ]

    let remainingCmd = cmd
    let currentIndex = 0

    while (remainingCmd) {
      let foundMatch = false
      for (const { pattern, className } of patterns) {
        const match = remainingCmd.match(pattern)
        if (match && match.index === 0) {
          const value = match[0]
          parts.push(
            <span key={`highlight-${currentIndex}`} className={className}>
              {value}
            </span>
          )
          remainingCmd = remainingCmd.slice(value.length)
          currentIndex += value.length
          foundMatch = true
          break
        }
      }
      if (!foundMatch) {
        parts.push(
          <span key={`char-${currentIndex}`} className="text-foreground">
            {remainingCmd[0]}
          </span>
        )
        remainingCmd = remainingCmd.slice(1)
        currentIndex += 1
      }
    }
    return parts
  }

  return command.split("\n").map((line, index) => (
    <div key={index} className="command-line whitespace-nowrap">
      {tokenize(line)}
    </div>
  ))
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

export const CommandResultRenderer: React.FC<CommandResultRendererProps> = ({ part }) => {
  const command = part.command || part.toolInput?.command || ""
  const stdout = part.stdout || part.toolResult?.stdout || part.toolResult?.output || ""
  const stderr = part.stderr || part.toolResult?.stderr || part.toolResult?.error || ""
  const exitCode = part.exitCode ?? part.toolResult?.exitCode ?? part.toolResult?.exit_code

  if (!command && !stdout && !stderr) {
    return <div className="text-muted-foreground italic">Command result is empty</div>
  }

  const isError = exitCode !== 0 && exitCode !== undefined

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg border shadow-[0_4px_16px_rgba(0,0,0,0.1)]">
      {/* Header */}
      <div className="bg-muted/60 flex items-center justify-between gap-2 border-b px-3 py-1.5">
        <div className="flex items-center gap-2">
          <div className="flex shrink-0 gap-1.5">
            <div className="bg-tool-command/80 h-2.5 w-2.5 rounded-full" />
            <div className="bg-tool-command/50 h-2.5 w-2.5 rounded-full" />
            <div className="bg-tool-command/30 h-2.5 w-2.5 rounded-full" />
          </div>
          <span className="text-tool-command text-xs font-medium">Terminal</span>
          {exitCode !== undefined && (
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                isError
                  ? "bg-destructive/10 text-destructive border-destructive/20 border"
                  : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
              }`}
            >
              exit {exitCode}
            </span>
          )}
        </div>
        <CopyBtn text={`$ ${command}\n${stdout}${stderr ? `\nSTDERR:\n${stderr}` : ""}`} />
      </div>

      {/* Command */}
      {command && (
        <div className="bg-card overflow-x-auto border-b px-3 py-2">
          <div className="flex items-start gap-2 font-mono text-sm">
            <span className="text-tool-command shrink-0 font-bold select-none">$</span>
            <div className="flex-1">{highlightCommand(command)}</div>
          </div>
        </div>
      )}

      {/* Stdout */}
      {stdout && (
        <div className="bg-card border-b last:border-b-0">
          <div className="border-muted flex items-center justify-between border-b border-dashed px-3 py-1">
            <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
              Output
            </span>
            <CopyBtn text={stdout} />
          </div>
          <pre className="text-foreground/80 max-h-[60vh] overflow-auto px-3 py-2 font-mono text-xs leading-relaxed wrap-anywhere whitespace-pre-wrap">
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
          <pre className="text-destructive max-h-[40vh] overflow-auto px-3 py-2 font-mono text-xs leading-relaxed wrap-anywhere whitespace-pre-wrap">
            {stderr}
          </pre>
        </div>
      )}
    </div>
  )
}
