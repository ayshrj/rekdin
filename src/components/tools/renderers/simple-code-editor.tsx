"use client"

import { useTheme } from "next-themes"
import { Component, useMemo, useState } from "react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"

import { Check, ClipboardDocumentList as Copy } from "@/lib/icons"

// Prism JSON-LD grammar calls `.toLowerCase()` on `@context` which can be null.
class PrismErrorBoundary extends Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { crashed: boolean }
> {
  state = { crashed: false }
  static getDerivedStateFromError() {
    return { crashed: true }
  }
  render() {
    return this.state.crashed ? this.props.fallback : this.props.children
  }
}

interface SimpleCodeEditorProps {
  code: string
  language: string
  fileName?: string
  showLineNumbers?: boolean
  maxHeight?: string
  className?: string
  readOnly?: boolean
  fontSize?: number
  showHeader?: boolean
}

export function SimpleCodeEditor({
  code,
  language,
  fileName = "code.txt",
  showLineNumbers = true,
  maxHeight = "60vh",
  className = "",
  readOnly = true,
  fontSize = 14,
  showHeader = true,
}: SimpleCodeEditorProps) {
  const { resolvedTheme: theme } = useTheme()
  const [copied, setCopied] = useState(false)

  const normalizedLanguage = useMemo(() => {
    const map: Record<string, string> = {
      js: "javascript",
      ts: "typescript",
      py: "python",
      sh: "bash",
      zsh: "bash",
      yml: "yaml",
      md: "markdown",
    }
    return map[language?.toLowerCase()] ?? language?.toLowerCase() ?? "text"
  }, [language])

  const languageBadgeClass = useMemo(() => {
    const map: Record<string, string> = {
      python: "bg-primary text-primary-foreground",
      javascript: "bg-secondary text-secondary-foreground",
      typescript: "bg-accent text-accent-foreground",
      bash: "bg-muted text-foreground",
      shell: "bg-muted text-foreground",
      markdown: "bg-muted text-foreground",
      json: "bg-secondary text-secondary-foreground",
    }
    return map[normalizedLanguage] ?? "bg-muted text-foreground"
  }, [normalizedLanguage])

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code ?? "")
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const isDark = theme === "dark"

  return (
    <div className={`border-border overflow-hidden rounded-lg border ${className}`}>
      {showHeader ? (
        <div className="bg-muted/30 flex items-center justify-between border-b p-2">
          <div className="flex items-center gap-2">
            <span className={`rounded-sm px-2 py-0.5 text-xs font-medium ${languageBadgeClass}`}>
              {normalizedLanguage.toUpperCase()}
            </span>
            <span className="text-muted-foreground text-sm">{fileName}</span>
            {!readOnly ? <span className="text-muted-foreground text-xs">(editable)</span> : null}
          </div>
          <button
            type="button"
            onClick={copyToClipboard}
            className={`hover:bg-muted rounded p-1 ${copied ? "text-primary" : "text-muted-foreground"}`}
            title="Copy code"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
      ) : null}

      <div style={{ maxHeight }} className="overflow-auto">
        <PrismErrorBoundary
          fallback={
            <pre
              style={{
                fontSize,
                background: "var(--color-card)",
                color: "var(--color-card-foreground)",
              }}
              className="m-0 p-3 font-mono leading-relaxed whitespace-pre-wrap"
            >
              {code ?? ""}
            </pre>
          }
        >
          <SyntaxHighlighter
            language={normalizedLanguage}
            style={isDark ? oneDark : undefined}
            showLineNumbers={showLineNumbers}
            customStyle={{
              margin: 0,
              background: "var(--color-card)",
              color: "var(--color-card-foreground)",
              fontSize,
              lineHeight: 1.5,
            }}
            codeTagProps={{
              style: {
                fontFamily:
                  "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              },
            }}
          >
            {code ?? ""}
          </SyntaxHighlighter>
        </PrismErrorBoundary>
      </div>
    </div>
  )
}
