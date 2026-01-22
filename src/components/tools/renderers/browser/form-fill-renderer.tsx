"use client"

import { motion } from "framer-motion"
import React from "react"

import { Image } from "@/components/ui/image"
import { Check, PencilSquare as Edit3, XMark } from "@/lib/icons"

import { BrowserShell } from "../browser-shell"
import { ToolResultContentPart } from "../tool-result-renderer"

interface FormFillRendererProps {
  part: ToolResultContentPart
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAction?: (action: string, data: any) => void
}

export const FormFillRenderer: React.FC<FormFillRendererProps> = ({ part }) => {
  const { toolResult, toolInput } = part
  const screenshot = toolResult?.screenshot || toolInput?.screenshot
  const selector = toolInput?.selector || toolInput?.element || ""
  const value = toolInput?.value || toolInput?.text || ""
  const status = toolResult?.status || "success"

  return (
    <div className="space-y-4">
      {screenshot ? (
        <BrowserShell>
          <Image
            src={screenshot}
            alt="Form fill screenshot"
            className="h-auto w-full object-contain"
          />
        </BrowserShell>
      ) : null}

      <div className="border-tool-action/20 bg-card overflow-hidden rounded-xl border shadow-sm">
        <div className="border-tool-action/20 bg-tool-action/10 flex items-center border-b px-4 py-3">
          <Edit3 className="text-tool-action mr-2.5" size={18} />
          <div className="text-foreground font-medium">Form Input Fill</div>
          <div
            className={`ml-auto flex items-center space-x-2 ${status === "success" ? "text-tool-action" : "text-destructive"}`}
          >
            {status === "success" ? <Check size={16} /> : <XMark size={16} />}
            <span className="text-xs font-medium capitalize">{status}</span>
          </div>
        </div>

        <div className="space-y-3 p-4">
          {selector ? (
            <div>
              <div className="text-foreground mb-1 text-sm font-medium">Target Element</div>
              <div className="border-tool-action/20 bg-tool-action/5 rounded-md border p-2 font-mono text-xs">
                {selector}
              </div>
            </div>
          ) : null}

          {value ? (
            <div>
              <div className="text-foreground mb-1 text-sm font-medium">Input Value</div>
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-tool-action/20 bg-tool-action/5 rounded-lg border p-3"
              >
                <div className="text-foreground text-sm font-medium">&quot;{value}&quot;</div>
              </motion.div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
