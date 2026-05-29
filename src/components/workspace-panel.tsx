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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ToolResultEntry, useChat, useToolResults } from "@/contexts/chat-context"
import {
  ArrowDownTray,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronRight as ChevronRightSmall,
  ClipboardDocumentList,
  Clock,
  File,
  FolderTree,
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

function ToolLoadingSkeleton({ toolName, startTime }: { toolName: string; startTime?: string }) {
  const [elapsed, setElapsed] = React.useState(0)

  React.useEffect(() => {
    const base = startTime ? Date.now() - new Date(startTime).getTime() : 0
    setElapsed(Math.floor(base / 1000))
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [startTime])

  return (
    <div className="rk-tool-card w-full space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="bg-primary h-1.5 w-1.5 shrink-0 animate-pulse rounded-full" />
          <span className="text-primary truncate font-mono text-[10px] font-semibold tracking-[0.12em] uppercase">
            {toolLabels[toolName] ?? toolName}
          </span>
        </div>
        <span className="text-muted-foreground shrink-0 font-mono text-[10px] tabular-nums">
          {elapsed}s
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

function TimelineHeatmap({
  toolResults,
  selectedIndex,
  onSelect,
}: {
  toolResults: ToolResultEntry[]
  selectedIndex: number
  onSelect: (index: number) => void
}) {
  const BUCKETS = 32
  const times = toolResults.map((r) => new Date(r.timestamp).getTime()).filter(Boolean)
  if (times.length < 2) return null
  const min = Math.min(...times)
  const max = Math.max(...times)
  const range = max - min || 1

  const buckets = Array.from({ length: BUCKETS }, (_, i) => {
    const bucketMin = min + (i / BUCKETS) * range
    const bucketMax = min + ((i + 1) / BUCKETS) * range
    const indices = toolResults
      .map((r, idx) => ({ t: new Date(r.timestamp).getTime(), idx }))
      .filter(({ t }) => t >= bucketMin && (t < bucketMax || i === BUCKETS - 1))
    return { count: indices.length, indices: indices.map((x) => x.idx) }
  })

  const maxCount = Math.max(...buckets.map((b) => b.count), 1)

  return (
    <div className="border-border flex shrink-0 gap-px border-b px-2 py-1.5">
      {buckets.map((bucket, i) => {
        const intensity = bucket.count / maxCount
        const isActive = bucket.indices.includes(selectedIndex)
        return (
          <button
            key={i}
            type="button"
            title={
              bucket.count > 0 ? `${bucket.count} step${bucket.count > 1 ? "s" : ""}` : undefined
            }
            onClick={() => bucket.indices.length > 0 && onSelect(bucket.indices[0]!)}
            className="h-4 flex-1 rounded-[2px] transition-colors"
            style={{
              background: isActive
                ? "var(--primary)"
                : bucket.count === 0
                  ? "var(--surface-4)"
                  : `color-mix(in oklch, var(--primary) ${Math.round(intensity * 80 + 15)}%, var(--surface-4))`,
              opacity: bucket.count === 0 ? 0.35 : 1,
            }}
          />
        )
      })}
    </div>
  )
}

function artifactFileType(url: string): "image" | "pdf" | "video" | "code" | "file" {
  const ext = url.split("?")[0]?.split(".").pop()?.toLowerCase() ?? ""
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"].includes(ext)) return "image"
  if (ext === "pdf") return "pdf"
  if (["mp4", "webm", "mov"].includes(ext)) return "video"
  if (["js", "ts", "tsx", "jsx", "py", "sh", "json", "md", "html", "css"].includes(ext))
    return "code"
  return "file"
}

function ArtifactIcon({ url, label }: { url: string; label: string }) {
  const type = artifactFileType(url)
  const base =
    "border-border bg-surface-4 flex h-full w-full items-center justify-center rounded font-mono text-[10px] font-semibold uppercase"
  if (type === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={label} className="h-full w-full rounded object-cover" loading="lazy" />
    )
  }
  const colors: Record<string, string> = {
    pdf: "text-red-400",
    video: "text-purple-400",
    code: "text-blue-400",
    file: "text-muted-foreground",
  }
  return (
    <div className={`${base} ${colors[type] ?? ""}`}>
      {type === "pdf" ? "PDF" : type === "video" ? "VID" : type === "code" ? "CODE" : "FILE"}
    </div>
  )
}

interface FileTreeNode {
  name: string
  path: string
  hidden: boolean
  size?: number
  ext?: string
  protected?: boolean
  children?: FileTreeNode[]
  isFile?: boolean
  loaded?: boolean
}

function FileTreeNode({
  node,
  depth,
  onPreview,
}: {
  node: FileTreeNode
  depth: number
  onPreview: (path: string) => void
}) {
  const [expanded, setExpanded] = React.useState(depth === 0)
  const [children, setChildren] = React.useState<FileTreeNode[]>([])
  const [loading, setLoading] = React.useState(false)

  const toggle = async () => {
    if (node.isFile) {
      onPreview(node.path)
      return
    }
    if (!expanded && children.length === 0 && !node.protected) {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/workspace/browse?path=${encodeURIComponent(node.path)}&files=true`
        )
        const data = (await res.json()) as {
          directories?: FileTreeNode[]
          files?: Array<{ name: string; path: string; hidden: boolean; size: number; ext: string }>
        }
        const dirs: FileTreeNode[] = (data.directories ?? []).map((d) => ({ ...d, isFile: false }))
        const files: FileTreeNode[] = (data.files ?? []).map((f) => ({ ...f, isFile: true }))
        setChildren([...dirs, ...files])
      } catch {
        /* ignore */
      }
      setLoading(false)
    }
    setExpanded((e) => !e)
  }

  const indent = depth * 12
  const isDir = !node.isFile

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "hover:bg-surface-3 flex w-full items-center gap-1.5 rounded px-2 py-0.5 text-left transition-colors",
          node.hidden && "opacity-50"
        )}
        style={{ paddingLeft: `${8 + indent}px` }}
      >
        {isDir ? (
          <span className="text-muted-foreground shrink-0">
            {loading ? (
              <span className="inline-block h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
            ) : expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRightSmall className="h-3 w-3" />
            )}
          </span>
        ) : (
          <span className="ml-3 shrink-0" />
        )}
        <FolderTree
          open={isDir && expanded}
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            isDir ? "text-primary/70" : "text-muted-foreground"
          )}
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate font-mono text-[11px]",
            isDir ? "text-foreground font-medium" : "text-muted-foreground"
          )}
        >
          {node.name}
        </span>
        {node.isFile && node.size !== undefined && node.size > 0 && (
          <span className="text-muted-foreground shrink-0 font-mono text-[9px]">
            {node.size > 1024 ? `${(node.size / 1024).toFixed(0)}k` : `${node.size}b`}
          </span>
        )}
        {node.protected && (
          <span className="text-muted-foreground/60 shrink-0 font-mono text-[9px]">skip</span>
        )}
      </button>
      {expanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <FileTreeNode key={child.path} node={child} depth={depth + 1} onPreview={onPreview} />
          ))}
        </div>
      )}
    </div>
  )
}

function FilesTab({ workspaceRoot }: { workspaceRoot: string }) {
  const [rootNodes, setRootNodes] = React.useState<FileTreeNode[]>([])
  const [preview, setPreview] = React.useState<{ path: string; content: string } | null>(null)
  const [loadingPreview, setLoadingPreview] = React.useState(false)

  React.useEffect(() => {
    if (!workspaceRoot) return
    fetch(`/api/workspace/browse?path=${encodeURIComponent(workspaceRoot)}&files=true`)
      .then((r) => r.json())
      .then(
        (data: {
          directories?: FileTreeNode[]
          files?: Array<{ name: string; path: string; hidden: boolean; size: number; ext: string }>
        }) => {
          const dirs = (data.directories ?? []).map((d) => ({ ...d, isFile: false }))
          const files = (data.files ?? []).map((f) => ({ ...f, isFile: true }))
          setRootNodes([...dirs, ...files])
        }
      )
      .catch(() => {})
  }, [workspaceRoot])

  const handlePreview = async (filePath: string) => {
    setLoadingPreview(true)
    setPreview(null)
    try {
      const res = await fetch(`/api/workspace/file?path=${encodeURIComponent(filePath)}`)
      const text = await res.text()
      setPreview({ path: filePath, content: text.slice(0, 4000) })
    } catch {
      setPreview({ path: filePath, content: "(Could not read file)" })
    }
    setLoadingPreview(false)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {preview ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-border bg-surface-3 flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="text-primary font-mono text-[10px] hover:underline"
            >
              ← tree
            </button>
            <span className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-[10px]">
              {preview.path.split("/").slice(-2).join("/")}
            </span>
          </div>
          <pre className="rk-scrollbar rk-code-block min-h-0 flex-1 overflow-auto p-3 text-[11px] leading-relaxed whitespace-pre-wrap">
            {loadingPreview ? "Loading…" : preview.content}
          </pre>
        </div>
      ) : (
        <div className="rk-scrollbar min-h-0 flex-1 overflow-y-auto py-1">
          {rootNodes.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-xs">No workspace selected.</p>
          ) : (
            rootNodes.map((node) => (
              <FileTreeNode key={node.path} node={node} depth={0} onPreview={handlePreview} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function StepRail({
  steps,
  selectedIndex,
  onSelect,
}: {
  steps: ToolResultEntry[]
  selectedIndex: number
  onSelect: (index: number) => void
}) {
  return (
    <TooltipProvider delayDuration={180}>
      <aside className="border-border bg-surface-2/60 hidden w-11 shrink-0 flex-col border-r sm:flex">
        <div className="border-border flex h-9 shrink-0 items-center justify-center border-b">
          <span className="text-muted-foreground font-mono text-[10px] font-medium">
            {steps.length}
          </span>
        </div>
        <div className="rk-scrollbar min-h-0 flex-1 overflow-y-auto px-1.5 py-2">
          <div className="space-y-1">
            {steps.map((step, index) => {
              const active = index === selectedIndex
              const isRunning = step.status === "running"
              const label = toolLabels[step.toolName] ?? step.toolName
              return (
                <Tooltip key={step.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onSelect(index)}
                      aria-label={`Step ${index + 1}: ${label}`}
                      className={cn(
                        "relative flex size-8 items-center justify-center rounded-md font-mono text-[11px] transition-colors",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-surface-4 hover:text-foreground"
                      )}
                    >
                      {index + 1}
                      {isRunning ? (
                        <span className="bg-primary absolute top-1 right-1 size-1.5 animate-pulse rounded-full" />
                      ) : null}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="center" className="max-w-56 text-xs">
                    <div className="space-y-1">
                      <p className="font-medium">Step {index + 1}</p>
                      <p className="text-muted-foreground">{label}</p>
                      <p className="text-muted-foreground/70 font-mono text-[10px]">
                        {new Date(step.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </div>
      </aside>
    </TooltipProvider>
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
export function WorkspacePanel({ onChangeWorkspace }: { onChangeWorkspace?: () => void }) {
  const { toolResults } = useToolResults()
  const { currentSessionId, messages, workspaceRoot } = useChat()
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const [navigationMode, setNavigationMode] = React.useState<"scroll" | "buttons">("buttons")
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null)
  const stepNodeRefs = React.useRef(new Map<string, HTMLDivElement>())
  const [activeTab, setActiveTab] = React.useState<"timeline" | "artifacts" | "replay" | "files">(
    "timeline"
  )
  const [replayEvents, setReplayEvents] = React.useState<Array<Record<string, unknown>>>([])
  const [traces, setTraces] = React.useState<Array<Record<string, unknown>>>([])
  const [backgroundJobs, setBackgroundJobs] = React.useState<Array<Record<string, unknown>>>([])
  const [showDiagnostics, setShowDiagnostics] = React.useState(false)
  const [artifactView, setArtifactView] = React.useState<"list" | "grid">("list")

  React.useEffect(() => {
    if (toolResults.length > 0) {
      setSelectedIndex(toolResults.length - 1)
    }
  }, [toolResults])

  React.useEffect(() => {
    const SUB_TAB_MAP: Record<string, "timeline" | "artifacts" | "replay"> = {
      timeline: "timeline",
      workspace: "timeline",
      background_jobs: "timeline",
      artifacts: "artifacts",
      replay: "replay",
      traces: "replay",
    }
    const handler = (e: Event) => {
      const { action, payload } = (
        e as CustomEvent<{ action: string; payload?: Record<string, unknown> }>
      ).detail
      if (action === "navigate" && payload?.target) {
        const tab = SUB_TAB_MAP[payload.target as string]
        if (tab) setActiveTab(tab)
      }
    }
    window.addEventListener("rekdin:ui-action", handler)
    return () => window.removeEventListener("rekdin:ui-action", handler)
  }, [])

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
    if (!isLastStep || navigationMode !== "scroll") return
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
  const showStepRail = activeTab === "timeline" && toolResults.length > 0
  const stepLabel =
    toolResults.length > 0 ? `Step ${selectedIndex + 1} of ${toolResults.length}` : "No steps yet"

  const handleStepChange = React.useCallback(
    (index: number) => {
      if (index < 0 || index >= toolResults.length) return
      setSelectedIndex(index)
      if (!isScrollMode) return
      const target = stepNodeRefs.current.get(toolResults[index]?.id)
      const container = scrollContainerRef.current
      if (!target || !container) return

      window.requestAnimationFrame(() => {
        const containerRect = container.getBoundingClientRect()
        const targetRect = target.getBoundingClientRect()
        const top = targetRect.top - containerRect.top + container.scrollTop - 16
        container.scrollTo({ top, behavior: "smooth" })
      })
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
            {activeTab === "artifacts" && artifacts.length > 0 && (
              <div className="border-border flex overflow-hidden rounded border">
                {(["list", "grid"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setArtifactView(v)}
                    className={cn(
                      "px-2 py-0.5 font-mono text-[10px] transition-colors",
                      artifactView === v
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {v === "list" ? "≡" : "⊞"}
                  </button>
                ))}
              </div>
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
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 rounded-md text-xs"
              onClick={
                onChangeWorkspace ??
                (() => window.dispatchEvent(new CustomEvent("rekdin:open-workspace")))
              }
            >
              <Globe className="h-3 w-3" />
              Root
            </Button>
            {currentSessionId ? (
              <div className="hidden items-center gap-1 sm:flex">
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
              </div>
            ) : null}
          </div>
        </div>

        {/* Tab bar */}
        <div
          id="tour-workspace-tabs"
          className="bg-surface-2 border-border flex shrink-0 items-center justify-between border-b px-2 sm:px-4"
        >
          <div className="flex min-w-0 flex-1">
            {[
              { id: "timeline", label: "Timeline", icon: GalleryVerticalEnd },
              { id: "artifacts", label: "Artifacts", icon: File },
              { id: "files", label: "Files", icon: FolderTree },
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

        <div className="flex min-h-0 flex-1">
          {showStepRail ? (
            <StepRail
              steps={toolResults}
              selectedIndex={selectedIndex}
              onSelect={handleStepChange}
            />
          ) : null}
          {activeTab === "files" ? (
            <FilesTab workspaceRoot={workspaceRoot ?? ""} />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              {activeTab === "timeline" && toolResults.length > 1 && (
                <TimelineHeatmap
                  toolResults={toolResults}
                  selectedIndex={selectedIndex}
                  onSelect={handleStepChange}
                />
              )}
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
                          <div
                            key={result.id}
                            id={resultId}
                            ref={(node) => {
                              if (node) {
                                stepNodeRefs.current.set(result.id, node)
                              } else {
                                stepNodeRefs.current.delete(result.id)
                              }
                            }}
                            className="scroll-mt-4"
                          >
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
                              <ToolLoadingSkeleton
                                toolName={result.toolName}
                                startTime={result.timestamp}
                              />
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
                      ) : artifactView === "grid" ? (
                        <div className="grid grid-cols-2 gap-2">
                          {artifacts.map((artifact) => (
                            <a
                              key={artifact.url}
                              href={artifact.url}
                              target="_blank"
                              rel="noreferrer"
                              className="group border-border bg-surface-3 hover:bg-surface-4 flex flex-col gap-2 overflow-hidden rounded-lg border p-2 transition-colors"
                            >
                              <div className="border-border h-20 overflow-hidden rounded border">
                                <ArtifactIcon url={artifact.url} label={artifact.label} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-foreground truncate text-xs font-medium">
                                  {artifact.label.split(" · ").pop() ?? artifact.label}
                                </p>
                                <p className="text-muted-foreground truncate font-mono text-[10px]">
                                  {artifact.url.split("/").pop()?.split("?")[0] ?? artifact.url}
                                </p>
                              </div>
                            </a>
                          ))}
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
            </div>
          )}
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
