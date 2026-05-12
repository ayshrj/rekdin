"use client"

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
  url = "",
  className = "",
}) => {
  const displayUrl = url || ""
  const isSecure = displayUrl.startsWith("https://")

  return (
    <div
      className={`border-border bg-surface-3 w-full min-w-0 overflow-hidden rounded-lg border shadow-none ${className}`}
    >
      {/* Chrome bar */}
      <div className="border-border from-muted/70 to-muted/40 border-b bg-linear-to-r">
        <div className="flex items-center px-4 py-3">
          {/* Traffic light dots — decorative only */}
          <div className="mr-4 flex shrink-0 space-x-1.5" aria-hidden>
            <div className="border-tool-browser/30 bg-tool-browser/80 h-3 w-3 rounded-full border shadow-none" />
            <div className="border-tool-browser/20 bg-tool-browser/60 h-3 w-3 rounded-full border shadow-none" />
            <div className="border-tool-browser/10 bg-tool-browser/40 h-3 w-3 rounded-full border shadow-none" />
          </div>

          {/* URL bar */}
          <div className="group border-border/60 bg-background text-foreground hover:border-tool-browser/40 flex min-w-0 flex-1 items-center rounded-lg border px-3 py-2 text-xs shadow-none transition-colors duration-150">
            <div className="flex w-full min-w-0 items-center">
              <div className="mr-2 flex shrink-0 items-center">
                {isSecure ? (
                  <LockClosed className="text-tool-browser mr-1.5" size={12} />
                ) : (
                  <Globe className="text-muted-foreground mr-1.5" size={12} />
                )}
              </div>
              <span className="flex-1 truncate font-mono text-[11px]">{displayUrl}</span>
              <button
                type="button"
                className="text-muted-foreground hover:bg-muted hover:text-foreground ml-2 rounded p-1 transition-colors duration-150"
                title="Refresh"
                aria-label="Refresh"
              >
                <ArrowPath size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="rk-scrollbar max-h-dvh min-w-0 overflow-auto">{children}</div>
    </div>
  )
}
