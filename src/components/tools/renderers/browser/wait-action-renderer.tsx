"use client"

import { motion } from "framer-motion"
import React from "react"

import { Image } from "@/components/ui/image"
import { Check, Clock, XMark } from "@/lib/icons"

import { BrowserShell } from "../browser-shell"
import { ToolResultContentPart } from "../tool-result-renderer"

interface WaitActionRendererProps {
  part: ToolResultContentPart
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAction?: (action: string, data: any) => void
}

export const WaitActionRenderer: React.FC<WaitActionRendererProps> = ({ part }) => {
  const { toolResult, toolInput } = part
  const screenshot = toolResult?.screenshot || toolInput?.screenshot
  const duration = toolInput?.duration || toolInput?.timeout || toolResult?.duration
  const condition = toolInput?.condition || toolInput?.for || toolResult?.condition
  const status = toolResult?.status || "success"

  return (
    <div className="space-y-4">
      {screenshot ? (
        <BrowserShell>
          <Image
            src={screenshot}
            alt="Wait action screenshot"
            className="h-auto w-full object-contain"
          />
        </BrowserShell>
      ) : null}

      <div className="border-tool-action/20 bg-card overflow-hidden rounded-xl border shadow-sm">
        <div className="border-tool-action/20 bg-tool-action/10 flex items-center border-b px-4 py-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="mr-2.5"
          >
            <Clock className="text-tool-action" size={18} />
          </motion.div>
          <div className="text-foreground font-medium">Wait Action</div>
          <div
            className={`ml-auto flex items-center space-x-2 ${status === "success" ? "text-tool-action" : "text-destructive"}`}
          >
            {status === "success" ? <Check size={16} /> : <XMark size={16} />}
            <span className="text-xs font-medium capitalize">{status}</span>
          </div>
        </div>

        <div className="space-y-3 p-4">
          {duration ? (
            <div>
              <div className="text-foreground mb-1 text-sm font-medium">Duration</div>
              <div className="flex items-center space-x-2">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="border-tool-action/20 bg-tool-action/5 rounded-lg border px-3 py-2"
                >
                  <span className="text-foreground font-mono font-medium">{duration}s</span>
                </motion.div>
              </div>
            </div>
          ) : null}

          {condition ? (
            <div>
              <div className="text-foreground mb-1 text-sm font-medium">Wait Condition</div>
              <div className="border-tool-action/20 bg-tool-action/5 rounded-lg border p-3">
                <div className="text-foreground text-sm">{condition}</div>
              </div>
            </div>
          ) : null}

          {!duration && !condition ? (
            <div className="py-4 text-center">
              <motion.div
                animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className="text-tool-action"
              >
                Waiting for page to load...
              </motion.div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
