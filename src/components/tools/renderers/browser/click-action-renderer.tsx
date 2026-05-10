"use client"

import { motion } from "motion/react"
import React, { useEffect, useRef, useState } from "react"

import { Image } from "@/components/ui/image"
import { Check, CursorArrowRays as MousePointer, XMark } from "@/lib/icons"

import { BrowserShell } from "../browser-shell"
import { ToolResultContentPart } from "../tool-result-renderer"

interface ClickActionRendererProps {
  part: ToolResultContentPart
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAction?: (action: string, data: any) => void
}

export const ClickActionRenderer: React.FC<ClickActionRendererProps> = ({ part }) => {
  const { toolResult, toolInput, toolName } = part
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null)
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  const screenshot = toolResult?.screenshot || toolInput?.screenshot
  const status = toolResult?.status || "success"
  const element = toolInput?.element || toolInput?.selector || ""

  const clickLabel = toolName?.includes("double")
    ? "Double Click"
    : toolName?.includes("right")
      ? "Right Click"
      : "Click"

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
            <Image
              ref={imageRef}
              src={screenshot}
              alt="Click action screenshot"
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
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                style={{ transform: "translate(-50%, -50%)", zIndex: 10 }}
              >
                <motion.div
                  className="border-tool-action absolute h-5 w-5 rounded-full border-2"
                  initial={{ scale: 0.4, opacity: 1 }}
                  animate={{ scale: 2.2, opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  style={{ top: "-10px", left: "-10px" }}
                />
                <div
                  className="bg-tool-action absolute h-2 w-2 rounded-full"
                  style={{ top: "-4px", left: "-4px" }}
                />
              </motion.div>
            ) : null}
          </div>
        </BrowserShell>
      ) : null}

      <div className="border-tool-action/20 bg-surface-3 overflow-hidden rounded-lg border shadow-none">
        <div className="border-tool-action/20 bg-tool-action/10 flex items-center border-b px-4 py-3">
          <MousePointer className="text-tool-action mr-2.5" size={18} />
          <div className="text-foreground font-medium">{clickLabel}</div>
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
              <div className="text-foreground mb-1 text-sm font-medium">Click Coordinates</div>
              <div className="border-tool-action/20 bg-tool-action/5 rounded-lg border p-2">
                <span className="text-foreground font-mono text-sm">
                  x: {mousePosition.x}, y: {mousePosition.y}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
