"use client"

import {
  CopyButton,
  EmptyState,
  RawPayloadDisclosure,
  ToolMetaRow,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function ImageAnalysisRenderer({ part }: { part: ToolResultContentPart }) {
  const type = part.type
  const result = part.toolResult as Record<string, unknown> | undefined

  // ── image_ocr ──────────────────────────────────────────────────────────────
  if (type === "image_ocr") {
    const text = (result?.text ?? result?.content ?? result?.output ?? "") as string
    const confidence =
      typeof result?.confidence === "number"
        ? result.confidence
        : typeof result?.score === "number"
          ? result.score
          : null
    const language = (result?.language ?? result?.lang ?? "") as string
    const filePath = (result?.file ?? result?.path ?? result?.source ?? "") as string

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">OCR</span>
            {filePath && <span className="rk-path-chip max-w-40 min-w-0 truncate">{filePath}</span>}
            {language && (
              <span className="text-muted-foreground border-border bg-surface-4 shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px]">
                {language}
              </span>
            )}
            {confidence != null && (
              <ToolStatusBadge
                variant={confidence >= 0.8 ? "success" : confidence >= 0.5 ? "warning" : "error"}
              >
                {Math.round(confidence * 100)}% confidence
              </ToolStatusBadge>
            )}
            {text && <CopyButton text={text} className="ml-auto" />}
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {!text ? (
          <EmptyState>No text extracted</EmptyState>
        ) : (
          <pre className="rk-scrollbar text-foreground/80 max-h-[45vh] overflow-auto px-3 py-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
            {text}
          </pre>
        )}
      </ToolRendererShell>
    )
  }

  // ── image_diff ─────────────────────────────────────────────────────────────
  if (type === "image_diff") {
    const diffPixels =
      typeof result?.diffPixels === "number"
        ? result.diffPixels
        : typeof result?.changedPixels === "number"
          ? result.changedPixels
          : null
    const totalPixels = typeof result?.totalPixels === "number" ? result.totalPixels : null
    const changedPct =
      typeof result?.changedPercent === "number"
        ? result.changedPercent
        : typeof result?.percentage === "number"
          ? result.percentage
          : diffPixels != null && totalPixels != null && totalPixels > 0
            ? (diffPixels / totalPixels) * 100
            : null

    const identical = changedPct != null ? changedPct === 0 : Boolean(result?.identical)
    const threshold = typeof result?.threshold === "number" ? result.threshold : null

    const bbox = result?.boundingBox ?? result?.bbox ?? result?.region
    const bboxStr =
      bbox && typeof bbox === "object"
        ? (() => {
            const b = bbox as Record<string, unknown>
            return `(${b.x ?? b.left ?? 0}, ${b.y ?? b.top ?? 0}) ${b.width ?? b.w ?? "?"}×${b.height ?? b.h ?? "?"}`
          })()
        : null

    const variant = identical
      ? "success"
      : changedPct != null && changedPct > 5
        ? "error"
        : "warning"

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">Image Diff</span>
            <ToolStatusBadge variant={variant}>
              {identical
                ? "identical"
                : changedPct != null
                  ? `${changedPct.toFixed(2)}% changed`
                  : "differs"}
            </ToolStatusBadge>
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {!result ? (
          <EmptyState>No diff data</EmptyState>
        ) : (
          <div className="divide-y">
            {changedPct != null && (
              <div className="px-3 py-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-muted-foreground font-mono text-[10px]">
                    changed pixels
                  </span>
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {changedPct.toFixed(2)}%
                  </span>
                </div>
                <div className="bg-surface-4 h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className={`h-full rounded-full ${identical ? "bg-emerald-500" : changedPct > 5 ? "bg-destructive" : "bg-amber-500"}`}
                    style={{ width: `${Math.min(100, changedPct)}%` }}
                  />
                </div>
              </div>
            )}
            {diffPixels != null && (
              <ToolMetaRow label="diff pixels" mono>
                {diffPixels.toLocaleString()}
              </ToolMetaRow>
            )}
            {totalPixels != null && (
              <ToolMetaRow label="total pixels" mono>
                {totalPixels.toLocaleString()}
              </ToolMetaRow>
            )}
            {threshold != null && (
              <ToolMetaRow label="threshold" mono>
                {threshold}
              </ToolMetaRow>
            )}
            {bboxStr && (
              <ToolMetaRow label="changed region" mono>
                {bboxStr}
              </ToolMetaRow>
            )}
          </div>
        )}
      </ToolRendererShell>
    )
  }

  // ── svg_optimize ───────────────────────────────────────────────────────────
  if (type === "svg_optimize") {
    const originalSize =
      typeof result?.originalSize === "number"
        ? result.originalSize
        : typeof result?.inputSize === "number"
          ? result.inputSize
          : null
    const optimizedSize =
      typeof result?.optimizedSize === "number"
        ? result.optimizedSize
        : typeof result?.outputSize === "number"
          ? result.outputSize
          : null
    const savings =
      typeof result?.savings === "number"
        ? result.savings
        : originalSize != null && optimizedSize != null
          ? originalSize - optimizedSize
          : null
    const savingsPct =
      typeof result?.savingsPercent === "number"
        ? result.savingsPercent
        : originalSize != null && savings != null && originalSize > 0
          ? (savings / originalSize) * 100
          : null
    const svgContent = (result?.svg ?? result?.optimizedSvg ?? result?.output ?? "") as string
    const filePath = (result?.file ?? result?.path ?? "") as string

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">
              SVG Optimize
            </span>
            {filePath && <span className="rk-path-chip max-w-40 min-w-0 truncate">{filePath}</span>}
            {savingsPct != null && (
              <ToolStatusBadge variant="success">-{savingsPct.toFixed(1)}% smaller</ToolStatusBadge>
            )}
            {svgContent && <CopyButton text={svgContent} className="ml-auto" />}
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {!result ? (
          <EmptyState>No optimization data</EmptyState>
        ) : (
          <div className="divide-y">
            {originalSize != null && (
              <ToolMetaRow label="original" mono>
                {formatBytes(originalSize)}
              </ToolMetaRow>
            )}
            {optimizedSize != null && (
              <ToolMetaRow label="optimized" mono>
                {formatBytes(optimizedSize)}
              </ToolMetaRow>
            )}
            {savings != null && savings > 0 && (
              <ToolMetaRow label="saved" mono>
                {formatBytes(savings)}
              </ToolMetaRow>
            )}
            {svgContent && (
              <div className="px-3 py-2">
                <span className="rk-section-label mb-1.5 block">Optimized SVG</span>
                <pre className="rk-scrollbar text-foreground/70 bg-surface-4 max-h-[30vh] overflow-auto rounded px-2 py-2 font-mono text-[10px] leading-relaxed whitespace-pre-wrap">
                  {svgContent.length > 2000 ? svgContent.slice(0, 2000) + "\n…" : svgContent}
                </pre>
              </div>
            )}
          </div>
        )}
      </ToolRendererShell>
    )
  }

  return <EmptyState>Unknown image analysis type</EmptyState>
}
