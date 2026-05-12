"use client"

import React, { useCallback, useState } from "react"

import { FileExtensionIcon } from "@/components/file-extension-icon"
import { Markdown } from "@/components/markdown"
import { cn } from "@/lib/utils"

import { CopyButton as SharedCopyButton, useToolInvoke } from "./renderer-primitives"
import { SimpleCodeEditor } from "./simple-code-editor"
import { type ToolResultContentPart } from "./tool-result-renderer"

type FileReadResult = { path?: string; content?: string; truncated?: boolean }

const CODE_EXTENSIONS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "c",
  "cpp",
  "h",
  "cs",
  "swift",
  "kt",
  "php",
  "sh",
  "bash",
  "zsh",
  "fish",
  "css",
  "scss",
  "less",
  "html",
  "xml",
  "svg",
  "yaml",
  "yml",
  "toml",
  "env",
  "prisma",
  "graphql",
  "gql",
  "sql",
  "json",
  "jsonc",
  "json5",
])
const MARKDOWN_EXTENSIONS = new Set(["md", "mdx"])

export const FileReadRenderer: React.FC<{
  part: ToolResultContentPart
  onAction?: (action: string, data: unknown) => void
}> = ({ part }) => {
  const filePath: string =
    (part.toolInput as { path?: string } | undefined)?.path ??
    (part.toolResult as { path?: string } | undefined)?.path ??
    ""
  const originalContent: string =
    (part.toolResult as { content?: string } | undefined)?.content ?? ""
  const isTruncated: boolean = Boolean(
    (part.toolResult as { truncated?: boolean } | undefined)?.truncated
  )

  const { loading, result: fullResult, invoke, reset } = useToolInvoke<FileReadResult>("file_read")
  const [showFull, setShowFull] = useState(false)

  const handleLoadFull = useCallback(async () => {
    if (showFull) {
      reset()
      setShowFull(false)
      return
    }
    setShowFull(true)
    await invoke({ path: filePath })
  }, [showFull, invoke, reset, filePath])

  const content = showFull ? (fullResult?.content ?? originalContent) : originalContent
  const ext = filePath.split(".").pop()?.toLowerCase() ?? ""
  const fileName = filePath.split("/").pop() ?? filePath
  const lineCount = content ? content.split("\n").length : 0

  const isCode = CODE_EXTENSIONS.has(ext)
  const isMarkdown = MARKDOWN_EXTENSIONS.has(ext)

  return (
    <div className="w-full min-w-0 space-y-0 overflow-hidden rounded-lg">
      {/* Header */}
      <div className="bg-muted/20 flex items-center justify-between border-b px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <FileExtensionIcon
            extensionName={filePath || fileName}
            className="h-3.5 w-3.5 shrink-0"
          />
          <span className="text-foreground/70 truncate font-mono text-[11px]" title={filePath}>
            {filePath || "(unknown path)"}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {lineCount > 0 && (
            <span className="text-muted-foreground text-[10px]">{lineCount} lines</span>
          )}
          {isTruncated && !showFull && (
            <span className="text-status-warning font-mono text-[10px]">truncated</span>
          )}
          {isTruncated && (
            <button
              type="button"
              onClick={handleLoadFull}
              disabled={loading}
              className="rk-flat-button font-mono text-[10px] disabled:opacity-50"
            >
              {loading ? "Loading…" : showFull ? "Show original" : "Load full"}
            </button>
          )}
          {content && <SharedCopyButton text={content} />}
        </div>
      </div>

      {/* Content */}
      {!content ? (
        <div className="text-muted-foreground px-3 py-4 text-xs italic">No content</div>
      ) : isMarkdown ? (
        <div className="max-h-[60vh] overflow-auto px-4 py-3">
          <Markdown>{content}</Markdown>
        </div>
      ) : isCode ? (
        <SimpleCodeEditor
          code={content}
          language={ext}
          fileName={fileName}
          showHeader={false}
          maxHeight="60vh"
          fontSize={12}
        />
      ) : (
        <pre
          className={cn(
            "text-foreground/80 max-h-[60vh] overflow-auto px-3 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap"
          )}
        >
          {content}
        </pre>
      )}
    </div>
  )
}
