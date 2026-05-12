"use client"

import React, { useState } from "react"

import { Markdown } from "@/components/markdown"
import { ClickableImage } from "@/components/ui/image-lightbox"
import { useChat } from "@/contexts/chat-context"
import { ArrowTopRightOnSquare as ExternalLink, Globe } from "@/lib/icons"

import { BrowserShell } from "./browser-shell"
import { CopyButton, EmptyState, SegmentedControl } from "./renderer-primitives"
import { SimpleCodeEditor } from "./simple-code-editor"
import { ToolResultContentPart } from "./tool-result-renderer"

async function captureFullPage(sessionId: string, url: string): Promise<string> {
  const res = await fetch("/api/tools/invoke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      toolName: "browser_full_page_screenshot",
      toolInput: { url },
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? "Screenshot failed")
  const result = typeof data.result === "string" ? JSON.parse(data.result) : data.result
  const screenshot = result?.screenshot ?? result?.image ?? result?.data
  if (!screenshot) throw new Error("No screenshot in response")
  return screenshot
}

export const BrowserResultRenderer: React.FC<{
  part: ToolResultContentPart
  onAction?: (action: string, data: unknown) => void
}> = ({ part }) => {
  const { toolResult, toolInput } = part
  const [contentMode, setContentMode] = useState<"preview" | "raw">("preview")
  const [fullPageShot, setFullPageShot] = useState<string | null>(null)
  const [fullPageLoading, setFullPageLoading] = useState(false)
  const [fullPageError, setFullPageError] = useState<string | null>(null)
  const { currentSessionId } = useChat()

  const handleFullPage = async (pageUrl: string) => {
    if (!currentSessionId || !pageUrl) return
    setFullPageLoading(true)
    setFullPageError(null)
    try {
      const shot = await captureFullPage(currentSessionId, pageUrl)
      setFullPageShot(shot)
    } catch (err) {
      setFullPageError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setFullPageLoading(false)
    }
  }

  const url = toolResult?.url || toolInput?.url || ""
  const content =
    toolResult?.content || toolResult?.text || toolResult?.markdown || toolResult?.html || ""
  const title = toolResult?.title || toolInput?.title || url.split("/").pop() || "Browser Result"
  const screenshot = toolResult?.screenshot || toolResult?.currentScreenshot || null

  if (!url && !content && !screenshot) {
    return <EmptyState>Browser result is empty</EmptyState>
  }

  const extractedUrl = (() => {
    if (typeof content === "string" && content.includes("Navigated to ")) {
      return (content.split("\n")[0] || "").replace("Navigated to ", "").trim()
    }
    return url || ""
  })()

  const extractedContent = (() => {
    if (typeof content === "string" && content.includes("Navigated to ")) {
      return content.split("\n").slice(1).join("\n")
    }
    return content
  })()

  const shouldUseMarkdown =
    part.toolName === "browser_get_markdown" || part.toolName === "visit_link"

  return (
    <div className="w-full min-w-0 space-y-2">
      {/* URL bar */}
      {extractedUrl && (
        <div className="flex items-center gap-1.5">
          <div className="bg-surface-3 flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-md border px-2.5 py-1.5">
            <Globe className="text-tool-browser h-3.5 w-3.5 shrink-0" />
            <span
              className="text-foreground/70 min-w-0 flex-1 truncate font-mono text-[11px]"
              title={extractedUrl}
            >
              {extractedUrl}
            </span>
          </div>
          <CopyButton text={extractedUrl} />
          <a
            href={extractedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground inline-flex items-center justify-center rounded p-1 transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          {currentSessionId && (
            <button
              type="button"
              onClick={() => handleFullPage(extractedUrl)}
              disabled={fullPageLoading}
              className="rk-flat-button shrink-0 font-mono text-[10px] disabled:opacity-50"
              title="Capture full page screenshot"
            >
              {fullPageLoading ? "Loading…" : "Full page"}
            </button>
          )}
        </div>
      )}

      {/* Full page screenshot result */}
      {fullPageError && (
        <p className="text-destructive px-1 font-mono text-[10px]">{fullPageError}</p>
      )}

      {/* Browser shell */}
      <BrowserShell title={title} url={extractedUrl}>
        <div className="rk-scrollbar max-h-[65vh] min-h-20 overflow-auto border-t">
          {fullPageShot ? (
            <div className="p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="rk-section-label">Full page screenshot</span>
                <div className="flex items-center gap-2">
                  <CopyButton text={fullPageShot} />
                  <button
                    type="button"
                    onClick={() => setFullPageShot(null)}
                    className="rk-flat-button font-mono text-[10px]"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
              <ClickableImage
                src={fullPageShot}
                alt="Full page screenshot"
                className="h-auto w-full rounded"
              />
            </div>
          ) : (
            screenshot && (
              <div className="p-3">
                <ClickableImage
                  src={screenshot}
                  alt="Browser screenshot"
                  className="h-auto w-full rounded"
                />
              </div>
            )
          )}

          {typeof extractedContent === "string" &&
            extractedContent &&
            (shouldUseMarkdown ? (
              <div className="p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="rk-section-label">Markdown content</span>
                  <SegmentedControl
                    options={[
                      { value: "preview", label: "Preview" },
                      { value: "raw", label: "Raw" },
                    ]}
                    value={contentMode}
                    onChange={setContentMode}
                  />
                </div>
                {contentMode === "preview" ? (
                  <Markdown className="max-w-none wrap-break-word">{extractedContent}</Markdown>
                ) : (
                  <SimpleCodeEditor
                    code={extractedContent}
                    language="markdown"
                    fileName="content.md"
                    showLineNumbers
                    maxHeight="400px"
                    readOnly
                    fontSize={12}
                  />
                )}
              </div>
            ) : (
              <p className="text-foreground/75 px-4 py-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                {extractedContent}
              </p>
            ))}

          {!screenshot && !extractedContent && (
            <pre className="text-foreground/60 px-3 py-3 font-mono text-[10px] whitespace-pre-wrap">
              {JSON.stringify(toolResult, null, 2)}
            </pre>
          )}
        </div>
      </BrowserShell>
    </div>
  )
}
