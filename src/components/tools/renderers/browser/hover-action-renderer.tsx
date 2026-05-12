"use client"

import { motion } from "motion/react"
import React, { useEffect, useRef, useState } from "react"

import { ClickableImage } from "@/components/ui/image-lightbox"
import { Check, CursorArrowRays as MousePointer, XMark } from "@/lib/icons"

import { BrowserShell } from "../browser-shell"
import { ToolResultContentPart } from "../tool-result-renderer"

interface HoverActionRendererProps {
  part: ToolResultContentPart
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAction?: (action: string, data: any) => void
}

export const HoverActionRenderer: React.FC<HoverActionRendererProps> = ({ part }) => {
  const { toolResult, toolInput } = part
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null)
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  const screenshot = toolResult?.screenshot || toolInput?.screenshot
  const status = toolResult?.status || "success"
  const element = toolInput?.element || toolInput?.selector || ""

  useEffect(() => {
    if (!toolResult) return
    const { x, y, startX, startY } = toolResult
    const coordX = startX || x
    const coordY = startY || y
    if (typeof coordX === "number" && typeof coordY === "number") {
      setMousePosition({ x: coordX, y: coordY })
    }
  }, [toolResult])

  const handleImageLoad = () => {
    if (!imageRef.current) return
    setImageSize({ width: imageRef.current.naturalWidth, height: imageRef.current.naturalHeight })
  }

  return (
    <div className="space-y-4">
      {screenshot ? (
        <BrowserShell>
          <div className="relative">
            <ClickableImage
              ref={imageRef}
              src={screenshot}
              alt="Hover action screenshot"
              className="h-auto w-full object-contain"
              onLoad={handleImageLoad}
            />

            {mousePosition && imageSize ? (
              <motion.div
                className="pointer-events-none absolute"
                initial={{
                  left: `${(mousePosition.x / imageSize.width) * 100}%`,
                  top: `${(mousePosition.y / imageSize.height) * 100}%`,
                }}
                animate={{
                  left: `${(mousePosition.x / imageSize.width) * 100}%`,
                  top: `${(mousePosition.y / imageSize.height) * 100}%`,
                }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                style={{ zIndex: 10, transform: "translate(-50%, -50%)" }}
              >
                <motion.div
                  className="text-tool-action/40 absolute rounded-full"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  style={{
                    width: "30px",
                    height: "30px",
                    top: "-15px",
                    left: "-15px",
                    background: "radial-gradient(circle, currentColor 0%, transparent 70%)",
                    border: "1px solid currentColor",
                  }}
                />

                <motion.svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  animate={{ y: [0, -2, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  style={{
                    position: "absolute",
                    top: "-12px",
                    left: "-12px",
                    filter: "drop-shadow(0px 2px 6px currentColor)",
                  }}
                  className="text-tool-action"
                >
                  <path
                    d="M5 3L19 12L12 13L9 20L5 3Z"
                    fill="var(--color-background)"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </motion.svg>

                <motion.div
                  className="bg-tool-action text-tool-action absolute rounded-full"
                  animate={{ scale: [0.8, 1, 0.8], opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  style={{
                    width: "4px",
                    height: "4px",
                    top: "-2px",
                    left: "-2px",
                    boxShadow: "0 0 8px 2px currentColor",
                  }}
                />
              </motion.div>
            ) : null}
          </div>
        </BrowserShell>
      ) : null}

      <div className="border-tool-action/20 bg-surface-3 overflow-hidden rounded-lg border shadow-none">
        <div className="border-tool-action/20 bg-tool-action/10 flex items-center border-b px-4 py-3">
          <motion.div
            animate={{ x: [0, 2, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <MousePointer className="text-tool-action mr-2.5" size={18} />
          </motion.div>
          <div className="text-foreground font-medium">Hover Action</div>
          <div
            className={`ml-auto flex items-center space-x-2 ${status === "success" ? "text-tool-action" : "text-destructive"}`}
          >
            {status === "success" ? <Check size={16} /> : <XMark size={16} />}
            <span className="text-xs font-medium capitalize">{status}</span>
          </div>
        </div>

        <div className="space-y-3 p-4">
          {element ? (
            <div>
              <div className="text-foreground mb-1 text-sm font-medium">Target Element</div>
              <div className="border-border bg-muted/40 overflow-x-auto rounded-md border p-2 font-mono text-xs">
                {element}
              </div>
            </div>
          ) : null}

          {mousePosition ? (
            <div>
              <div className="text-foreground mb-1 text-sm font-medium">Hover Position</div>
              <div className="border-tool-action/20 bg-tool-action/5 rounded-lg border p-2">
                <span className="text-foreground font-mono text-sm">
                  x: {mousePosition.x}, y: {mousePosition.y}
                </span>
              </div>
            </div>
          ) : null}

          <div className="border-tool-action/20 bg-tool-action/5 rounded-lg border p-3">
            <div className="text-tool-action text-xs font-medium">
              Mouse cursor is hovering over the element
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
