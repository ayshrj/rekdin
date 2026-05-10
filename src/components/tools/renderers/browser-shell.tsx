"use client"

import { motion } from "motion/react"
import React from "react"

import { ArrowPath, Globe, LockClosed } from "@/lib/icons"

interface BrowserShellProps {
  children: React.ReactNode
  title?: string
  url?: string
  className?: string
}

export const BrowserShell: React.FC<BrowserShellProps> = ({
  children,
  title = "Browser",
  url = "",
  className = "",
}) => {
  const displayUrl = url || ""
  const isSecure = displayUrl.startsWith("https://")

  const getDomain = (url: string) => {
    try {
      if (url.startsWith("http")) {
        const domain = new URL(url).hostname
        return domain || title
      }
    } catch {
      // ignore
    }
    return title
  }

  getDomain(displayUrl)

  return (
    <div
      className={`border-border bg-surface-3 w-full min-w-0 overflow-hidden rounded-lg border shadow-none ${className}`}
    >
      <div className="border-border from-muted/70 to-muted/40 border-b bg-linear-to-r">
        <div className="flex items-center px-4 py-3">
          <div className="mr-4 flex shrink-0 space-x-1.5">
            <motion.div
              whileHover={{ scale: 1.1 }}
              className="border-tool-browser/30 bg-tool-browser/80 h-3 w-3 cursor-pointer rounded-full border shadow-none"
            />
            <motion.div
              whileHover={{ scale: 1.1 }}
              className="border-tool-browser/20 bg-tool-browser/60 h-3 w-3 cursor-pointer rounded-full border shadow-none"
            />
            <motion.div
              whileHover={{ scale: 1.1 }}
              className="border-tool-browser/10 bg-tool-browser/40 h-3 w-3 cursor-pointer rounded-full border shadow-none"
            />
          </div>

          <div className="group border-border/60 bg-background text-foreground hover:border-tool-browser/40 flex min-w-0 flex-1 items-center rounded-lg border px-3 py-2 text-xs shadow-none transition-all duration-200">
            <div className="flex w-full min-w-0 items-center">
              <div className="mr-2 flex shrink-0 items-center">
                {isSecure ? (
                  <LockClosed className="text-tool-browser mr-1.5" size={12} />
                ) : (
                  <Globe className="text-muted-foreground mr-1.5" size={12} />
                )}
              </div>
              <span className="flex-1 truncate font-mono">{displayUrl}</span>
              <motion.button
                whileHover={{ rotate: 180 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="text-muted-foreground hover:bg-muted hover:text-foreground ml-2 rounded p-1 transition-all duration-200"
                title="Refresh"
                type="button"
              >
                <ArrowPath size={12} />
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-h-dvh min-w-0 overflow-auto">{children}</div>
    </div>
  )
}
