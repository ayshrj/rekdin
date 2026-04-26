"use client"

import { motion } from "motion/react"
import React, { useEffect, useRef, useState } from "react"

import { Image } from "@/components/ui/image"
import {
  Check,
  ChevronDoubleRight,
  ClipboardDocumentList as Copy,
  CursorArrowRays as MousePointer,
  Eye,
  Type,
} from "@/lib/icons"

import { BrowserShell } from "./browser-shell"

function CopyActionButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="text-muted-foreground hover:text-foreground absolute top-1.5 right-1.5 rounded p-0.5 opacity-0 transition-colors group-hover:opacity-100"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}
import { ToolResultContentPart } from "./tool-result-renderer"

interface BrowserControlRendererProps {
  part: ToolResultContentPart
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAction?: (action: string, data: any) => void
}

export const BrowserControlRenderer: React.FC<BrowserControlRendererProps> = ({ part }) => {
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null)
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  const { toolResult, toolInput } = part
  const thought = toolResult?.thought || toolInput?.thought || ""
  const step = toolResult?.step || toolInput?.step || toolResult?.action || ""
  const action = toolResult?.action || toolInput?.action || ""
  const status = toolResult?.status || "success"
  const screenshot = toolResult?.screenshot || toolResult?.image || toolInput?.screenshot

  useEffect(() => {
    if (!toolResult) return
    const { startX, startY, x, y } = toolResult
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

  if (!thought && !step && !action && !screenshot) {
    return <div className="text-muted-foreground italic">Browser control details unavailable</div>
  }

  return (
    <div className="space-y-4">
      {screenshot ? (
        <div>
          <BrowserShell className="mb-4">
            <div className="relative">
              <Image
                ref={imageRef}
                src={screenshot}
                alt="Browser Screenshot"
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
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  style={{ zIndex: 10 }}
                >
                  <div className="relative">
                    <svg
                      width="36"
                      height="36"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      style={{
                        filter: "drop-shadow(0px 2px 4px rgba(0,0,0,0.3))",
                        transform: "translate(0px, 2px)",
                      }}
                    >
                      <defs>
                        <linearGradient id="cursorGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="var(--color-background)" />
                          <stop offset="100%" stopColor="var(--color-muted)" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M5 3L19 12L12 13L9 20L5 3Z"
                        fill="url(#cursorGradient)"
                        stroke="var(--color-foreground)"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                    </svg>

                    <motion.div
                      className="text-tool-action/60 absolute rounded-full"
                      initial={{ opacity: 0.9, scale: 0 }}
                      animate={{ opacity: 0, scale: 2 }}
                      transition={{ duration: 1.2, ease: "easeOut", delay: 0.2, repeat: Infinity }}
                      style={{
                        top: "-6px",
                        left: "-6px",
                        width: "20px",
                        height: "20px",
                        background: "radial-gradient(circle, currentColor 0%, transparent 70%)",
                        border: "1px solid currentColor",
                      }}
                    />
                  </div>
                </motion.div>
              ) : null}
            </div>
          </BrowserShell>
        </div>
      ) : null}

      <div className="border-tool-action/20 bg-card overflow-hidden rounded-xl border shadow-sm">
        <div className="border-tool-action/20 bg-tool-action/10 flex items-center border-b px-4 py-3">
          <MousePointer className="text-tool-action mr-2.5" size={18} />
          <div className="text-foreground font-medium">GUI Agent Operation</div>
          {status ? (
            <div
              className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${
                status === "success"
                  ? "bg-tool-action/15 text-tool-action"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {status === "success" ? "Success" : "Failed"}
            </div>
          ) : null}
        </div>

        <div className="space-y-3 p-4">
          {thought ? (
            <div className="space-y-1">
              <div className="text-foreground flex items-center text-sm font-medium">
                <Eye className="text-tool-action mr-2" size={14} />
                Thought
              </div>
              <div className="border-border text-muted-foreground border-l-2 pl-6 text-sm">
                {thought}
              </div>
            </div>
          ) : null}

          {step ? (
            <div className="space-y-1">
              <div className="text-foreground flex items-center text-sm font-medium">
                <ChevronDoubleRight className="text-tool-action mr-2" size={14} />
                Action
              </div>
              <div className="border-border text-muted-foreground border-l-2 pl-6 text-sm">
                {step}
              </div>
            </div>
          ) : null}

          {action ? (
            <div className="space-y-1">
              <div className="text-foreground flex items-center text-sm font-medium">
                <Type className="text-tool-action mr-2" size={14} />
                Action Command
              </div>
              <div className="border-border bg-muted/40 group relative overflow-x-auto rounded-md border p-2 font-mono text-xs">
                {action}
                <CopyActionButton text={String(action)} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
