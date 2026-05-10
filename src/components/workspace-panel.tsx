"use client"

import { AnimatePresence, motion } from "motion/react"
import * as React from "react"

import { JsonTreeViewer, type JsonValue } from "@/components/json-tree-viewer"
import {
  ToolResultContentPart,
  ToolResultRenderer,
} from "@/components/tools/renderers/tool-result-renderer"
import { toolLabels } from "@/components/tools/tool-labels"
import { Badge } from "@/components/ui/badge"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ToolResultEntry, useChat, useToolResults } from "@/contexts/chat-context"
import {
  ArrowDownTray,
  ChevronLeft,
  ChevronRight,
  ClipboardDocumentList,
  Clock,
  File,
  GalleryVerticalEnd,
  Globe,
  PlayCircle,
} from "@/lib/icons"
import { cn } from "@/lib/utils"

import { Button } from "./ui/button"

const TRACE_SHOW_ONLY_KEYS = [
  "mode",
  "provider",
  "model",
  "toolPolicy",
  "toolCount",
  "totalToolDurationMs",
  "retryCount",
  "success",
  "warnings",
  "error",
  "startedAt",
  "completedAt",
  "workflowId",
] as const

const REPLAY_EVENT_SHOW_ONLY_KEYS = [
  "phase",
  "message",
  "content",
  "warning",
  "error",
  "toolCall",
  "messageId",
  "tempId",
  "at",
] as const

function isResultEmpty(entry: ToolResultEntry): boolean {
  if (entry.result === undefined || entry.result === null) return true
  if (typeof entry.result === "string") return !entry.result.trim()
  if (typeof entry.result === "object") return Object.keys(entry.result).length === 0
  return false
}

function ToolLoadingSkeleton({ toolName }: { toolName: string }) {
  return (
    <div className="rk-tool-card w-full space-y-4">
      <div className="flex items-center gap-2">
        <span className="bg-primary h-1.5 w-1.5 shrink-0 animate-pulse rounded-full" />
        <span className="text-primary font-mono text-[10px] font-semibold tracking-[0.12em] uppercase">
          {toolLabels[toolName] ?? toolName} — working…
        </span>
      </div>
      <div className="space-y-2.5">
        <div className="bg-surface-4 h-3 w-4/5 animate-pulse rounded-sm" />
        <div className="bg-surface-4 h-2 w-3/5 animate-pulse rounded-sm" />
        <div className="bg-surface-4 h-3 w-11/12 animate-pulse rounded-sm" />
        <div className="bg-surface-4 h-2 w-2/3 animate-pulse rounded-sm" />
        <div className="bg-surface-4 h-3 w-3/4 animate-pulse rounded-sm" />
      </div>
    </div>
  )
}

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

function truncateText(value: string, max = 72) {
  const normalized = value.replace(/\s+/g, " ").trim()
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max - 1).trimEnd()}…`
}

function summarizeUserRequest(content: string) {
  const cleaned = truncateText(content, 80)
  if (!cleaned) {
    return {
      title: "Started a new task",
      detail: "Rekdin started processing your request.",
    }
  }

  return {
    title: truncateText(cleaned, 52),
    detail: `Started working on: ${cleaned}`,
  }
}

function extractFirstString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = extractFirstString(item)
      if (result) return result
    }
    return null
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      const result = extractFirstString(item)
      if (result) return result
    }
  }
  return null
}

/**
 * Builds a concise timeline label for a tool-start replay event.
 */
function summarizeToolStart(toolName: string, toolCall: Record<string, unknown>) {
  const args =
    toolCall.arguments && typeof toolCall.arguments === "object"
      ? (toolCall.arguments as Record<string, unknown>)
      : {}

  if (toolName === "web_search") {
    const query = typeof args.query === "string" ? args.query : extractFirstString(args)
    return {
      title: query ? `Searched for ${truncateText(query, 40)}` : "Searched the web",
      detail: query
        ? `Looked for sources about ${truncateText(query, 72)}.`
        : "Looked for relevant sources on the web.",
    }
  }

  if (toolName === "visit_link" || toolName === "browser_navigate") {
    const url =
      typeof args.url === "string" ? args.url : typeof args.link === "string" ? args.link : null
    return {
      title: url ? `Opened ${truncateText(url, 42)}` : "Opened a page",
      detail: url
        ? `Loaded ${truncateText(url, 80)} to inspect its contents.`
        : "Opened a page to inspect its contents.",
    }
  }

  if (toolName === "file_search") {
    const pattern = typeof args.pattern === "string" ? args.pattern : extractFirstString(args)
    return {
      title: pattern
        ? `Searched workspace for ${truncateText(pattern, 34)}`
        : "Searched the workspace",
      detail: pattern
        ? `Looked through project files for ${truncateText(pattern, 72)}.`
        : "Looked through project files for the relevant content.",
    }
  }

  if (
    toolName === "write_file" ||
    toolName === "file_replace" ||
    toolName === "json_patch" ||
    toolName === "yaml_patch"
  ) {
    const pathArg =
      typeof args.path === "string"
        ? args.path
        : typeof args.filePath === "string"
          ? args.filePath
          : null
    return {
      title: pathArg ? `Updated ${truncateText(pathArg, 42)}` : "Updated a file",
      detail: pathArg
        ? `Prepared changes in ${truncateText(pathArg, 80)}.`
        : "Prepared changes in the workspace.",
    }
  }

  if (toolName === "markdown_to_pdf" || toolName === "generate_latex_pdf") {
    return {
      title: "Generated a document",
      detail: "Prepared a PDF or document artifact.",
    }
  }

  return {
    title: toolLabels[toolName] ?? toolName,
    detail: `Started ${toolLabels[toolName]?.toLowerCase() ?? "a tool step"} for this task.`,
  }
}

/**
 * Builds a concise timeline label for a completed tool result without rendering the full payload.
 */
function summarizeToolResult(toolName: string, toolCall: Record<string, unknown>) {
  const status = String(toolCall.status ?? "success")
  const result =
    toolCall.result && typeof toolCall.result === "object"
      ? (toolCall.result as Record<string, unknown>)
      : {}

  if (status === "error") {
    return {
      title: `${toolLabels[toolName] ?? toolName} hit a problem`,
      detail:
        "This step reported an issue, so Rekdin may have fallen back or continued with partial results.",
      tone: "warning" as const,
    }
  }

  if (toolName === "web_search") {
    const results = Array.isArray(result.results)
      ? result.results.length
      : Array.isArray(result.items)
        ? result.items.length
        : null
    return {
      title: "Finished web search",
      detail:
        typeof results === "number"
          ? `Found ${results} relevant search result${results === 1 ? "" : "s"}.`
          : "Collected relevant search results.",
      tone: "success" as const,
    }
  }

  if (toolName === "visit_link" || toolName === "browser_navigate") {
    const title = typeof result.title === "string" ? result.title : null
    return {
      title: title ? `Opened ${truncateText(title, 42)}` : "Page loaded",
      detail: title
        ? `Loaded the page titled ${truncateText(title, 72)}.`
        : "Loaded the page and captured readable content.",
      tone: "success" as const,
    }
  }

  if (toolName === "file_search") {
    const matches = Array.isArray(result.matches)
      ? result.matches.length
      : typeof result.matchCount === "number"
        ? result.matchCount
        : null
    return {
      title: "Workspace search completed",
      detail:
        typeof matches === "number"
          ? `Found ${matches} matching file result${matches === 1 ? "" : "s"}.`
          : "Found relevant files in the workspace.",
      tone: "success" as const,
    }
  }

  if (
    toolName === "write_file" ||
    toolName === "file_replace" ||
    toolName === "json_patch" ||
    toolName === "yaml_patch"
  ) {
    const pathArg =
      typeof result.path === "string"
        ? result.path
        : typeof result.filePath === "string"
          ? result.filePath
          : null
    return {
      title: pathArg ? `Saved ${truncateText(pathArg, 42)}` : "Workspace update applied",
      detail: pathArg
        ? `Applied changes to ${truncateText(pathArg, 80)}.`
        : "Applied changes to the workspace.",
      tone: "success" as const,
    }
  }

  if (toolName === "markdown_to_pdf" || toolName === "generate_latex_pdf") {
    const artifactUrl =
      typeof result.artifactUrl === "string"
        ? result.artifactUrl
        : typeof result.url === "string"
          ? result.url
          : null
    return {
      title: "Document ready",
      detail: artifactUrl
        ? "Generated the document and saved an artifact."
        : "Generated the document successfully.",
      tone: "success" as const,
    }
  }

  return {
    title: `${toolLabels[toolName] ?? toolName} completed`,
    detail: "Finished this step successfully.",
    tone: "success" as const,
  }
}

function summarizeAssistantOutcome(message?: string | null) {
  const cleaned = truncateText(message ?? "", 90)
  if (!cleaned) {
    return {
      title: "Prepared a response",
      detail: "Rekdin finished this turn and returned an answer.",
    }
  }

  return {
    title: truncateText(cleaned, 52),
    detail: cleaned,
  }
}

/**
 * Renders Rekdin's inspection surface: live tool results, background jobs, replay events, traces,
 * and export controls for the active chat session.
 */
export function WorkspacePanel() {
  const { toolResults } = useToolResults()
  const { currentSessionId, messages } = useChat()
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const [navigationMode, setNavigationMode] = React.useState<"scroll" | "buttons">("buttons")
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null)
  const [activeTab, setActiveTab] = React.useState<"timeline" | "artifacts" | "replay">("timeline")
  const [replayEvents, setReplayEvents] = React.useState<Array<Record<string, unknown>>>([])
  const [traces, setTraces] = React.useState<Array<Record<string, unknown>>>([])
  const [backgroundJobs, setBackgroundJobs] = React.useState<Array<Record<string, unknown>>>([])
  const [showDiagnostics, setShowDiagnostics] = React.useState(false)

  React.useEffect(() => {
    if (toolResults.length > 0) {
      setSelectedIndex(toolResults.length - 1)
    }
  }, [toolResults])

  const scrollToBottom = React.useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollContainerRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
  }, [])

  // Auto-scroll to bottom when a new tool result arrives in scroll mode
  React.useEffect(() => {
    if (navigationMode !== "scroll" || toolResults.length === 0) return
    scrollToBottom()
  }, [toolResults.length, navigationMode, scrollToBottom])

  // Follow expanding content (e.g. markdown rendering) on the last step
  React.useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const isLastStep = selectedIndex === toolResults.length - 1
    if (!isLastStep && navigationMode !== "scroll") return
    const observer = new ResizeObserver(() => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      if (distanceFromBottom < 300) {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
      }
    })
    Array.from(el.children).forEach((child) => observer.observe(child))
    return () => observer.disconnect()
  }, [selectedIndex, toolResults.length, navigationMode])

  const activeEntry = toolResults[selectedIndex]
  const runningEntry = toolResults.find((r) => r.status === "running")
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

  React.useEffect(() => {
    if (!currentSessionId) {
      setReplayEvents([])
      setTraces([])
      setBackgroundJobs([])
      return
    }
    void (async () => {
      const [replayRes, tracesRes, jobsRes] = await Promise.allSettled([
        fetch(`/api/replay/${currentSessionId}`, { cache: "no-store" }),
        fetch(`/api/traces/${currentSessionId}`, { cache: "no-store" }),
        fetch(`/api/background?sessionId=${encodeURIComponent(currentSessionId)}`, {
          cache: "no-store",
        }),
      ])
      if (replayRes.status === "fulfilled" && replayRes.value.ok) {
        const data = (await replayRes.value.json()) as { events?: Array<Record<string, unknown>> }
        setReplayEvents(data.events ?? [])
      } else {
        setReplayEvents([])
      }
      if (tracesRes.status === "fulfilled" && tracesRes.value.ok) {
        const data = (await tracesRes.value.json()) as { traces?: Array<Record<string, unknown>> }
        setTraces(data.traces ?? [])
      } else {
        setTraces([])
      }
      if (jobsRes.status === "fulfilled" && jobsRes.value.ok) {
        const data = (await jobsRes.value.json()) as { jobs?: Array<Record<string, unknown>> }
        setBackgroundJobs(data.jobs ?? [])
      } else {
        setBackgroundJobs([])
      }
    })()
  }, [currentSessionId, toolResults.length])

  const downloadBundle = React.useCallback(
    (format: "json" | "html") => {
      if (!currentSessionId) return
      const suffix = format === "html" ? "?format=html" : ""
      window.open(
        `/api/sessions/${currentSessionId}/export${suffix}`,
        "_blank",
        "noopener,noreferrer"
      )
    },
    [currentSessionId]
  )

  const artifacts = React.useMemo(() => {
    const entries = new Map<string, { label: string; url: string }>()
    const collect = (value: unknown, label: string) => {
      if (!value) return
      if (typeof value === "string") {
        if (
          value.startsWith("/api/artifacts/") ||
          value.startsWith("/api/uploads/") ||
          value.startsWith("/api/pdf/") ||
          value.startsWith("https://res.cloudinary.com") ||
          value.startsWith("http://") ||
          value.startsWith("https://")
        ) {
          entries.set(value, { label, url: value })
        }
        return
      }
      if (Array.isArray(value)) {
        value.forEach((item) => collect(item, label))
        return
      }
      if (typeof value === "object") {
        Object.entries(value as Record<string, unknown>).forEach(([key, item]) =>
          collect(item, `${label} · ${key}`)
        )
      }
    }

    messages.forEach((message) => {
      message.attachments?.forEach((attachment) => collect(attachment, "Attachment"))
      message.toolCalls?.forEach((call) => collect(call.result, toolLabels[call.name] ?? call.name))
    })
    toolResults.forEach((entry) =>
      collect(entry.result, toolLabels[entry.toolName] ?? entry.toolName)
    )

    return Array.from(entries.values())
  }, [messages, toolResults])

  const activityItems = React.useMemo(() => {
    const items: Array<{
      id: string
      title: string
      detail: string
      timestamp?: string
      tone?: "default" | "success" | "warning"
    }> = []

    backgroundJobs.forEach((job, index) => {
      const status = String(job.status ?? "queued")
      items.push({
        id: String(job.id ?? `job-${index}`),
        title: `${String(job.workflowId ?? job.mode ?? "background task")} queued`,
        detail:
          status === "completed"
            ? "Background workflow completed and added its result to the session."
            : status === "failed"
              ? "Background workflow failed before completing."
              : "Background workflow is queued or running.",
        timestamp:
          typeof job.createdAt === "string"
            ? new Date(job.createdAt).toLocaleTimeString()
            : undefined,
        tone: status === "completed" ? "success" : status === "failed" ? "warning" : "default",
      })
    })

    replayEvents.forEach((event, index) => {
      const type = String(event.type ?? "")
      const data =
        event.data && typeof event.data === "object" ? (event.data as Record<string, unknown>) : {}
      const timestamp =
        typeof event.timestamp === "number"
          ? new Date(event.timestamp).toLocaleTimeString()
          : undefined

      if (type === "user_message") {
        const messageRecord =
          data.message && typeof data.message === "object"
            ? (data.message as Record<string, unknown>)
            : {}
        const summary = summarizeUserRequest(String(messageRecord.content ?? ""))
        items.push({
          id: String(event.id ?? `request-${index}`),
          title: summary.title,
          detail: summary.detail,
          timestamp,
        })
        return
      }

      if (type === "tool_call") {
        const toolCall =
          data.toolCall && typeof data.toolCall === "object"
            ? (data.toolCall as Record<string, unknown>)
            : {}
        const toolName = String(toolCall.name ?? "tool")
        const summary = summarizeToolStart(toolName, toolCall)
        items.push({
          id: String(event.id ?? `tool-${index}`),
          title: summary.title,
          detail: summary.detail,
          timestamp,
        })
        return
      }

      if (type === "tool_result") {
        const toolCall =
          data.toolCall && typeof data.toolCall === "object"
            ? (data.toolCall as Record<string, unknown>)
            : {}
        const toolName = String(toolCall.name ?? "tool")
        const summary = summarizeToolResult(toolName, toolCall)
        items.push({
          id: String(event.id ?? `tool-result-${index}`),
          title: summary.title,
          detail: summary.detail,
          timestamp,
          tone: summary.tone,
        })
        return
      }

      if (type === "assistant_message") {
        if (typeof data.warning === "string") {
          items.push({
            id: String(event.id ?? `warning-${index}`),
            title: "Adjusted course",
            detail: data.warning,
            timestamp,
            tone: "warning",
          })
          return
        }

        if (typeof data.error === "string") {
          items.push({
            id: String(event.id ?? `error-${index}`),
            title: "Run failed",
            detail: data.error,
            timestamp,
            tone: "warning",
          })
          return
        }

        const messageRecord =
          data.message && typeof data.message === "object"
            ? (data.message as Record<string, unknown>)
            : {}
        const summary = summarizeAssistantOutcome(
          typeof messageRecord.content === "string" ? messageRecord.content : null
        )
        items.push({
          id: String(event.id ?? `reply-${index}`),
          title: summary.title,
          detail: summary.detail,
          timestamp,
          tone: "success",
        })
      }
    })

    if (items.length === 0 && traces.length > 0) {
      traces.forEach((trace, index) => {
        items.push({
          id: String(trace.id ?? `trace-${index}`),
          title: `${String(trace.mode ?? "general")} turn completed`,
          detail: `Used ${String(trace.toolCount ?? 0)} tools with ${String(trace.retryCount ?? 0)} retries.`,
          timestamp:
            typeof trace.completedAt === "string"
              ? new Date(trace.completedAt).toLocaleTimeString()
              : undefined,
          tone: trace.success === false ? "warning" : "success",
        })
      })
    }

    return items
  }, [backgroundJobs, replayEvents, traces])

  return (
    <div className="bg-surface-1 flex h-full min-w-0 overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="bg-surface-2 border-border flex h-12 shrink-0 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <h3 className="text-foreground text-sm font-semibold">
              {activeTab === "timeline"
                ? toolResults.length > 0
                  ? "Tool steps"
                  : "No steps yet"
                : activeTab === "artifacts"
                  ? "Artifacts"
                  : showDiagnostics
                    ? "Diagnostics"
                    : "Activity"}
            </h3>
            {activeTab === "timeline" && toolResults.length > 0 && (
              <span className="bg-surface-4 text-muted-foreground rounded-full px-2 py-0.5 font-mono text-[10px]">
                {toolResults.length}
              </span>
            )}
            {activeTab === "artifacts" && artifacts.length > 0 && (
              <span className="bg-surface-4 text-muted-foreground rounded-full px-2 py-0.5 font-mono text-[10px]">
                {artifacts.length}
              </span>
            )}
            {activeTab === "timeline" && runningEntry ? (
              <span className="border-primary/25 bg-primary/10 text-primary flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase">
                <span className="bg-primary h-1.5 w-1.5 shrink-0 animate-pulse rounded-full" />
                {toolLabels[runningEntry.toolName] ?? runningEntry.toolName}
              </span>
            ) : activeEntry ? (
              <span className="bg-surface-2 text-muted-foreground rounded-md border px-2 py-0.5 font-mono text-[10px]">
                {toolLabels[activeEntry.toolName] ?? activeEntry.toolName}
              </span>
            ) : null}
          </div>
          <div className="hidden items-center gap-1 sm:flex">
            {currentSessionId ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 rounded-md text-xs"
                  onClick={() => downloadBundle("json")}
                >
                  <ArrowDownTray className="h-3 w-3" />
                  JSON
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 rounded-md text-xs"
                  onClick={() => downloadBundle("html")}
                >
                  <ClipboardDocumentList className="h-3 w-3" />
                  HTML
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {/* Tab bar */}
        <div className="bg-surface-2 border-border flex shrink-0 items-center justify-between border-b px-2 sm:px-4">
          <div className="flex min-w-0 flex-1">
            {[
              { id: "timeline", label: "Timeline", icon: GalleryVerticalEnd },
              { id: "artifacts", label: "Artifacts", icon: File },
              { id: "replay", label: "Activity", icon: PlayCircle },
            ].map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={cn(
                    "flex h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 border-b-2 px-2 text-xs font-medium transition-colors sm:h-10 sm:flex-none sm:flex-row sm:gap-1.5 sm:px-3",
                    activeTab === tab.id
                      ? "border-primary text-foreground"
                      : "text-muted-foreground hover:text-foreground border-transparent"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="truncate">{tab.label}</span>
                </button>
              )
            })}
          </div>
          {activeTab === "replay" ? (
            <button
              type="button"
              onClick={() => setShowDiagnostics((value) => !value)}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                showDiagnostics
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {showDiagnostics ? "Hide diagnostics" : "Diagnostics"}
            </button>
          ) : null}
        </div>

        <div
          ref={scrollContainerRef}
          className="rk-scrollbar min-h-0 flex-1 overflow-auto px-4 pb-4"
        >
          <AnimatePresence mode="wait">
            {activeTab === "timeline" && toolResults.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex h-full flex-col items-center justify-center gap-3 text-center"
              >
                <div className="bg-surface-3 rounded-lg border p-4">
                  <Globe className="text-muted-foreground/60 h-6 w-6" />
                </div>
                <div>
                  <p className="text-foreground text-sm font-medium">No tool steps yet</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Tool results will appear here as the agent works.
                  </p>
                </div>
              </motion.div>
            ) : activeTab === "timeline" && isScrollMode ? (
              <motion.div
                key="scroll"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="mt-4 space-y-6"
              >
                {toolResults.map((result, index) => {
                  const resultId = `tool-result-${result.id}`
                  const contentPart = toContentPart(result)
                  return (
                    <div key={result.id} id={resultId} className="scroll-mt-4">
                      <div
                        className={cn(
                          "mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                          index === selectedIndex
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "text-muted-foreground border-transparent"
                        )}
                      >
                        <span>Step {index + 1}</span>
                        <span>{toolLabels[result.toolName] ?? result.toolName}</span>
                        <span>{new Date(result.timestamp).toLocaleTimeString()}</span>
                      </div>
                      {result.status === "running" && isResultEmpty(result) ? (
                        <ToolLoadingSkeleton toolName={result.toolName} />
                      ) : (
                        <ToolResultRenderer content={[contentPart]} />
                      )}
                    </div>
                  )
                })}
              </motion.div>
            ) : activeTab === "timeline" && activeEntry ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedIndex}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="mt-4"
                >
                  <div className="text-muted-foreground border-border bg-surface-3 mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md border px-2 py-1 font-mono text-[10px]">
                    <span>{stepLabel}</span>
                    <span>{toolLabels[activeEntry.toolName] ?? activeEntry.toolName}</span>
                    <span>{new Date(activeEntry.timestamp).toLocaleTimeString()}</span>
                  </div>
                  {activeEntry.status === "running" && isResultEmpty(activeEntry) ? (
                    <ToolLoadingSkeleton toolName={activeEntry.toolName} />
                  ) : (
                    <ToolResultRenderer content={[toContentPart(activeEntry)]} />
                  )}
                </motion.div>
              </AnimatePresence>
            ) : activeTab === "artifacts" ? (
              <motion.div
                key="artifacts"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="mt-4 space-y-3"
              >
                {artifacts.length === 0 ? (
                  <div className="text-muted-foreground py-10 text-center text-sm">
                    No artifacts captured yet.
                  </div>
                ) : (
                  artifacts.map((artifact) => (
                    <a
                      key={artifact.url}
                      href={artifact.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group bg-surface-3 hover:bg-surface-4 border-border block rounded-lg border p-3 transition-colors"
                    >
                      <div className="text-primary font-mono text-[10px] font-semibold tracking-[0.12em] uppercase">
                        Artifact
                      </div>
                      <div className="mt-1 text-sm font-medium">{artifact.label}</div>
                      <div className="text-muted-foreground font-mono text-[11px] wrap-anywhere">
                        {artifact.url}
                      </div>
                    </a>
                  ))
                )}
              </motion.div>
            ) : (
              <motion.div
                key="activity"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="mt-4 space-y-3"
              >
                {!showDiagnostics && activityItems.length > 0
                  ? activityItems.map((item, index) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18, ease: "easeOut", delay: index * 0.04 }}
                        className="bg-surface-3 hover:bg-surface-4 border-border rounded-lg border p-3 transition-colors"
                      >
                        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex min-w-0 items-start gap-2 text-sm font-medium wrap-anywhere">
                            <PlayCircle className="mt-0.5 size-4 shrink-0" />
                            {item.title}
                          </div>
                          {item.timestamp ? (
                            <div className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
                              <Clock className="size-3" />
                              {item.timestamp}
                            </div>
                          ) : null}
                        </div>
                        <p className="text-muted-foreground mt-1 text-sm whitespace-pre-wrap">
                          {item.detail}
                        </p>
                        {item.tone ? (
                          <div className="mt-2">
                            <Badge
                              variant="outline"
                              className={
                                item.tone === "success"
                                  ? "border-tool-data/25 bg-tool-data/10 text-tool-data"
                                  : item.tone === "warning"
                                    ? "border-destructive/25 bg-destructive/10 text-destructive"
                                    : "border-tool-json/25 bg-tool-json/10 text-tool-json"
                              }
                            >
                              {item.tone === "success"
                                ? "Completed"
                                : item.tone === "warning"
                                  ? "Attention"
                                  : "In progress"}
                            </Badge>
                          </div>
                        ) : null}
                      </motion.div>
                    ))
                  : null}
                {showDiagnostics && traces.length > 0 ? (
                  <div className="space-y-3">
                    {traces.map((trace) => (
                      <div
                        key={String(trace.id)}
                        className="bg-surface-3 border-border rounded-lg border p-3"
                      >
                        <div className="text-primary font-mono text-[10px] font-semibold tracking-[0.12em] uppercase">
                          Diagnostic trace · {String(trace.mode ?? "general")} ·{" "}
                          {String(trace.model ?? "model")}
                        </div>
                        <JsonTreeViewer
                          json={trace as unknown as JsonValue}
                          className="px-0 pt-3 pb-0"
                          showOnlyKeys={{ keys: [...TRACE_SHOW_ONLY_KEYS] }}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
                {showDiagnostics && replayEvents.length > 0 ? (
                  <div className="space-y-3">
                    {replayEvents.map((event, index) => (
                      <div
                        key={`${String(event.id ?? index)}`}
                        className="bg-surface-3 border-border rounded-lg border p-3"
                      >
                        <div className="text-primary font-mono text-[10px] font-semibold tracking-[0.12em] uppercase">
                          Diagnostic event · {String(event.type ?? "event")}
                        </div>
                        <JsonTreeViewer
                          json={(event.data ?? event) as unknown as JsonValue}
                          className="px-0 pt-3 pb-0"
                          showOnlyKeys={{ keys: [...REPLAY_EVENT_SHOW_ONLY_KEYS] }}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
                {!showDiagnostics && activityItems.length === 0 ? (
                  <div className="text-muted-foreground py-10 text-center text-sm">
                    Activity will appear here after the session runs tools.
                  </div>
                ) : null}
                {showDiagnostics && traces.length === 0 && replayEvents.length === 0 ? (
                  <div className="text-muted-foreground py-10 text-center text-sm">
                    Diagnostics will appear here after the session runs tools.
                  </div>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="bg-surface-2 border-border flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-4 py-2">
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
          <div className="flex items-center divide-x overflow-hidden rounded-md border text-xs">
            <button
              type="button"
              disabled={activeTab !== "timeline" || selectedIndex <= 0 || toolResults.length === 0}
              onClick={() => handleStepChange(selectedIndex - 1)}
              aria-label="Previous step"
              className="hover:bg-muted flex items-center px-2 py-1.5 transition-colors disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <span className="text-muted-foreground px-3 py-1.5 tabular-nums select-none">
              {stepLabel}
            </span>
            <button
              type="button"
              disabled={activeTab !== "timeline" || selectedIndex >= toolResults.length - 1}
              onClick={() => handleStepChange(selectedIndex + 1)}
              aria-label="Next step"
              className="hover:bg-muted flex items-center px-2 py-1.5 transition-colors disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
