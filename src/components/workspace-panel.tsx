"use client"

import { motion } from "framer-motion"
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

export function WorkspacePanel() {
  const { toolResults } = useToolResults()
  const { currentSessionId, messages } = useChat()
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const [showTimeline, setShowTimeline] = React.useState(false)
  const [navigationMode, setNavigationMode] = React.useState<"scroll" | "buttons">("buttons")
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
              {activeTab === "timeline"
                ? toolResults.length > 0
                  ? `${toolResults.length} steps`
                  : "No steps yet"
                : activeTab === "artifacts"
                  ? `${artifacts.length} artifacts`
                  : showDiagnostics
                    ? `${traces.length + replayEvents.length} diagnostics`
                    : `${activityItems.length} activities`}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {currentSessionId ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => downloadBundle("json")}
                >
                  <ArrowDownTray className="size-4" />
                  Export JSON
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => downloadBundle("html")}
                >
                  <ClipboardDocumentList className="size-4" />
                  Replay HTML
                </Button>
              </>
            ) : null}
            {activeEntry ? (
              <div className="rounded-full border px-3 py-1 text-xs">
                Active: {toolLabels[activeEntry.toolName] ?? activeEntry.toolName}
              </div>
            ) : null}
          </div>
        </div>
        <div className="border-b px-4 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {[
                { id: "timeline", label: "Timeline", icon: GalleryVerticalEnd },
                { id: "artifacts", label: "Artifacts", icon: File },
                { id: "replay", label: "Replay", icon: ClipboardDocumentList },
              ].map((tab) => {
                const Icon = tab.icon
                return (
                  <Button
                    key={tab.id}
                    type="button"
                    variant={activeTab === tab.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  >
                    <Icon className="mr-2 size-4" />
                    {tab.label}
                  </Button>
                )
              })}
            </div>
            {activeTab === "replay" ? (
              <Button
                type="button"
                variant={showDiagnostics ? "default" : "outline"}
                size="sm"
                onClick={() => setShowDiagnostics((value) => !value)}
              >
                {showDiagnostics ? "Hide diagnostics" : "Show diagnostics"}
              </Button>
            ) : null}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
          {activeTab === "timeline" && toolResults.length === 0 ? (
            <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
              <div className="flex flex-col items-center gap-2 text-center">
                <Globe className="h-6 w-6" />
                <span>Tool calls will appear here as the agent works.</span>
              </div>
            </div>
          ) : activeTab === "timeline" && isScrollMode ? (
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
          ) : activeTab === "timeline" && activeEntry ? (
            <div className="mt-4">
              <div className="text-muted-foreground mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span>{stepLabel}</span>
                <span>{toolLabels[activeEntry.toolName] ?? activeEntry.toolName}</span>
                <span>{new Date(activeEntry.timestamp).toLocaleTimeString()}</span>
              </div>
              <ToolResultRenderer content={[toContentPart(activeEntry)]} />
            </div>
          ) : activeTab === "artifacts" ? (
            <div className="mt-4 space-y-3">
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
                    className="hover:border-border hover:bg-muted/40 block rounded-xl border p-3 transition"
                  >
                    <div className="text-sm font-medium">{artifact.label}</div>
                    <div className="text-muted-foreground text-xs wrap-anywhere">
                      {artifact.url}
                    </div>
                  </a>
                ))
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {!showDiagnostics && activityItems.length > 0
                ? activityItems.map((item) => (
                    <div key={item.id} className="rounded-xl border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <PlayCircle className="size-4" />
                          {item.title}
                        </div>
                        {item.timestamp ? (
                          <div className="text-muted-foreground flex items-center gap-1 text-xs">
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
                    </div>
                  ))
                : null}
              {showDiagnostics && traces.length > 0 ? (
                <div className="space-y-3">
                  {traces.map((trace) => (
                    <div key={String(trace.id)} className="rounded-xl border p-3">
                      <div className="text-sm font-medium">
                        Diagnostic trace · {String(trace.mode ?? "general")} ·{" "}
                        {String(trace.model ?? "model")}
                      </div>
                      <JsonTreeViewer
                        json={trace as unknown as JsonValue}
                        className="px-0 pt-3 pb-0"
                      />
                    </div>
                  ))}
                </div>
              ) : null}
              {showDiagnostics && replayEvents.length > 0 ? (
                <div className="space-y-3">
                  {replayEvents.map((event, index) => (
                    <div key={`${String(event.id ?? index)}`} className="rounded-xl border p-3">
                      <div className="text-sm font-medium">
                        Diagnostic event · {String(event.type ?? "event")}
                      </div>
                      <JsonTreeViewer
                        json={(event.data ?? event) as unknown as JsonValue}
                        className="px-0 pt-3 pb-0"
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
            </div>
          )}
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
              disabled={activeTab !== "timeline" || selectedIndex <= 0 || toolResults.length === 0}
              onClick={() => handleStepChange(selectedIndex - 1)}
              aria-label="Previous step"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={activeTab !== "timeline" || selectedIndex >= toolResults.length - 1}
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
