"use client"

import { motion } from "framer-motion"
import * as React from "react"

import {
  ToolResultContentPart,
  ToolResultRenderer,
} from "@/components/tools/renderers/tool-result-renderer"
import { toolLabels } from "@/components/tools/tool-labels"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ToolResultEntry, useToolResults } from "@/contexts/chat-context"
import { ChevronLeft, ChevronRight, GalleryVerticalEnd, Globe } from "@/lib/icons"
import { cn } from "@/lib/utils"

import { Button } from "./ui/button"

function toContentPart(entry: ToolResultEntry): ToolResultContentPart {
  return {
    type: entry.toolName || "generic",
    toolName: entry.toolName,
    toolInput: entry.arguments ?? {},
    toolResult: entry.result ?? {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    status: entry.status as any,
    timestamp: entry.timestamp,
  }
}

export function WorkspacePanel() {
  const { toolResults } = useToolResults()
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const [showTimeline, setShowTimeline] = React.useState(false)
  const [navigationMode, setNavigationMode] = React.useState<"scroll" | "buttons">("buttons")

  React.useEffect(() => {
    if (toolResults.length > 0) {
      setSelectedIndex(toolResults.length - 1)
    }
  }, [toolResults])

  const activeEntry = toolResults[selectedIndex]
  const isScrollMode = navigationMode === "scroll"
  const stepLabel =
    toolResults.length > 0 ? `Step ${selectedIndex + 1} of ${toolResults.length}` : "No steps yet"

  const handleStepChange = React.useCallback(
    (index: number) => {
      if (index < 0 || index >= toolResults.length) return
      setSelectedIndex(index)
      if (!isScrollMode) return
      const target = document.getElementById(`tool-result-${toolResults[index]?.id}`)
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    },
    [isScrollMode, toolResults]
  )

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Avoid interfering with text inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault()
        handleStepChange(selectedIndex - 1)
      }

      if (e.key === "ArrowRight") {
        e.preventDefault()
        handleStepChange(selectedIndex + 1)
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [handleStepChange, selectedIndex])

  return (
    <div className="bg-card flex h-full min-w-0 gap-3 rounded-2xl border shadow-sm">
      <motion.div
        className="shrink-0 overflow-y-auto border-r p-4"
        initial={false}
        animate={{
          width: showTimeline ? 280 : 64,
          minWidth: showTimeline ? 240 : 64,
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        <div className="mb-1 flex w-full items-center justify-between">
          {showTimeline && (
            <motion.p
              className="text-muted-foreground text-xs uppercase"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              Tool timeline
            </motion.p>
          )}
          <Button
            onClick={() => setShowTimeline(!showTimeline)}
            size="icon-sm"
            className={cn(!showTimeline && "ml-auto", "cursor-pointer")}
          >
            <GalleryVerticalEnd className="size-4" />
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {toolResults.map((result, index) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const resultId = `tool-result-${result.id}`
            return (
              <button
                key={result.id}
                type="button"
                className={cn(
                  "w-full rounded-xl border px-3 py-2 text-left text-sm transition",
                  index === selectedIndex
                    ? "border-primary/40 bg-primary/5"
                    : "hover:border-border hover:bg-muted/50 border-transparent"
                )}
                onClick={() => {
                  handleStepChange(index)
                }}
              >
                {showTimeline ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between">
                      <span className="font-medium">
                        {toolLabels[result.toolName] ?? result.toolName}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {toolLabels[result.status] ?? result.status}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </p>
                  </>
                ) : (
                  <div className="flex items-center justify-center">
                    <span className="text-muted-foreground text-xs font-medium">{index + 1}</span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </motion.div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="bg-card flex items-center justify-between border-b px-4 pt-4 pb-3">
          <div>
            <p className="text-muted-foreground text-xs uppercase">Tool steps</p>
            <h3 className="text-lg font-semibold">
              {toolResults.length > 0 ? `${toolResults.length} steps` : "No steps yet"}
            </h3>
          </div>
          {activeEntry ? (
            <div className="rounded-full border px-3 py-1 text-xs">
              Active: {toolLabels[activeEntry.toolName] ?? activeEntry.toolName}
            </div>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
          {toolResults.length === 0 ? (
            <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
              <div className="flex flex-col items-center gap-2 text-center">
                <Globe className="h-6 w-6" />
                <span>Tool calls will appear here as the agent works.</span>
              </div>
            </div>
          ) : isScrollMode ? (
            <div className="mt-4 space-y-6">
              {toolResults.map((result, index) => {
                const resultId = `tool-result-${result.id}`
                const contentPart = toContentPart(result)
                return (
                  <div key={result.id} id={resultId} className="scroll-mt-4">
                    <div
                      className={cn(
                        "mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-1 text-xs transition-colors",
                        index === selectedIndex
                          ? "bg-primary/5 text-primary"
                          : "text-muted-foreground"
                      )}
                    >
                      <span>Step {index + 1}</span>
                      <span>{toolLabels[result.toolName] ?? result.toolName}</span>
                      <span>{new Date(result.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <ToolResultRenderer content={[contentPart]} />
                  </div>
                )
              })}
            </div>
          ) : activeEntry ? (
            <div className="mt-4">
              <div className="text-muted-foreground mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span>{stepLabel}</span>
                <span>{toolLabels[activeEntry.toolName] ?? activeEntry.toolName}</span>
                <span>{new Date(activeEntry.timestamp).toLocaleTimeString()}</span>
              </div>
              <ToolResultRenderer content={[toContentPart(activeEntry)]} />
            </div>
          ) : null}
        </div>
        <div className="bg-card flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
          <ToggleGroup
            type="single"
            value={navigationMode}
            onValueChange={(value) => {
              if (!value) return
              setNavigationMode(value as "scroll" | "buttons")
            }}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="scroll">Scroll</ToggleGroupItem>
            <ToggleGroupItem value="buttons">Buttons</ToggleGroupItem>
          </ToggleGroup>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">{stepLabel}</span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={selectedIndex <= 0 || toolResults.length === 0}
              onClick={() => handleStepChange(selectedIndex - 1)}
              aria-label="Previous step"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={selectedIndex >= toolResults.length - 1}
              onClick={() => handleStepChange(selectedIndex + 1)}
              aria-label="Next step"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
