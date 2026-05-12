"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"

import { ArrowDownTray, Check, Clock, CodeBracket, Eye, File, XMark } from "@/lib/icons"

import {
  EmptyState,
  RawPayloadDisclosure,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { ToolResultContentPart } from "./tool-result-renderer"

export const PdfRenderer: React.FC<{
  part: ToolResultContentPart
  onAction?: (action: string, data: unknown) => void
}> = ({ part }) => {
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
  const pdfFilename: string = result?.filename || "document"
  const pdfUrl: string = result?.artifactUrl || result?.cloudinaryUrl || result?.dataUrl || ""
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = new Blob([await res.arrayBuffer()], { type: "application/pdf" })
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
    if (showInlinePdf) void ensureMaterializedPdfUrl()
  }, [ensureMaterializedPdfUrl, showInlinePdf])

  useEffect(() => {
    return () => {
      if (materializedPdfUrl) URL.revokeObjectURL(materializedPdfUrl)
    }
  }, [materializedPdfUrl])

  const effectivePdfUrl = materializedPdfUrl || pdfUrl
  const inlineIframeUrl = needsMaterialization ? materializedPdfUrl || "" : pdfUrl

  if (!part || !result) {
    return <EmptyState>No PDF data available</EmptyState>
  }

  const statusVariant = isSuccess ? "success" : isDegraded ? "warning" : "error"

  // ─── Compact action button (smaller than rk-flat-button) ─────────────────
  const ActionBtn = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      className="text-muted-foreground hover:text-foreground bg-surface-4 hover:bg-surface-5 inline-flex h-7 items-center gap-1.5 rounded border px-2.5 font-mono text-[10px] transition-colors duration-150"
    >
      {children}
    </button>
  )

  return (
    <ToolRendererShell
      header={
        <>
          <File
            className={`h-3.5 w-3.5 shrink-0 ${isSuccess ? "text-tool-doc" : "text-destructive"}`}
          />
          <span className="text-foreground font-mono text-[11px] font-semibold">
            {part.toolName === "markdown_to_pdf" ? "Markdown → PDF" : "LaTeX → PDF"}
          </span>
          <span className="text-muted-foreground min-w-0 truncate font-mono text-[10px]">
            {pdfFilename}.pdf
          </span>
          <div className="ml-auto flex items-center gap-2">
            {result.duration && (
              <span className="text-muted-foreground flex items-center gap-1 font-mono text-[10px]">
                <Clock className="h-3 w-3" />
                {(result.duration / 1000).toFixed(1)}s
              </span>
            )}
            <ToolStatusBadge variant={statusVariant}>
              {isSuccess || isDegraded ? (
                <Check className="h-3 w-3" />
              ) : (
                <XMark className="h-3 w-3" />
              )}
              {isSuccess ? "success" : isDegraded ? "fallback" : "failed"}
            </ToolStatusBadge>
          </div>
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {/* ── Degraded notice ── */}
      {isDegraded && result.error && (
        <div className="border-b px-3 py-2">
          <p className="text-status-warning font-mono text-[11px]">{result.error}</p>
        </div>
      )}

      {/* ── Success / degraded: actions ── */}
      {(isSuccess || isDegraded) && hasPdfUrl && (
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
          <ActionBtn onClick={() => setShowInlinePdf((v) => !v)}>
            <Eye className="h-3 w-3" />
            {showInlinePdf ? "Hide" : "Preview"}
          </ActionBtn>
          <ActionBtn
            onClick={async () => {
              const url =
                needsMaterialization && !materializedPdfUrl
                  ? ((await ensureMaterializedPdfUrl()) ?? pdfUrl)
                  : effectivePdfUrl
              window.open(url, "_blank", "noopener,noreferrer")
            }}
          >
            <Eye className="h-3 w-3" />
            Open tab
          </ActionBtn>
          <ActionBtn
            onClick={async () => {
              const url =
                needsMaterialization && !materializedPdfUrl
                  ? ((await ensureMaterializedPdfUrl()) ?? pdfUrl)
                  : effectivePdfUrl
              const a = document.createElement("a")
              a.href = url
              a.download = `${pdfFilename}.pdf`
              document.body.appendChild(a)
              a.click()
              document.body.removeChild(a)
            }}
          >
            <ArrowDownTray className="h-3 w-3" />
            Download
          </ActionBtn>
        </div>
      )}

      {/* ── Inline PDF viewer ── */}
      {showInlinePdf && (
        <div className="border-b px-3 py-3">
          {needsMaterialization && !materializedPdfUrl && (
            <div className="text-muted-foreground mb-2 flex items-center gap-2 font-mono text-[10px]">
              {materializingPdf && <Clock className="h-3 w-3" />}
              <span>{materializingPdf ? "Loading PDF…" : materializeError || ""}</span>
              {materializeError && (
                <button
                  type="button"
                  onClick={() => void ensureMaterializedPdfUrl()}
                  className="text-primary hover:underline"
                >
                  Retry
                </button>
              )}
            </div>
          )}
          <div className="overflow-hidden rounded border" style={{ height: 560 }}>
            {inlineIframeUrl ? (
              <iframe
                src={inlineIframeUrl}
                width="100%"
                height="100%"
                style={{ border: "none" }}
                title={`PDF: ${pdfFilename}.pdf`}
              />
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center font-mono text-[11px] italic">
                {materializingPdf ? "Loading…" : "Preview unavailable"}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Metadata ── */}
      {(isSuccess || isDegraded) && (
        <div className="divide-y text-[11px]">
          {[
            { label: "File", value: `${pdfFilename}.pdf` },
            result.engine ? { label: "Renderer", value: result.engine as string } : null,
            { label: "URL", value: pdfUrl, mono: true },
          ]
            .filter(Boolean)
            .map((row) => (
              <div key={row!.label} className="flex gap-3 px-3 py-1.5">
                <span className="text-muted-foreground w-20 shrink-0 font-mono text-[10px]">
                  {row!.label}
                </span>
                <span
                  className={`text-foreground/80 min-w-0 flex-1 break-all ${row!.mono ? "font-mono text-[10px]" : "font-mono text-[11px]"}`}
                >
                  {row!.value}
                </span>
              </div>
            ))}
        </div>
      )}

      {/* ── Error body ── */}
      {!isSuccess && !isDegraded && (
        <>
          <div className="border-b px-3 py-2">
            <p className="text-destructive font-mono text-[11px] font-semibold">
              {isLegacyLatexEngineError
                ? "LaTeX engine unavailable (legacy result)"
                : "LaTeX compilation failed"}
            </p>
          </div>
          {result.error && (
            <pre className="rk-scrollbar text-destructive max-h-[40vh] overflow-auto px-3 py-3 font-mono text-[10px] leading-relaxed whitespace-pre-wrap">
              {result.error}
            </pre>
          )}
          {result.output && (
            <div className="border-t">
              <div className="px-3 py-1.5">
                <span className="rk-section-label">LaTeX output</span>
              </div>
              <pre className="rk-scrollbar text-muted-foreground max-h-48 overflow-auto px-3 pb-3 font-mono text-[10px] leading-relaxed whitespace-pre-wrap">
                {result.output}
              </pre>
            </div>
          )}
        </>
      )}

      {/* ── LaTeX source disclosure ── */}
      {result.texContent && (
        <div className="border-t">
          <button
            type="button"
            onClick={() => setShowLatexSource((v) => !v)}
            className="hover:bg-surface-4 flex w-full items-center gap-1.5 px-3 py-1.5 text-left transition-colors duration-150"
          >
            <CodeBracket className="text-muted-foreground h-3 w-3 shrink-0" />
            <span className="rk-section-label">
              {showLatexSource ? "Hide" : "Show"} LaTeX source
            </span>
          </button>
          {showLatexSource && (
            <pre className="rk-scrollbar text-muted-foreground max-h-64 overflow-auto px-3 pb-3 font-mono text-[10px] leading-relaxed whitespace-pre-wrap">
              {result.texContent}
            </pre>
          )}
        </div>
      )}
    </ToolRendererShell>
  )
}
