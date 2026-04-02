"use client"

import { motion } from "framer-motion"
import React, { useState } from "react"

import { Markdown } from "@/components/markdown"
import { Image } from "@/components/ui/image"
import {
  ArrowTopRightOnSquare as ExternalLink,
  Check,
  ClipboardDocumentList,
  Globe,
} from "@/lib/icons"
import { cn } from "@/lib/utils"

import { BrowserShell } from "./browser-shell"
import { SimpleCodeEditor } from "./simple-code-editor"
import { ToolResultContentPart } from "./tool-result-renderer"

interface BrowserResultRendererProps {
  part: ToolResultContentPart
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAction?: (action: string, data: any) => void
}

export const BrowserResultRenderer: React.FC<BrowserResultRendererProps> = ({ part }) => {
  const { toolResult, toolInput } = part
  const [copied, setCopied] = useState(false)
  const [contentMode, setContentMode] = useState<"preview" | "raw">("preview")

  const url = toolResult?.url || toolInput?.url || ""
  const content =
    toolResult?.content || toolResult?.text || toolResult?.markdown || toolResult?.html || ""
  const title = toolResult?.title || toolInput?.title || url?.split("/").pop() || "Browser Result"
  const screenshot = toolResult?.screenshot || toolResult?.currentScreenshot || null

  if (!url && !content && !screenshot) {
    return <div className="text-muted-foreground italic">Browser result is empty</div>
  }

  const copyUrl = () => {
    if (!url) return
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const extractUrlFromContent = () => {
    if (typeof content === "string" && content.includes("Navigated to ")) {
      const lines = content.split("\n")
      const firstLine = lines[0] || ""
      return firstLine.replace("Navigated to ", "").trim()
    }
    return url || ""
  }

  const extractContentFromText = () => {
    if (typeof content === "string" && content.includes("Navigated to ")) {
      const lines = content.split("\n")
      return lines.slice(1).join("\n")
    }
    return content
  }

  const extractedUrl = extractUrlFromContent()
  const extractedContent = extractContentFromText()

  const shouldUseMarkdownEditor =
    part.toolName === "browser_get_markdown" || part.toolName === "visit_link"

  return (
    <div className="space-y-4">
      <div className="mb-4">
        {extractedUrl ? (
          <div className="mb-4 flex items-center">
            <div className="border-border bg-muted/40 flex flex-1 items-center overflow-hidden rounded-lg border p-3 text-sm">
              <Globe className="text-tool-browser mr-2 shrink-0" size={16} />
              <span className="text-foreground mr-2 truncate">{extractedUrl}</span>
            </div>
            <div className="ml-2 flex gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={copyUrl}
                className="border-tool-browser/20 bg-tool-browser/10 text-tool-browser hover:bg-tool-browser/20 rounded-lg border p-2 transition-colors"
                title="Copy URL"
                type="button"
              >
                {copied ? (
                  <Check size={18} className="text-tool-browser" />
                ) : (
                  <ClipboardDocumentList size={18} />
                )}
              </motion.button>
              <motion.a
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                href={extractedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="border-tool-browser/20 bg-tool-browser/10 text-tool-browser hover:bg-tool-browser/20 rounded-lg border p-2 transition-colors"
                title="Open in new tab"
              >
                <ExternalLink size={18} />
              </motion.a>
            </div>
          </div>
        ) : null}

        <BrowserShell title={title} url={extractedUrl}>
          <div className="border-border bg-card max-h-[70vh] min-h-50 overflow-auto border-t px-5">
            {screenshot ? (
              <div className="py-4">
                <Image
                  src={screenshot}
                  alt="Browser Screenshot"
                  className="h-auto w-full rounded-md"
                />
              </div>
            ) : null}

            {typeof extractedContent === "string" && extractedContent ? (
              shouldUseMarkdownEditor ? (
                <div className="py-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-muted-foreground text-xs">Markdown content</div>
                      <div className="bg-background flex items-center rounded-md border p-0.5">
                        {(["preview", "raw"] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setContentMode(mode)}
                            className={cn(
                              "rounded px-2 py-1 text-xs font-medium transition-colors",
                              contentMode === mode
                                ? "bg-tool-browser/10 text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {mode === "preview" ? "Preview" : "Raw"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {contentMode === "preview" ? (
                      <div className="border-border bg-background rounded-lg border p-4">
                        <Markdown className="max-w-none break-words">{extractedContent}</Markdown>
                      </div>
                    ) : (
                      <SimpleCodeEditor
                        code={extractedContent}
                        language="markdown"
                        fileName="content.md"
                        showLineNumbers
                        maxHeight="500px"
                        readOnly
                        fontSize={13}
                      />
                    )}
                  </div>
                </div>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none py-4 whitespace-pre-wrap">
                  <div className="whitespace-pre-wrap">{extractedContent}</div>
                </div>
              )
            ) : !screenshot ? (
              <pre className="border-border bg-muted/40 overflow-x-auto rounded-lg border p-4 font-mono text-sm whitespace-pre-wrap">
                {JSON.stringify(extractedContent, null, 2)}
              </pre>
            ) : null}
          </div>
        </BrowserShell>
      </div>
    </div>
  )
}
