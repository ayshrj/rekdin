"use client"

import { motion } from "motion/react"
import React, { useCallback, useEffect, useMemo, useState } from "react"

import { Check, Clock, CodeBracket, File, XMark } from "@/lib/icons"
import { ArrowDownTray, Eye } from "@/lib/icons"

import { ToolResultContentPart } from "./tool-result-renderer"

interface PdfRendererProps {
  part: ToolResultContentPart
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAction?: (action: string, data: any) => void
}

export const PdfRenderer: React.FC<PdfRendererProps> = ({ part }) => {
  const [showLatexSource, setShowLatexSource] = useState(false)
  const [showInlinePdf, setShowInlinePdf] = useState(false)
  const [materializedPdfUrl, setMaterializedPdfUrl] = useState<string | null>(null)
  const [materializingPdf, setMaterializingPdf] = useState(false)
  const [materializeError, setMaterializeError] = useState<string | null>(null)

  const result = part?.toolResult
  const isSuccess = Boolean(result?.success && result?.pdfGenerated && !result?.degraded)
  const isDegraded = Boolean(result?.pdfGenerated && result?.degraded)
  const isLegacyLatexEngineError = Boolean(
    typeof result?.error === "string" && result.error.includes("No LaTeX engine found")
  )
  const pdfFilename = result?.filename || "document"
  const pdfUrl = result?.artifactUrl || result?.cloudinaryUrl || result?.dataUrl || ""
  const hasPdfUrl = Boolean(pdfUrl)

  const needsMaterialization = useMemo(() => {
    if (!pdfUrl) return false
    const lower = pdfUrl.toLowerCase()
    if (lower.startsWith("data:") || lower.startsWith("blob:")) return false

    const looksLikeCloudinaryRaw =
      lower.includes("res.cloudinary.com") && lower.includes("/raw/upload/")
    const hasPdfExtension = /\.pdf($|[?#])/i.test(pdfUrl)

    return looksLikeCloudinaryRaw || !hasPdfExtension
  }, [pdfUrl])

  useEffect(() => {
    setMaterializeError(null)
    setMaterializedPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }, [pdfUrl])

  const ensureMaterializedPdfUrl = useCallback(async () => {
    if (!pdfUrl || !needsMaterialization) return null
    if (materializedPdfUrl) return materializedPdfUrl
    if (materializingPdf) return null

    setMaterializingPdf(true)
    setMaterializeError(null)
    try {
      const res = await fetch(pdfUrl)
      if (!res.ok) throw new Error(`Failed to fetch PDF (${res.status})`)
      const buffer = await res.arrayBuffer()
      const blob = new Blob([buffer], { type: "application/pdf" })
      const url = URL.createObjectURL(blob)
      setMaterializedPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return url
      })
      return url
    } catch (err) {
      setMaterializeError(err instanceof Error ? err.message : "Failed to fetch PDF")
      return null
    } finally {
      setMaterializingPdf(false)
    }
  }, [materializedPdfUrl, materializingPdf, needsMaterialization, pdfUrl])

  useEffect(() => {
    if (!showInlinePdf) return
    void ensureMaterializedPdfUrl()
  }, [ensureMaterializedPdfUrl, showInlinePdf])

  useEffect(() => {
    return () => {
      if (materializedPdfUrl) URL.revokeObjectURL(materializedPdfUrl)
    }
  }, [materializedPdfUrl])

  const effectivePdfUrl = materializedPdfUrl || pdfUrl
  const inlineIframeUrl = needsMaterialization ? materializedPdfUrl || "" : pdfUrl

  if (!part || !result) {
    return (
      <div className="py-4 text-center">
        <p className="text-muted-foreground">No PDF data available</p>
      </div>
    )
  }

  return (
    <div className="pdf-renderer w-full min-w-0">
      <div className="border-border bg-card overflow-hidden rounded-xl border">
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div className="flex min-w-0 flex-1 items-center space-x-3">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                isSuccess ? "bg-tool-doc/10" : "bg-destructive/10"
              }`}
            >
              <File className={`${isSuccess ? "text-tool-doc" : "text-destructive"}`} size={16} />
            </div>
            <div>
              <h3 className="text-foreground text-sm font-semibold">
                {part.toolName === "markdown_to_pdf"
                  ? "Document PDF Generation"
                  : "LaTeX PDF Generation"}
              </h3>
              <p className="text-muted-foreground text-xs wrap-anywhere">{pdfFilename}.pdf</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {result.duration ? (
              <div className="text-muted-foreground flex items-center gap-1 text-xs">
                <Clock size={12} />
                <span>{(result.duration / 1000).toFixed(1)}s</span>
              </div>
            ) : null}

            {isSuccess ? (
              <div className="bg-tool-doc/10 text-tool-doc flex items-center space-x-1 rounded-md px-2 py-1 text-xs font-medium">
                <Check size={12} />
                <span>Success</span>
              </div>
            ) : isDegraded ? (
              <div className="bg-tool-json/10 text-tool-json flex items-center space-x-1 rounded-md px-2 py-1 text-xs font-medium">
                <Check size={12} />
                <span>Fallback PDF</span>
              </div>
            ) : (
              <div className="bg-destructive/10 text-destructive flex items-center space-x-1 rounded-md px-2 py-1 text-xs font-medium">
                <XMark size={12} />
                <span>Failed</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 p-4">
          {isSuccess || isDegraded ? (
            <>
              {isDegraded && result.error ? (
                <div className="border-tool-json/30 bg-tool-json/10 rounded-lg border p-4">
                  <h4 className="text-tool-json mb-2 text-sm font-semibold">Fallback Preview</h4>
                  <p className="text-foreground text-sm whitespace-pre-wrap">{result.error}</p>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => hasPdfUrl && setShowInlinePdf(!showInlinePdf)}
                  className="bg-tool-doc text-foreground hover:bg-tool-doc/90 flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60"
                  disabled={!hasPdfUrl}
                >
                  <Eye size={16} />
                  <span>{showInlinePdf ? "Hide PDF" : "Show PDF"}</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={async () => {
                    if (!hasPdfUrl) return
                    const resolvedUrl =
                      needsMaterialization && !materializedPdfUrl
                        ? ((await ensureMaterializedPdfUrl()) ?? pdfUrl)
                        : effectivePdfUrl
                    const link = document.createElement("a")
                    link.href = resolvedUrl
                    link.target = "_blank"
                    link.rel = "noopener noreferrer"
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                  }}
                  className="bg-tool-doc/15 text-tool-doc hover:bg-tool-doc/25 flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60"
                  disabled={!hasPdfUrl}
                >
                  <Eye size={16} />
                  <span>Open in New Tab</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={async () => {
                    if (!hasPdfUrl) return
                    const resolvedUrl =
                      needsMaterialization && !materializedPdfUrl
                        ? ((await ensureMaterializedPdfUrl()) ?? pdfUrl)
                        : effectivePdfUrl
                    const link = document.createElement("a")
                    link.href = resolvedUrl
                    link.download = `${pdfFilename}.pdf`
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                  }}
                  className="bg-muted text-foreground hover:bg-muted/80 flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60"
                  disabled={!hasPdfUrl}
                >
                  <ArrowDownTray size={16} />
                  <span>Download</span>
                </motion.button>
              </div>

              {showInlinePdf ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-border bg-muted/40 rounded-lg border p-4"
                >
                  {needsMaterialization ? (
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-muted-foreground flex items-center gap-2 text-xs">
                        {materializingPdf ? <Clock size={12} /> : null}
                        <span>
                          {materializingPdf
                            ? "Loading PDF..."
                            : materializeError
                              ? "Could not load PDF inline."
                              : "PDF ready."}
                        </span>
                      </div>
                      {!materializedPdfUrl && !materializingPdf ? (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => void ensureMaterializedPdfUrl()}
                          className="bg-muted text-foreground hover:bg-muted/80 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                        >
                          Retry
                        </motion.button>
                      ) : null}
                    </div>
                  ) : null}

                  <div
                    className="border-border bg-background rounded border"
                    style={{ height: "600px" }}
                  >
                    {inlineIframeUrl ? (
                      <iframe
                        src={inlineIframeUrl}
                        width="100%"
                        height="100%"
                        style={{ border: "none" }}
                        title={`PDF: ${pdfFilename}.pdf`}
                      >
                        <p>
                          Your browser does not support PDFs.{" "}
                          <a href={effectivePdfUrl} target="_blank" rel="noopener noreferrer">
                            Download the PDF
                          </a>
                          .
                        </p>
                      </iframe>
                    ) : (
                      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                        {materializingPdf ? "Loading PDF..." : "PDF preview unavailable."}
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : null}

              <div className="bg-muted/40 rounded-lg p-3">
                <div className="text-muted-foreground text-sm wrap-break-word">
                  <p>
                    <strong>File:</strong> {pdfFilename}.pdf
                  </p>
                  <p>
                    <strong>Status:</strong>{" "}
                    {isDegraded ? "Fallback PDF generated" : "PDF generated successfully"}
                  </p>
                  {result.engine ? (
                    <p>
                      <strong>Renderer:</strong> {result.engine}
                    </p>
                  ) : null}
                  <p>
                    <strong>URL:</strong> <code>{pdfUrl}</code>
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="border-destructive/30 bg-destructive/10 rounded-lg border p-4">
                <h4 className="text-destructive mb-2 text-sm font-semibold">
                  {isLegacyLatexEngineError
                    ? "LaTeX Engine Unavailable"
                    : "LaTeX Compilation Failed"}
                </h4>
                {isLegacyLatexEngineError ? (
                  <p className="text-foreground mb-3 text-sm">
                    This result came from an older run that stopped when no TeX engine was
                    installed. New runs now fall back to a preview PDF instead of hard-failing.
                  </p>
                ) : null}
                {result.error ? (
                  <div className="border-destructive/30 bg-destructive/10 text-destructive overflow-x-auto rounded border p-3 font-mono text-sm">
                    <pre className="whitespace-pre-wrap">{result.error}</pre>
                  </div>
                ) : null}
              </div>

              {result.output ? (
                <div className="bg-muted/40 rounded-lg p-4">
                  <h4 className="text-foreground mb-2 text-sm font-semibold">LaTeX Output</h4>
                  <div className="border-border bg-background text-muted-foreground max-h-48 overflow-x-auto overflow-y-auto rounded border p-3 font-mono text-xs">
                    <pre className="whitespace-pre-wrap">{result.output}</pre>
                  </div>
                </div>
              ) : null}
            </>
          )}

          {result.texContent ? (
            <div className="border-border border-t pt-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowLatexSource(!showLatexSource)}
                className="text-muted-foreground hover:text-foreground flex items-center space-x-2 text-sm transition-colors"
              >
                <CodeBracket size={16} />
                <span>{showLatexSource ? "Hide" : "Show"} LaTeX Source</span>
              </motion.button>

              {showLatexSource ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-border bg-muted/40 mt-3 rounded-lg border p-4"
                >
                  <div className="text-muted-foreground max-h-64 overflow-x-auto overflow-y-auto font-mono text-xs">
                    <pre className="whitespace-pre-wrap">{result.texContent}</pre>
                  </div>
                </motion.div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
