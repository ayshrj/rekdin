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

  const lines = command.split("\n")
  return lines.map((line, index) => (
    <div key={index} className="command-line whitespace-nowrap">
      {tokenize(line)}
    </div>
  ))
}

export const CommandResultRenderer: React.FC<CommandResultRendererProps> = ({ part }) => {
  const [copied, setCopied] = useState(false)

  const command = part.command || part.toolInput?.command || ""
  const stdout = part.stdout || part.toolResult?.stdout || part.toolResult?.output || ""
  const stderr = part.stderr || part.toolResult?.stderr || part.toolResult?.error || ""
  const exitCode = part.exitCode ?? part.toolResult?.exitCode ?? part.toolResult?.exit_code

  if (!command && !stdout && !stderr) {
    return <div className="text-muted-foreground italic">Command result is empty</div>
  }

  const isError = exitCode !== 0 && exitCode !== undefined

  const copyToClipboard = async () => {
    const textToCopy = `$ ${command}\n${stdout}${stderr ? `\n${stderr}` : ""}`
    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className="w-full min-w-0 space-y-2">
      <div className="border-border overflow-hidden rounded-lg border shadow-[0_8px_24px_rgba(0,0,0,0.15)]">
        <div className="border-border bg-muted/60 flex flex-wrap items-center justify-between gap-2 border-b px-3 py-1.5">
          <div className="flex items-center">
            <div className="mr-3 flex shrink-0 space-x-1.5">
              <div className="bg-tool-command/80 h-3 w-3 rounded-full shadow-sm" />
              <div className="bg-tool-command/60 h-3 w-3 rounded-full shadow-sm" />
              <div className="bg-tool-command/40 h-3 w-3 rounded-full shadow-sm" />
            </div>
            <div className="text-tool-command text-xs font-medium">
              Terminal
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
            title="Copy command and output"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>

        <div className="bg-card max-h-[80vh] min-w-0 overflow-auto px-3 py-2 font-mono text-sm">
          <div className="min-w-0 overflow-x-auto">
            {command ? (
              <div className="flex items-start whitespace-nowrap">
                <span className="terminal-prompt-symbol text-tool-command mr-2 font-bold select-none">
                  $
                </span>
                <div className="flex-1">{highlightCommand(command)}</div>
              </div>
            ) : null}

            {stdout ? (
              <pre className="text-foreground mt-2 ml-3 leading-relaxed wrap-anywhere whitespace-pre-wrap">
                {stdout}
              </pre>
            ) : null}

            {stderr ? (
              <pre className="text-destructive mt-2 ml-3 leading-relaxed wrap-anywhere whitespace-pre-wrap">
                {stderr}
              </pre>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
