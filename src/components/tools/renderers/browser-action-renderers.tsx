/**
 * browser/index.ts  —  all six browser action renderers
 *
 * Every renderer follows the same structure:
 *   1. Optional BrowserShell screenshot with static coordinate overlay
 *   2. ToolRendererShell with:
 *        header  — accent icon · title · ToolStatusBadge
 *        body    — divide-y rows using MonoField / CoordRow
 *        footer  — RawPayloadDisclosure
 *
 * No framer-motion. No custom status color strings.
 * All text sizes: header title font-mono text-[11px] font-semibold,
 *                 body    font-mono text-[11px], meta rk-section-label.
 */

"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"

import { ClickableImage } from "@/components/ui/image-lightbox"
import {
  ArrowDownTray,
  ArrowRight,
  Check,
  Clock,
  CursorArrowRays as MousePointer,
  Move,
  PencilSquare as Edit3,
  XMark,
} from "@/lib/icons"

import { BrowserShell } from "./browser-shell"
import {
  CoordRow,
  CopyButton,
  EmptyState,
  MonoField,
  RawPayloadDisclosure,
  RendererTab,
  RendererTabBar,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { SimpleCodeEditor } from "./simple-code-editor"
import { ToolResultContentPart } from "./tool-result-renderer"

// ─── Shared status badge inside an action header ─────────────────────────────

function ActionStatusBadge({ status }: { status: string }) {
  return (
    <ToolStatusBadge variant={status === "success" ? "success" : "error"}>
      {status === "success" ? <Check className="h-3 w-3" /> : <XMark className="h-3 w-3" />}
      {status}
    </ToolStatusBadge>
  )
}

// ─── ClickActionRenderer ─────────────────────────────────────────────────────

export const ClickActionRenderer: React.FC<{
  part: ToolResultContentPart
  onAction?: (action: string, data: unknown) => void
}> = ({ part }) => {
  const { toolResult, toolInput, toolName } = part
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)
  const [imgSize, setImgSize] = useState<{ width: number; height: number } | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const screenshot = toolResult?.screenshot || toolInput?.screenshot
  const status: string = toolResult?.status || "success"
  const element: string = toolInput?.element || toolInput?.selector || ""

  const label = toolName?.includes("double")
    ? "Double Click"
    : toolName?.includes("right")
      ? "Right Click"
      : "Click"

  useEffect(() => {
    if (!toolResult) return
    const cx = toolResult.startX ?? toolResult.x
    const cy = toolResult.startY ?? toolResult.y
    if (typeof cx === "number" && typeof cy === "number") setMousePos({ x: cx, y: cy })
  }, [toolResult])

  return (
    <div className="w-full min-w-0 space-y-2">
      {screenshot && (
        <BrowserShell>
          <div className="relative">
            <ClickableImage
              ref={imgRef}
              src={screenshot}
              alt="Click action"
              className="h-auto w-full object-contain"
              onLoad={() => {
                if (imgRef.current)
                  setImgSize({
                    width: imgRef.current.naturalWidth,
                    height: imgRef.current.naturalHeight,
                  })
              }}
            />
            {mousePos && imgSize && (
              <div
                className="pointer-events-none absolute"
                style={{
                  left: `${(mousePos.x / imgSize.width) * 100}%`,
                  top: `${(mousePos.y / imgSize.height) * 100}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <div className="bg-tool-action h-3 w-3 rounded-full opacity-90 ring-2 ring-white/50" />
              </div>
            )}
          </div>
        </BrowserShell>
      )}

      <ToolRendererShell
        header={
          <>
            <MousePointer className="text-tool-action h-3.5 w-3.5 shrink-0" />
            <span className="text-foreground min-w-0 flex-1 truncate font-mono text-[11px] font-semibold">
              {label}
            </span>
            <ActionStatusBadge status={status} />
          </>
        }
        footer={<RawPayloadDisclosure payload={toolResult ?? toolInput} />}
      >
        <div className="divide-y">
          {element && <MonoField label="Target element" value={element} />}
          {mousePos && <CoordRow label="Coordinates" x={mousePos.x} y={mousePos.y} />}
          {!element && !mousePos && <EmptyState>No coordinates or selector</EmptyState>}
        </div>
      </ToolRendererShell>
    </div>
  )
}

// ─── HoverActionRenderer ──────────────────────────────────────────────────────

export const HoverActionRenderer: React.FC<{
  part: ToolResultContentPart
  onAction?: (action: string, data: unknown) => void
}> = ({ part }) => {
  const { toolResult, toolInput } = part
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)
  const [imgSize, setImgSize] = useState<{ width: number; height: number } | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const screenshot = toolResult?.screenshot || toolInput?.screenshot
  const status: string = toolResult?.status || "success"
  const element: string = toolInput?.element || toolInput?.selector || ""

  useEffect(() => {
    if (!toolResult) return
    const cx = toolResult.startX ?? toolResult.x
    const cy = toolResult.startY ?? toolResult.y
    if (typeof cx === "number" && typeof cy === "number") setMousePos({ x: cx, y: cy })
  }, [toolResult])

  return (
    <div className="w-full min-w-0 space-y-2">
      {screenshot && (
        <BrowserShell>
          <div className="relative">
            <ClickableImage
              ref={imgRef}
              src={screenshot}
              alt="Hover action"
              className="h-auto w-full object-contain"
              onLoad={() => {
                if (imgRef.current)
                  setImgSize({
                    width: imgRef.current.naturalWidth,
                    height: imgRef.current.naturalHeight,
                  })
              }}
            />
            {mousePos && imgSize && (
              <div
                className="pointer-events-none absolute"
                style={{
                  left: `${(mousePos.x / imgSize.width) * 100}%`,
                  top: `${(mousePos.y / imgSize.height) * 100}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                {/* Hover ring — distinct from click dot */}
                <div className="h-5 w-5 rounded-full border border-(--tool-action)/60 bg-[color-mix(in_srgb,var(--tool-action)_15%,transparent)]" />
              </div>
            )}
          </div>
        </BrowserShell>
      )}

      <ToolRendererShell
        header={
          <>
            <MousePointer className="text-tool-action h-3.5 w-3.5 shrink-0" />
            <span className="text-foreground min-w-0 flex-1 truncate font-mono text-[11px] font-semibold">
              Hover
            </span>
            <ActionStatusBadge status={status} />
          </>
        }
        footer={<RawPayloadDisclosure payload={toolResult ?? toolInput} />}
      >
        <div className="divide-y">
          {element && <MonoField label="Target element" value={element} />}
          {mousePos && <CoordRow label="Position" x={mousePos.x} y={mousePos.y} />}
          {!element && !mousePos && <EmptyState>No position data</EmptyState>}
        </div>
      </ToolRendererShell>
    </div>
  )
}

// ─── DragActionRenderer ───────────────────────────────────────────────────────

export const DragActionRenderer: React.FC<{
  part: ToolResultContentPart
  onAction?: (action: string, data: unknown) => void
}> = ({ part }) => {
  const { toolResult, toolInput } = part
  const [imgSize, setImgSize] = useState<{ width: number; height: number } | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const screenshot = toolResult?.screenshot || toolInput?.screenshot
  const status: string = toolResult?.status || "success"
  const srcSelector: string = toolInput?.sourceSelector || toolInput?.source || ""
  const tgtSelector: string = toolInput?.targetSelector || toolInput?.target || ""

  const coords = useMemo(() => {
    const srcX = toolResult?.sourceX ?? toolResult?.startX ?? toolResult?.x ?? null
    const srcY = toolResult?.sourceY ?? toolResult?.startY ?? toolResult?.y ?? null
    const tgtX = toolResult?.targetX ?? toolResult?.endX ?? null
    const tgtY = toolResult?.targetY ?? toolResult?.endY ?? null
    if (
      typeof srcX === "number" &&
      typeof srcY === "number" &&
      typeof tgtX === "number" &&
      typeof tgtY === "number"
    )
      return { srcX, srcY, tgtX, tgtY }
    return null
  }, [toolResult])

  return (
    <div className="w-full min-w-0 space-y-2">
      {screenshot && (
        <BrowserShell>
          <div className="relative">
            <ClickableImage
              ref={imgRef}
              src={screenshot}
              alt="Drag action"
              className="h-auto w-full object-contain"
              onLoad={() => {
                if (imgRef.current)
                  setImgSize({
                    width: imgRef.current.naturalWidth,
                    height: imgRef.current.naturalHeight,
                  })
              }}
            />
            {coords && imgSize && (
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox={`0 0 ${imgSize.width} ${imgSize.height}`}
                preserveAspectRatio="none"
              >
                <defs>
                  <marker
                    id="drag-arrow"
                    markerWidth="8"
                    markerHeight="8"
                    refX="6"
                    refY="4"
                    orient="auto"
                  >
                    <path d="M0,0 L8,4 L0,8 z" fill="var(--tool-action)" opacity="0.8" />
                  </marker>
                </defs>
                <line
                  x1={coords.srcX}
                  y1={coords.srcY}
                  x2={coords.tgtX}
                  y2={coords.tgtY}
                  stroke="var(--tool-action)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  markerEnd="url(#drag-arrow)"
                  opacity="0.8"
                />
                <circle
                  cx={coords.srcX}
                  cy={coords.srcY}
                  r="5"
                  fill="var(--tool-action)"
                  opacity="0.9"
                />
                <circle
                  cx={coords.tgtX}
                  cy={coords.tgtY}
                  r="5"
                  fill="var(--tool-action)"
                  opacity="0.6"
                />
              </svg>
            )}
          </div>
        </BrowserShell>
      )}

      <ToolRendererShell
        header={
          <>
            <Move className="text-tool-action h-3.5 w-3.5 shrink-0" />
            <span className="text-foreground min-w-0 flex-1 truncate font-mono text-[11px] font-semibold">
              Drag &amp; Drop
            </span>
            <ActionStatusBadge status={status} />
          </>
        }
        footer={<RawPayloadDisclosure payload={toolResult ?? toolInput} />}
      >
        <div className="divide-y">
          {srcSelector && <MonoField label="Source" value={srcSelector} />}
          {tgtSelector && <MonoField label="Target" value={tgtSelector} />}
          {coords ? (
            <>
              <CoordRow label="From" x={coords.srcX} y={coords.srcY} />
              <CoordRow label="To" x={coords.tgtX} y={coords.tgtY} />
            </>
          ) : (
            !srcSelector &&
            !tgtSelector && (
              <div className="text-muted-foreground flex items-center justify-center gap-3 px-3 py-3 font-mono text-[11px]">
                Source <ArrowRight className="h-3 w-3" /> Target
              </div>
            )
          )}
        </div>
      </ToolRendererShell>
    </div>
  )
}

// ─── FormFillRenderer ─────────────────────────────────────────────────────────

export const FormFillRenderer: React.FC<{
  part: ToolResultContentPart
  onAction?: (action: string, data: unknown) => void
}> = ({ part }) => {
  const { toolResult, toolInput } = part
  const screenshot = toolResult?.screenshot || toolInput?.screenshot
  const selector: string = toolInput?.selector || toolInput?.element || ""
  const value: string = toolInput?.value || toolInput?.text || ""
  const status: string = toolResult?.status || "success"

  return (
    <div className="w-full min-w-0 space-y-2">
      {screenshot && (
        <BrowserShell>
          <ClickableImage
            src={screenshot}
            alt="Form fill"
            className="h-auto w-full object-contain"
          />
        </BrowserShell>
      )}

      <ToolRendererShell
        header={
          <>
            <Edit3 className="text-tool-action h-3.5 w-3.5 shrink-0" />
            <span className="text-foreground min-w-0 flex-1 truncate font-mono text-[11px] font-semibold">
              Form Input
            </span>
            <ActionStatusBadge status={status} />
          </>
        }
        footer={<RawPayloadDisclosure payload={toolResult ?? toolInput} />}
      >
        <div className="divide-y">
          {selector && <MonoField label="Target element" value={selector} />}
          {value && (
            <div className="px-3 py-2">
              <span className="rk-section-label mb-1 block">Value</span>
              <span className="text-foreground/80 font-mono text-[11px]">&quot;{value}&quot;</span>
            </div>
          )}
          {!selector && !value && <EmptyState>No input data</EmptyState>}
        </div>
      </ToolRendererShell>
    </div>
  )
}

// ─── WaitActionRenderer ───────────────────────────────────────────────────────

export const WaitActionRenderer: React.FC<{
  part: ToolResultContentPart
  onAction?: (action: string, data: unknown) => void
}> = ({ part }) => {
  const { toolResult, toolInput } = part
  const screenshot = toolResult?.screenshot || toolInput?.screenshot
  const duration = toolInput?.duration || toolInput?.timeout || toolResult?.duration
  const condition: string = toolInput?.condition || toolInput?.for || toolResult?.condition || ""
  const status: string = toolResult?.status || "success"

  return (
    <div className="w-full min-w-0 space-y-2">
      {screenshot && (
        <BrowserShell>
          <ClickableImage
            src={screenshot}
            alt="Wait action"
            className="h-auto w-full object-contain"
          />
        </BrowserShell>
      )}

      <ToolRendererShell
        header={
          <>
            <Clock className="text-tool-action h-3.5 w-3.5 shrink-0" />
            <span className="text-foreground min-w-0 flex-1 truncate font-mono text-[11px] font-semibold">
              Wait
            </span>
            <ActionStatusBadge status={status} />
          </>
        }
        footer={<RawPayloadDisclosure payload={toolResult ?? toolInput} />}
      >
        <div className="divide-y">
          {duration && (
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="rk-section-label w-24 shrink-0">Duration</span>
              <span className="text-foreground/80 font-mono text-[11px]">{duration}s</span>
            </div>
          )}
          {condition && (
            <div className="px-3 py-2">
              <span className="rk-section-label mb-1 block">Condition</span>
              <p className="text-foreground/80 font-mono text-[11px] leading-relaxed">
                {condition}
              </p>
            </div>
          )}
          {!duration && !condition && <EmptyState>Waiting for page to settle…</EmptyState>}
        </div>
      </ToolRendererShell>
    </div>
  )
}

// ─── DataExtractionRenderer ───────────────────────────────────────────────────

export const DataExtractionRenderer: React.FC<{
  part: ToolResultContentPart
  onAction?: (action: string, data: unknown) => void
}> = ({ part }) => {
  const { toolResult, toolInput } = part
  const [activeTab, setActiveTab] = useState<"data" | "raw">("data")

  const screenshot = toolResult?.screenshot || toolInput?.screenshot
  const status: string = toolResult?.status || "success"
  const selector: string = toolInput?.selector || toolInput?.element || ""
  const extractionType: string = toolInput?.type || "text"
  const extractedData =
    toolResult?.extractedData || toolResult?.data || toolResult?.text || toolResult?.content

  const copyText =
    extractedData === undefined
      ? ""
      : typeof extractedData === "string"
        ? extractedData
        : JSON.stringify(extractedData, null, 2)

  return (
    <div className="w-full min-w-0 space-y-2">
      {screenshot && (
        <BrowserShell>
          <ClickableImage
            src={screenshot}
            alt="Data extraction"
            className="h-auto w-full object-contain"
          />
        </BrowserShell>
      )}

      <ToolRendererShell
        header={
          <>
            <ArrowDownTray className="text-tool-data h-3.5 w-3.5 shrink-0" />
            <span className="text-foreground min-w-0 flex-1 truncate font-mono text-[11px] font-semibold">
              Data Extraction
            </span>
            <div className="ml-auto flex items-center gap-2">
              <ActionStatusBadge status={status} />
              {copyText && <CopyButton text={copyText} />}
            </div>
          </>
        }
        footer={<RawPayloadDisclosure payload={toolResult ?? toolInput} />}
      >
        {/* Meta row */}
        <div className="flex items-center gap-3 border-b px-3 py-1.5">
          {selector && (
            <div className="flex items-center gap-1.5">
              <span className="rk-section-label">selector</span>
              <span className="rk-path-chip max-w-50 truncate">{selector}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="rk-section-label">type</span>
            <span className="rk-meta-chip">{extractionType}</span>
          </div>
        </div>

        {/* Tab bar */}
        {extractedData !== undefined && (
          <RendererTabBar>
            <RendererTab active={activeTab === "data"} onClick={() => setActiveTab("data")}>
              Extracted Data
            </RendererTab>
            <RendererTab active={activeTab === "raw"} onClick={() => setActiveTab("raw")}>
              Raw JSON
            </RendererTab>
          </RendererTabBar>
        )}

        {/* Body */}
        {extractedData !== undefined ? (
          activeTab === "data" ? (
            <div className="rk-scrollbar max-h-[40vh] overflow-auto px-3 py-2">
              {typeof extractedData === "string" ? (
                <p className="text-foreground/80 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                  {extractedData}
                </p>
              ) : Array.isArray(extractedData) ? (
                <div className="space-y-1">
                  {extractedData.map((item: unknown, i: number) => (
                    <div
                      key={i}
                      className="text-foreground/80 bg-surface-4 rounded px-2 py-1 font-mono text-[11px]"
                    >
                      {typeof item === "string" ? item : JSON.stringify(item)}
                    </div>
                  ))}
                </div>
              ) : (
                <SimpleCodeEditor
                  code={JSON.stringify(extractedData, null, 2)}
                  language="json"
                  fileName="data.json"
                  showHeader={false}
                  maxHeight="300px"
                  readOnly
                  fontSize={12}
                />
              )}
            </div>
          ) : (
            <SimpleCodeEditor
              code={JSON.stringify({ extractedData, selector, extractionType, status }, null, 2)}
              language="json"
              fileName="extraction-result.json"
              showHeader={false}
              maxHeight="300px"
              readOnly
              fontSize={12}
            />
          )
        ) : (
          <EmptyState>No data extracted</EmptyState>
        )}
      </ToolRendererShell>
    </div>
  )
}
