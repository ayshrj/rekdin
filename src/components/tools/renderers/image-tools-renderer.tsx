"use client"

import {
  EmptyState,
  ErrorBanner,
  RawPayloadDisclosure,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

function toImgSrc(url: string | undefined): string | undefined {
  if (!url) return undefined
  if (url.startsWith("data:") || url.startsWith("http") || url.startsWith("/")) return url
  return undefined
}

// ── ImageResizeRenderer ───────────────────────────────────────────────────────

export function ImageResizeRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined

  const error = result?.error ? String(result.error) : undefined
  if (error) {
    return (
      <ToolRendererShell
        header={
          <span className="text-foreground font-mono text-[11px] font-semibold">Image Resize</span>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        <ErrorBanner>{error}</ErrorBanner>
      </ToolRendererShell>
    )
  }

  const url = result?.url ? String(result.url) : undefined
  const imgSrc = toImgSrc(url)
  const originalWidth = typeof result?.originalWidth === "number" ? result.originalWidth : undefined
  const originalHeight =
    typeof result?.originalHeight === "number" ? result.originalHeight : undefined
  const newWidth = typeof result?.width === "number" ? result.width : undefined
  const newHeight = typeof result?.height === "number" ? result.height : undefined
  const format = result?.format ? String(result.format) : undefined

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Image Resize</span>
          {originalWidth != null && originalHeight != null && (
            <span className="text-muted-foreground font-mono text-[10px]">
              {originalWidth}×{originalHeight}
            </span>
          )}
          {(originalWidth != null || originalHeight != null) && (
            <span className="text-muted-foreground font-mono text-[10px]">→</span>
          )}
          {newWidth != null && newHeight != null && (
            <ToolStatusBadge variant="success">
              {newWidth}×{newHeight}
            </ToolStatusBadge>
          )}
          {format && <span className="rk-path-chip shrink-0">{format}</span>}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {imgSrc ? (
        <div className="flex justify-center p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgSrc}
            alt="Resized"
            className="max-h-[40vh] max-w-full rounded object-contain"
          />
        </div>
      ) : (
        <EmptyState>No image output</EmptyState>
      )}
    </ToolRendererShell>
  )
}

// ── ImageCropRenderer ─────────────────────────────────────────────────────────

export function ImageCropRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined

  const error = result?.error ? String(result.error) : undefined
  if (error) {
    return (
      <ToolRendererShell
        header={
          <span className="text-foreground font-mono text-[11px] font-semibold">Image Crop</span>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        <ErrorBanner>{error}</ErrorBanner>
      </ToolRendererShell>
    )
  }

  const url = result?.url ? String(result.url) : undefined
  const imgSrc = toImgSrc(url)
  const left = typeof result?.left === "number" ? result.left : undefined
  const top = typeof result?.top === "number" ? result.top : undefined
  const width = typeof result?.width === "number" ? result.width : undefined
  const height = typeof result?.height === "number" ? result.height : undefined

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Image Crop</span>
          {left != null && top != null && (
            <span className="text-muted-foreground font-mono text-[10px]">
              @{left},{top}
            </span>
          )}
          {width != null && height != null && (
            <ToolStatusBadge variant="success">
              {width}×{height}
            </ToolStatusBadge>
          )}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {imgSrc ? (
        <div className="flex justify-center p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgSrc}
            alt="Cropped"
            className="max-h-[40vh] max-w-full rounded object-contain"
          />
        </div>
      ) : (
        <EmptyState>No image output</EmptyState>
      )}
    </ToolRendererShell>
  )
}
