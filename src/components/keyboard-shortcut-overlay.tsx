"use client"

import * as React from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface ShortcutRow {
  keys: string[]
  label: string
}

interface ShortcutSection {
  heading: string
  rows: ShortcutRow[]
}

const SECTIONS: ShortcutSection[] = [
  {
    heading: "Navigation",
    rows: [
      { keys: ["⌘", "K"], label: "Open command palette" },
      { keys: ["⌘", "N"], label: "New session" },
      { keys: ["?"], label: "Open this shortcut overlay" },
    ],
  },
  {
    heading: "Chat",
    rows: [
      { keys: ["Enter"], label: "Send message" },
      { keys: ["⇧", "Enter"], label: "New line" },
      { keys: ["Esc"], label: "Stop generation / close" },
      { keys: ["/"], label: "Open slash command menu" },
      { keys: ["↑", "↓"], label: "Navigate slash command suggestions" },
      { keys: ["Tab"], label: "Select highlighted command" },
    ],
  },
  {
    heading: "Slash Commands",
    rows: [
      { keys: ["/research"], label: "Run Research Report workflow" },
      { keys: ["/audit"], label: "Queue repo audit (background)" },
      { keys: ["/diff"], label: "Review current git diff" },
      { keys: ["/workspace"], label: "Open workspace picker" },
      { keys: ["/settings"], label: "Open provider settings" },
      { keys: ["/compact"], label: "Compact conversation context" },
      { keys: ["/status"], label: "Show session status" },
      { keys: ["/retry"], label: "Retry last message" },
      { keys: ["/export"], label: "Export session bundle" },
      { keys: ["/clear"], label: "Start new session" },
    ],
  },
  {
    heading: "Tool Policy",
    rows: [
      { keys: ["read_only"], label: "Web search and file reads only" },
      { keys: ["balanced"], label: "Reads + selective writes with approval" },
      { keys: ["full_auto"], label: "All tools without prompting" },
    ],
  },
]

function Key({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <kbd
      className={cn(
        "border-border bg-surface-3 text-foreground inline-flex items-center justify-center rounded border px-1.5 py-0.5 font-mono text-[10px] leading-none font-medium shadow-sm",
        wide && "px-2"
      )}
    >
      {children}
    </kbd>
  )
}

export function KeyboardShortcutOverlay() {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === "input" || tag === "textarea" || (e.target as HTMLElement)?.isContentEditable)
        return
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Keyboard shortcuts</DialogTitle>
          <DialogDescription className="text-xs">
            Press <Key>?</Key> anytime to open this panel.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-5">
          {SECTIONS.map((section) => (
            <div key={section.heading}>
              <p className="rk-section-label mb-2">{section.heading}</p>
              <div className="space-y-1">
                {section.rows.map((row) => (
                  <div
                    key={row.keys.join("+")}
                    className="flex items-center justify-between gap-4 py-0.5"
                  >
                    <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
                      {row.label}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      {row.keys.map((k) => (
                        <Key key={k} wide={k.startsWith("/") || k.length > 3}>
                          {k}
                        </Key>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
