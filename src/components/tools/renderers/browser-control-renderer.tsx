"use client"

import React, { useEffect, useRef, useState } from "react"

import { ClickableImage } from "@/components/ui/image-lightbox"
import { ChevronDoubleRight, CursorArrowRays as MousePointer, Eye, Type } from "@/lib/icons"

import { BrowserShell } from "./browser-shell"
import {
  CopyButton,
  EmptyState,
  RawPayloadDisclosure,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { ToolResultContentPart } from "./tool-result-renderer"

export const BrowserControlRenderer: React.FC<{
  part: ToolResultContentPart
  onAction?: (action: string, data: unknown) => void
}> = ({ part }) => {
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null)
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  const { toolResult, toolInput } = part
  const thought = toolResult?.thought || toolInput?.thought || ""
  const step = toolResult?.step || toolInput?.step || toolResult?.action || ""
  const action = toolResult?.action || toolInput?.action || ""
  const status: string = toolResult?.status || "success"
  const screenshot = toolResult?.screenshot || toolResult?.image || toolInput?.screenshot

  useEffect(() => {
    if (!toolResult) return
    const { startX, startY, x, y } = toolResult
    const cx = startX ?? x
    const cy = startY ?? y
    if (typeof cx === "number" && typeof cy === "number") setMousePosition({ x: cx, y: cy })
  }, [toolResult])

  if (!thought && !step && !action && !screenshot) {
    return <EmptyState>Browser control details unavailable</EmptyState>
  }

  const isSuccess = status === "success"

  return (
    <div className="w-full min-w-0 space-y-2">
      {/* Screenshot */}
      {screenshot && (
        <BrowserShell className="mb-2">
          <div className="relative">
            <ClickableImage
              ref={imageRef}
              src={screenshot}
              alt="Browser screenshot"
              className="h-auto w-full object-contain"
              onLoad={() => {
                if (imageRef.current)
                  setImageSize({
                    width: imageRef.current.naturalWidth,
                    height: imageRef.current.naturalHeight,
                  })
              }}
            />
            {mousePosition && imageSize && (
              <div
                className="pointer-events-none absolute"
                style={{
                  left: `${(mousePosition.x / imageSize.width) * 100}%`,
                  top: `${(mousePosition.y / imageSize.height) * 100}%`,
                  transform: "translate(-50%, -50%)",
                  zIndex: 10,
                }}
              >
                <div className="bg-tool-action h-2.5 w-2.5 rounded-full opacity-90 ring-2 ring-white/50" />
              </div>
            )}
          </div>
        </BrowserShell>
      )}

      {/* Operation card */}
      <ToolRendererShell
        header={
          <>
            <MousePointer className="text-tool-action h-3.5 w-3.5 shrink-0" />
            <span className="text-foreground min-w-0 flex-1 truncate font-mono text-[11px] font-semibold">
              GUI Agent Operation
            </span>
            <ToolStatusBadge variant={isSuccess ? "success" : "error"}>
              {isSuccess ? "success" : "failed"}
            </ToolStatusBadge>
          </>
        }
        footer={<RawPayloadDisclosure payload={toolResult ?? toolInput} />}
      >
        <div className="divide-y">
          {thought && (
            <div className="flex items-start gap-2 px-3 py-2">
              <Eye className="text-tool-action mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0">
                <span className="rk-section-label mb-0.5 block">Thought</span>
                <p className="text-foreground/80 font-mono text-[11px] leading-relaxed">
                  {thought}
                </p>
              </div>
            </div>
          )}
          {step && (
            <div className="flex items-start gap-2 px-3 py-2">
              <ChevronDoubleRight className="text-tool-action mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0">
                <span className="rk-section-label mb-0.5 block">Action</span>
                <p className="text-foreground/80 font-mono text-[11px] leading-relaxed">{step}</p>
              </div>
            </div>
          )}
          {action && (
            <div className="flex items-start gap-2 px-3 py-2">
              <Type className="text-tool-action mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between">
                  <span className="rk-section-label">Command</span>
                  <CopyButton text={String(action)} />
                </div>
                <pre className="text-foreground/80 bg-surface-4 rounded px-2 py-1 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap">
                  {action}
                </pre>
              </div>
            </div>
          )}
        </div>
      </ToolRendererShell>
    </div>
  )
}
