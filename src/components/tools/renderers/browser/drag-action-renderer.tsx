"use client"

import { motion } from "motion/react"
import React, { useEffect, useMemo, useRef, useState } from "react"

import { Image } from "@/components/ui/image"
import { ArrowRight, Check, Move, XMark } from "@/lib/icons"

import { BrowserShell } from "../browser-shell"
import { ToolResultContentPart } from "../tool-result-renderer"

interface DragActionRendererProps {
  part: ToolResultContentPart
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAction?: (action: string, data: any) => void
}

export const DragActionRenderer: React.FC<DragActionRendererProps> = ({ part }) => {
  const { toolResult, toolInput } = part
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  const screenshot = toolResult?.screenshot || toolInput?.screenshot
  const status = toolResult?.status || "success"
  const sourceSelector = toolInput?.sourceSelector || toolInput?.source || ""
  const targetSelector = toolInput?.targetSelector || toolInput?.target || ""

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
    ) {
      return { srcX, srcY, tgtX, tgtY }
    }
    return null
  }, [toolResult])

  useEffect(() => {
    if (!imageRef.current) return
    const img = imageRef.current
    const handler = () => setImageSize({ width: img.naturalWidth, height: img.naturalHeight })
    if (img.complete) handler()
  }, [])

  const handleImageLoad = () => {
    if (!imageRef.current) return
    setImageSize({ width: imageRef.current.naturalWidth, height: imageRef.current.naturalHeight })
  }

  return (
    <div className="space-y-4">
      {screenshot ? (
        <BrowserShell>
          <div className="relative">
            <Image
              ref={imageRef}
              src={screenshot}
              alt="Drag action screenshot"
              className="h-auto w-full object-contain"
              onLoad={handleImageLoad}
            />

            {coords && imageSize ? (
              <div className="pointer-events-none absolute inset-0">
                <svg
                  className="h-full w-full"
                  viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
                  preserveAspectRatio="none"
                >
                  <defs>
                    <marker
                      id="arrow"
                      markerWidth="12"
                      markerHeight="12"
                      refX="10"
                      refY="6"
                      orient="auto"
                    >
                      <path d="M0,0 L12,6 L0,12 z" fill="var(--color-tool-action)" />
                    </marker>
                  </defs>
                  <line
                    x1={coords.srcX}
                    y1={coords.srcY}
                    x2={coords.tgtX}
                    y2={coords.tgtY}
                    stroke="var(--color-tool-action)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    markerEnd="url(#arrow)"
                    opacity="0.8"
                  />
                  <circle
                    cx={coords.srcX}
                    cy={coords.srcY}
                    r="8"
                    fill="var(--color-tool-action)"
                    opacity="0.9"
                  />
                  <circle
                    cx={coords.tgtX}
                    cy={coords.tgtY}
                    r="8"
                    fill="var(--color-tool-action)"
                    opacity="0.6"
                  />
                </svg>
              </div>
            ) : null}
          </div>
        </BrowserShell>
      ) : null}

      <div className="border-tool-action/20 bg-card overflow-hidden rounded-xl border shadow-sm">
        <div className="border-tool-action/20 bg-tool-action/10 flex items-center border-b px-4 py-3">
          <Move className="text-tool-action mr-2.5" size={18} />
          <div className="text-foreground font-medium">Drag & Drop</div>
          <div
            className={`ml-auto flex items-center space-x-2 ${status === "success" ? "text-tool-action" : "text-destructive"}`}
          >
            {status === "success" ? <Check size={16} /> : <XMark size={16} />}
            <span className="text-xs font-medium capitalize">{status}</span>
          </div>
        </div>

        <div className="space-y-4 p-4">
          {sourceSelector || targetSelector ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {sourceSelector ? (
                <div>
                  <div className="text-foreground mb-2 flex items-center text-sm font-medium">
                    <div className="bg-tool-action mr-2 h-3 w-3 rounded-full" />
                    Source Element
                  </div>
                  <div className="border-border bg-muted/40 overflow-x-auto rounded-md border p-2 font-mono text-xs">
                    {sourceSelector}
                  </div>
                </div>
              ) : null}

              {targetSelector ? (
                <div>
                  <div className="text-foreground mb-2 flex items-center text-sm font-medium">
                    <div className="bg-tool-action/70 mr-2 h-3 w-3 rounded-full" />
                    Target Element
                  </div>
                  <div className="border-border bg-muted/40 overflow-x-auto rounded-md border p-2 font-mono text-xs">
                    {targetSelector}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {coords ? (
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="border-tool-action/20 bg-tool-action/5 rounded border p-2">
                <div className="text-foreground mb-1 font-medium">Source Position</div>
                <div className="text-muted-foreground font-mono">
                  x: {coords.srcX}, y: {coords.srcY}
                </div>
              </div>
              <div className="border-tool-action/20 bg-tool-action/5 rounded border p-2">
                <div className="text-foreground mb-1 font-medium">Target Position</div>
                <div className="text-muted-foreground font-mono">
                  x: {coords.tgtX}, y: {coords.tgtY}
                </div>
              </div>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="border-tool-action/20 bg-tool-action/5 rounded-lg border p-3 text-sm"
            >
              <div className="flex items-center justify-center space-x-3">
                <span className="text-foreground font-medium">Source</span>
                <ArrowRight className="text-tool-action" />
                <span className="text-foreground font-medium">Target</span>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
