"use client"

import * as React from "react"
import { toast } from "sonner"

import { Markdown } from "@/components/markdown"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogShell } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { WorkspaceSelector } from "@/components/workspace-selector"
import { useChat } from "@/contexts/chat-context"
import { buildWorkflowPrompt, parseSlashCommand, renderSlashCommandHelp } from "@/lib/commands"
import {
  ArrowPath,
  Bolt,
  ClipboardDocumentList,
  Cog8Tooth,
  CursorArrowRays,
  Eye,
  GalleryVerticalEnd,
  Globe,
  LockClosed,
  Rekdin as RekdinIcon,
  XMark,
} from "@/lib/icons"
import { parseLLMError } from "@/lib/llm-errors"
import { getProviderMissingConfigMessage, hasProviderCredentials } from "@/lib/llm-providers"
import { cn } from "@/lib/utils"
import { getAllWorkflowPresets } from "@/lib/workflows"
import type { ToolApprovalRequest, ToolPolicyProfile } from "@/types/runtime"

import { ChatInput, ChatInputHandle } from "./chat-input"
import { ChatMessage } from "./chat-message"

// ─── Constants ───────────────────────────────────────────────────────────────

const TOOL_POLICY_OPTIONS: Array<{
  value: ToolPolicyProfile
  label: string
  shortLabel: string
  description: string
  icon: typeof Eye
}> = [
  {
    value: "read_only",
    label: "Read only",
    shortLabel: "Read",
    description: "Inspect without writes, commands, exports, or browser mutations.",
    icon: Eye,
  },
  {
    value: "balanced",
    label: "Balanced",
    shortLabel: "Balanced",
    description: "Inspect first, then allow targeted write or browser actions.",
    icon: LockClosed,
  },
  {
    value: "full_auto",
    label: "Full auto",
    shortLabel: "Auto",
    description: "Allow the broadest toolset supported by the selected mode.",
    icon: Bolt,
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isToolPolicyProfile(value: unknown): value is ToolPolicyProfile {
  return value === "read_only" || value === "balanced" || value === "full_auto"
}

function formatApprovalValue(value: unknown) {
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (value == null) return ""
  return JSON.stringify(value, null, 2)
}

function formatApprovalLabel(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

// ─── ToolApprovalComposer ─────────────────────────────────────────────────────

function ToolApprovalComposer({
  approval,
  onApprove,
  onReject,
}: {
  approval: ToolApprovalRequest
  onApprove: () => void
  onReject: () => void
}) {
  const args = approval.arguments
  const primaryKeys = ["path", "filePath", "command", "url", "query", "selector"]
  const contentKeys = ["content", "markdown", "text", "replacement"]
  const primaryEntries = primaryKeys
    .filter((key) => args[key] !== undefined)
    .map((key) => [key, args[key]] as const)
  const contentEntry = contentKeys
    .map((key) => [key, args[key]] as const)
    .find(([, value]) => typeof value === "string" && value.length > 0)
  const hiddenKeys = new Set([...primaryKeys, ...contentKeys])
  const secondaryEntries = Object.entries(args).filter(([key]) => !hiddenKeys.has(key))

  return (
    <div className="border-tool-json/40 overflow-hidden rounded-t-xl border-t bg-[#181420]">
      {/* Header */}
      <div className="border-border/60 px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <LockClosed className="text-tool-json h-4 w-4" />
          <p className="text-tool-json text-sm font-semibold">Action Required</p>
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          Rekdin wants to run <span className="text-tool-json font-mono">{approval.toolName}</span>.
          {approval.reason ? ` ${approval.reason}` : ""}
        </p>
      </div>

      {/* Scrollable args */}
      <div className="rk-scrollbar max-h-80 space-y-3 overflow-y-auto px-4 py-2">
        <span className="border-tool-json/35 bg-tool-json/15 text-tool-json inline-flex rounded-sm border px-2 py-0.5 font-mono text-xs">
          {approval.toolName}
        </span>

        {primaryEntries.length > 0 && (
          <div className="grid gap-2">
            {primaryEntries.map(([key, value]) => (
              <div key={key} className="border-border border-t py-2">
                <p className="text-muted-foreground text-xs">{formatApprovalLabel(key)}</p>
                <p className="text-foreground mt-1 font-mono text-sm break-all">
                  {formatApprovalValue(value)}
                </p>
              </div>
            ))}
          </div>
        )}

        {contentEntry && (
          <div className="border-border overflow-hidden rounded-md border">
            <div className="bg-surface-4 border-b px-3 py-2">
              <p className="text-muted-foreground text-xs">
                {formatApprovalLabel(contentEntry[0])} preview
              </p>
            </div>
            <Markdown className="rk-scrollbar text-foreground max-h-25 overflow-auto p-3 text-xs">
              {String(contentEntry[1])}
            </Markdown>
          </div>
        )}

        {secondaryEntries.length > 0 && (
          <div className="border-border overflow-hidden rounded-md border">
            <div className="bg-surface-4 border-b px-3 py-2">
              <p className="text-muted-foreground text-xs">Additional details</p>
            </div>
            <div className="divide-y">
              {secondaryEntries.map(([key, value]) => (
                <div key={key} className="grid gap-1 px-3 py-2">
                  <p className="text-muted-foreground text-xs">{formatApprovalLabel(key)}</p>
                  <p className="text-foreground text-xs wrap-break-word">
                    {formatApprovalValue(value)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2 px-4 pt-2 pb-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onReject}
        >
          Reject
        </Button>
        <Button
          type="button"
          size="sm"
          className="bg-status-success text-black hover:bg-[#2adba0]"
          onClick={onApprove}
        >
          Approve
        </Button>
      </div>
    </div>
  )
}

// ─── ProviderPill ─────────────────────────────────────────────────────────────
// Shows the active provider + model in the header. Green dot = connected,
// amber = partial, red = missing credentials.

function ProviderPill({
  provider,
  model,
  missing,
}: {
  provider: string
  model: string | undefined
  missing: boolean
}) {
  const dotColor = missing ? "bg-destructive" : "bg-status-success"

  const label = missing
    ? `${provider} · no key`
    : model
      ? `${provider} · ${model.split("/").pop()}`
      : provider

  return (
    <div className="rk-provider-pill">
      <span className={cn("rk-provider-dot", dotColor)} />
      <span className="max-w-40 truncate">{label}</span>
    </div>
  )
}

function getOverflowValue(element: HTMLElement, axis: "x" | "y") {
  const style = window.getComputedStyle(element)
  return axis === "x" ? style.overflowX : style.overflowY
}

function allowsScroll(element: HTMLElement, axis: "x" | "y") {
  const overflow = getOverflowValue(element, axis)
  return overflow === "auto" || overflow === "scroll" || overflow === "overlay"
}

function canScrollInDirection(element: HTMLElement, axis: "x" | "y", delta: number) {
  if (delta === 0 || !allowsScroll(element, axis)) return false

  if (axis === "y") {
    if (element.scrollHeight <= element.clientHeight + 1) return false
    if (delta < 0) return element.scrollTop > 0
    return element.scrollTop + element.clientHeight < element.scrollHeight - 1
  }

  if (element.scrollWidth <= element.clientWidth + 1) return false
  if (delta < 0) return element.scrollLeft > 0
  return element.scrollLeft + element.clientWidth < element.scrollWidth - 1
}

function getNestedWheelTarget({
  target,
  boundary,
  viewport,
  deltaX,
  deltaY,
}: {
  target: EventTarget | null
  boundary: HTMLElement
  viewport: HTMLElement
  deltaX: number
  deltaY: number
}): { element: HTMLElement; mode: "native" | "horizontal-from-vertical" } | null {
  if (!(target instanceof HTMLElement)) return null

  let element: HTMLElement | null = target
  while (element && element !== boundary) {
    if (element !== viewport) {
      if (
        canScrollInDirection(element, "y", deltaY) ||
        canScrollInDirection(element, "x", deltaX)
      ) {
        return { element, mode: "native" }
      }

      if (
        Math.abs(deltaY) > Math.abs(deltaX) &&
        canScrollInDirection(element, "x", deltaY) &&
        !canScrollInDirection(element, "y", deltaY)
      ) {
        return { element, mode: "horizontal-from-vertical" }
      }
    }

    element = element.parentElement
  }

  return null
}

// ─── WorkflowBar ──────────────────────────────────────────────────────────────
// Compact horizontal chip row that lives above the composer meta row.

function WorkflowBar({
  presets,
  selectedId,
  isDisabled,
  onLaunch,
  onQueue,
  currentSessionId,
}: {
  presets: ReturnType<typeof getAllWorkflowPresets>
  selectedId: string | null
  isDisabled: boolean
  onLaunch: (id: string) => void
  onQueue: (id: string) => void
  currentSessionId: string | null
}) {
  const barRef = React.useRef<HTMLDivElement>(null)
  const [canScrollRight, setCanScrollRight] = React.useState(false)

  React.useEffect(() => {
    const el = barRef.current
    if (!el) return
    const check = () => setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
    check()
    el.addEventListener("scroll", check, { passive: true })
    window.addEventListener("resize", check, { passive: true })
    return () => {
      el.removeEventListener("scroll", check)
      window.removeEventListener("resize", check)
    }
  }, [])

  return (
    <div id="tour-workflow-bar" className="border-border relative border-b">
      {canScrollRight && (
        <div className="from-surface-2 pointer-events-none absolute top-0 right-0 z-10 h-full w-6 bg-linear-to-l to-transparent" />
      )}
      <div
        ref={barRef}
        className="rk-scrollbar flex items-center gap-1.5 overflow-x-auto px-3 py-1.5"
      >
        <span className="rk-workflow-bar-label">Workflows</span>
        {presets.map((wf) => (
          <div key={wf.id} className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              disabled={isDisabled}
              onClick={() => onLaunch(wf.id)}
              className={cn("rk-workflow-chip", selectedId === wf.id && "rk-workflow-chip--active")}
            >
              {wf.title}
              {wf.supportsBackground && <span className="rk-workflow-bg-badge">BG</span>}
            </button>
            {wf.supportsBackground && (
              <button
                type="button"
                disabled={isDisabled || !currentSessionId}
                onClick={() => onQueue(wf.id)}
                className="rk-workflow-queue-btn"
                title={`Queue ${wf.title} in background`}
              >
                Queue
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── ContextUsageRing ─────────────────────────────────────────────────────────
// Circular progress ring showing approximate context usage vs the 12k-token
// trimHistory budget. Clicking it triggers /compact.

const CONTEXT_TOKEN_BUDGET = 12_000

function ContextUsageRing({
  pct,
  isDisabled,
  onClick,
}: {
  pct: number
  isDisabled: boolean
  onClick: () => void
}) {
  const radius = 8
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - Math.min(pct, 1))
  const displayPct = Math.round(Math.min(pct, 1) * 100)

  const colorClass =
    pct > 0.85 ? "text-destructive" : pct > 0.6 ? "text-status-warning" : "text-status-success"

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={isDisabled}
            onClick={onClick}
            className={cn(
              "relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
              colorClass,
              isDisabled && "opacity-50"
            )}
            aria-label="Context usage — click to compact"
          >
            <svg className="absolute h-5 w-5 -rotate-90" viewBox="0 0 20 20" fill="none">
              <circle
                cx="10"
                cy="10"
                r={radius}
                strokeWidth="2"
                stroke="currentColor"
                className="opacity-20"
              />
              <circle
                cx="10"
                cy="10"
                r={radius}
                strokeWidth="2"
                stroke="currentColor"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <span className="relative z-10 font-mono text-[6px] leading-none font-bold tabular-nums">
              {displayPct}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="center" className="text-xs">
          ~{displayPct}% context used · Click to compact
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ─── ComposerMeta ─────────────────────────────────────────────────────────────
// Single row: workspace path left, policy selector right.

function ComposerMeta({
  workspaceRoot,
  toolPolicy,
  isDisabled,
  onChangeWorkspace,
  onChangePolicy,
  rightSlot,
}: {
  workspaceRoot: string | null
  toolPolicy: ToolPolicyProfile
  isDisabled: boolean
  onChangeWorkspace: () => void
  onChangePolicy: (p: ToolPolicyProfile) => void
  rightSlot?: React.ReactNode
}) {
  return (
    <div id="tour-composer-meta" className="rk-composer-meta">
      {/* Workspace path */}
      <div className="flex min-w-0 items-center gap-1.5">
        <Globe className="text-muted-foreground h-3 w-3 shrink-0" />
        <span
          className={cn("rk-composer-path", !workspaceRoot && "italic")}
          title={workspaceRoot || "App root (default)"}
        >
          {workspaceRoot || "App root (default)"}
        </span>
      </div>

      {/* Right: context ring + change + policy */}
      <div className="flex shrink-0 items-center gap-2">
        {rightSlot}
        <button type="button" className="rk-composer-change-btn" onClick={onChangeWorkspace}>
          Change
        </button>

        {/* Policy segmented control */}
        <TooltipProvider delayDuration={250}>
          <div className="rk-policy-seg">
            {TOOL_POLICY_OPTIONS.map((opt) => {
              const active = toolPolicy === opt.value
              const Icon = opt.icon
              return (
                <Tooltip key={opt.value}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      disabled={isDisabled}
                      onClick={() => onChangePolicy(opt.value)}
                      className={cn(
                        "rk-policy-btn",
                        active && opt.value === "read_only" && "rk-policy-btn--read",
                        active && opt.value === "balanced" && "rk-policy-btn--balanced",
                        active && opt.value === "full_auto" && "rk-policy-btn--auto"
                      )}
                    >
                      <Icon className="rk-policy-icon" />
                      {opt.shortLabel}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="center" className="max-w-64 text-xs">
                    <p className="font-medium">{opt.label}</p>
                    <p className="text-muted-foreground mt-1">{opt.description}</p>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </TooltipProvider>
      </div>
    </div>
  )
}

// ─── ChatPanel ────────────────────────────────────────────────────────────────

export function ChatPanel() {
  const {
    messages,
    sessions,
    isLoading,
    isThinking,
    sendMessage,
    createSession,
    currentSessionId,
    pendingToolApproval,
    resolveToolApproval,
    customWorkflows,
    llmProvider,
    openRouterApiKey,
    openRouterModel,
    openAIApiKey,
    openAIModel,
    geminiApiKey,
    geminiModel,
    claudeApiKey,
    claudeModel,
    grokApiKey,
    grokModel,
    azureOpenAIApiKey,
    azureOpenAIEndpoint,
    azureOpenAIApiVersion,
    azureOpenAIDeployment,
    workspaceRoot,
    applyCompaction,
  } = useChat()

  // ── Refs ────────────────────────────────────────────────────────────────────
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  const scrollViewportRef = React.useRef<HTMLDivElement | null>(null)
  const innerContentRef = React.useRef<HTMLDivElement | null>(null)
  const stickToBottomRef = React.useRef(true)
  const lastMessageIdRef = React.useRef<string | null>(null)
  const lastDraftIdRef = React.useRef<string | null>(null)
  const lastDraftLenRef = React.useRef(0)
  const chatInputRef = React.useRef<ChatInputHandle | null>(null)

  // ── State ───────────────────────────────────────────────────────────────────
  const [latestChunk, setLatestChunk] = React.useState("")
  const [hydrated, setHydrated] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")
  const [toolPolicy, setToolPolicy] = React.useState<ToolPolicyProfile>("balanced")
  const [selectedWorkflowId, setSelectedWorkflowId] = React.useState<string | null>(null)
  const [showCommandHelp, setShowCommandHelp] = React.useState(false)
  const [showWorkspaceSelector, setShowWorkspaceSelector] = React.useState(false)
  const [isCompacting, setIsCompacting] = React.useState(false)

  // ── Context usage ───────────────────────────────────────────────────────────
  const contextPct = React.useMemo(() => {
    const used = messages
      .filter((m) => !m.metadata?.compactionMarker)
      .reduce((sum, m) => {
        const contentTokens = Math.ceil((m.content ?? "").length / 4)
        const toolTokens = (m.toolCalls ?? []).reduce(
          (s, tc) => s + Math.ceil(JSON.stringify(tc.result ?? "").length / 4),
          0
        )
        return sum + contentTokens + toolTokens
      }, 0)
    return used / CONTEXT_TOKEN_BUDGET
  }, [messages])

  // ── Derived ─────────────────────────────────────────────────────────────────
  const missingApiKey = React.useMemo(
    () =>
      !hasProviderCredentials(llmProvider, {
        openRouterModel,
        openRouterApiKey,
        openAIModel,
        openAIApiKey,
        geminiModel,
        geminiApiKey,
        claudeModel,
        claudeApiKey,
        grokModel,
        grokApiKey,
        azureOpenAIApiKey,
        azureOpenAIEndpoint,
        azureOpenAIApiVersion,
        azureOpenAIDeployment,
      }),
    [
      azureOpenAIApiKey,
      azureOpenAIApiVersion,
      azureOpenAIDeployment,
      azureOpenAIEndpoint,
      claudeApiKey,
      claudeModel,
      geminiApiKey,
      geminiModel,
      grokApiKey,
      grokModel,
      llmProvider,
      openAIApiKey,
      openAIModel,
      openRouterApiKey,
      openRouterModel,
    ]
  )

  const workflowPresets = React.useMemo(
    () => getAllWorkflowPresets(customWorkflows),
    [customWorkflows]
  )

  const currentSession = sessions.find((s) => s.id === currentSessionId)
  const sessionTitle = currentSession?.title ?? "New conversation"
  const selectedWorkflow = selectedWorkflowId
    ? workflowPresets.find((wf) => wf.id === selectedWorkflowId)
    : null

  const activeModel = React.useMemo(() => {
    switch (llmProvider) {
      case "openrouter":
        return openRouterModel
      case "openai":
        return openAIModel
      case "gemini":
        return geminiModel
      case "claude":
        return claudeModel
      case "grok":
        return grokModel
      case "azure_openai":
        return azureOpenAIDeployment
      default:
        return undefined
    }
  }, [
    llmProvider,
    openRouterModel,
    openAIModel,
    geminiModel,
    claudeModel,
    grokModel,
    azureOpenAIDeployment,
  ])

  const missingApiKeyMessage = React.useMemo(() => {
    if (!missingApiKey) return ""
    return "Choose a provider and add its required credentials and model in Settings first."
  }, [missingApiKey])

  const capabilities = React.useMemo(
    () => [
      { label: "Web research", icon: Globe },
      { label: "Browser automation", icon: CursorArrowRays },
      { label: "Live tool timeline", icon: GalleryVerticalEnd },
      { label: "Background jobs", icon: Bolt },
      { label: "Structured output", icon: ClipboardDocumentList },
      { label: "Replay & traces", icon: Eye },
    ],
    []
  )

  // ── Scroll: intercept wheel on panel so scrolling works without clicking ────
  React.useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest("textarea")) return
      const viewport = scrollViewportRef.current
      if (!viewport) return

      const nestedWheelTarget = getNestedWheelTarget({
        target: e.target,
        boundary: panel,
        viewport,
        deltaX: e.deltaX,
        deltaY: e.deltaY,
      })

      if (nestedWheelTarget?.mode === "native") return
      if (nestedWheelTarget?.mode === "horizontal-from-vertical") {
        e.preventDefault()
        nestedWheelTarget.element.scrollLeft += e.deltaY
        return
      }

      e.preventDefault()
      viewport.scrollTop += e.deltaY
    }
    panel.addEventListener("wheel", onWheel, { passive: false })
    return () => panel.removeEventListener("wheel", onWheel)
  }, [])

  // ── Scroll: stickiness detection ────────────────────────────────────────────
  React.useEffect(() => {
    const viewport = scrollViewportRef.current
    if (!viewport) return
    const updateStickiness = () => {
      stickToBottomRef.current =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 120
    }
    updateStickiness()
    viewport.addEventListener("scroll", updateStickiness, { passive: true })
    return () => viewport.removeEventListener("scroll", updateStickiness)
  }, [])

  // ── Scroll: ResizeObserver follows content while stuck ──────────────────────
  React.useEffect(() => {
    const viewport = scrollViewportRef.current
    const inner = innerContentRef.current
    if (!viewport || !inner) return
    const observer = new ResizeObserver(() => {
      if (stickToBottomRef.current) viewport.scrollTop = viewport.scrollHeight
    })
    observer.observe(inner)
    return () => observer.disconnect()
  }, [])

  // ── Scroll: jump on session switch ──────────────────────────────────────────
  React.useEffect(() => {
    const viewport = scrollViewportRef.current
    if (viewport) viewport.scrollTop = viewport.scrollHeight
  }, [currentSessionId])

  // ── Scroll: jump + re-enable stickiness on new message ──────────────────────
  React.useEffect(() => {
    const lastId = messages[messages.length - 1]?.id ?? null
    if (lastId === lastMessageIdRef.current) return
    lastMessageIdRef.current = lastId
    stickToBottomRef.current = true
    const viewport = scrollViewportRef.current
    if (viewport) viewport.scrollTop = viewport.scrollHeight
  }, [messages])

  // ── Thinking chunk tracker ───────────────────────────────────────────────────
  React.useEffect(() => {
    const draft = [...messages]
      .reverse()
      .find((msg) => msg.role === "assistant" && Boolean(msg.metadata?.thinking))
    if (!draft) {
      setLatestChunk("")
      lastDraftIdRef.current = null
      lastDraftLenRef.current = 0
      return
    }
    if (draft.id !== lastDraftIdRef.current) {
      lastDraftIdRef.current = draft.id
      lastDraftLenRef.current = 0
      setLatestChunk("")
    }
    const content = draft.content ?? ""
    if (draft.metadata?.workflowId && content.trimStart().startsWith("{")) {
      setLatestChunk("Building structured workflow result...")
      lastDraftLenRef.current = content.length
      return
    }
    const prevLen = lastDraftLenRef.current
    const nextLen = content.length
    if (nextLen > prevLen) {
      const delta = content.slice(prevLen)
      if (delta.trim().length > 0) setLatestChunk(delta)
    } else if (nextLen < prevLen) {
      setLatestChunk(content.slice(-200))
    }
    lastDraftLenRef.current = nextLen
  }, [messages])

  React.useEffect(() => {
    setHydrated(true)
  }, [])

  React.useEffect(() => {
    const openWorkspace = () => setShowWorkspaceSelector(true)
    window.addEventListener("rekdin:open-workspace", openWorkspace)
    return () => window.removeEventListener("rekdin:open-workspace", openWorkspace)
  }, [])

  // ── Workflow helpers ─────────────────────────────────────────────────────────
  const launchWorkflow = React.useCallback(
    (workflowId: string) => {
      const wf = workflowPresets.find((w) => w.id === workflowId)
      if (!wf) return
      setSelectedWorkflowId(wf.id)
      setInputValue(wf.prompt)
      setTimeout(() => chatInputRef.current?.focus(), 0)
    },
    [workflowPresets]
  )

  const queueWorkflow = React.useCallback(
    async (workflowId: string, prompt?: string) => {
      const wf = workflowPresets.find((w) => w.id === workflowId)
      if (!wf) return
      if (!currentSessionId) {
        toast.error("Open a session before queueing a background workflow.")
        return
      }
      const res = await fetch("/api/background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId,
          message: prompt ?? wf.prompt,
          agentMode: wf.mode,
          toolPolicy: wf.toolPolicy ?? toolPolicy,
          workflowId: wf.id,
          responseSchema: wf.responseSchema ?? null,
        }),
      }).catch(() => null)
      if (!res?.ok) {
        toast.error("Unable to queue the background workflow.")
        return
      }
      toast.success(`${wf.title} queued in the background.`)
    },
    [currentSessionId, toolPolicy, workflowPresets]
  )

  const handleInputChange = React.useCallback((nextValue: string) => {
    setInputValue(nextValue)
    if (!nextValue.trim()) setSelectedWorkflowId(null)
  }, [])

  const triggerCompact = React.useCallback(
    async (focus?: string) => {
      if (!currentSessionId) {
        toast.error("Open a session before compacting.")
        return
      }
      setIsCompacting(true)
      try {
        const res = await fetch("/api/compact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: currentSessionId, focus }),
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error ?? "Compact failed")
        }
        const { summary } = (await res.json()) as { summary: string }
        applyCompaction(currentSessionId, summary)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Compact failed")
      } finally {
        setIsCompacting(false)
      }
    },
    [applyCompaction, currentSessionId]
  )

  const handleSend = React.useCallback(
    async (content: string, attachments: File[]) => {
      const slashCommand = parseSlashCommand(content)
      if (slashCommand) {
        const { command, args } = slashCommand
        if (command.handlerType === "workflow" && command.workflowId) {
          const wf = workflowPresets.find((w) => w.id === command.workflowId)
          if (!wf) {
            toast.error(`Workflow not found for ${command.usage}`)
            return
          }
          const prompt = buildWorkflowPrompt(wf, args)
          if (command.backgroundPreferred && wf.supportsBackground && currentSessionId) {
            await queueWorkflow(wf.id, prompt)
            return
          }
          await sendMessage(prompt, attachments, {
            agentType: wf.mode,
            toolPolicy: wf.toolPolicy ?? toolPolicy,
            workflowId: wf.id,
            responseSchema: wf.responseSchema ?? null,
          })
          return
        }
        if (command.id === "workspace") {
          setShowWorkspaceSelector(true)
          return
        }
        if (command.id === "settings") {
          window.dispatchEvent(
            new CustomEvent("rekdin:open-settings", { detail: { tab: "model" } })
          )
          return
        }
        if (command.id === "export") {
          if (!currentSessionId) {
            toast.error("Open a session before exporting.")
            return
          }
          window.open(`/api/sessions/${currentSessionId}/export`, "_blank", "noopener,noreferrer")
          return
        }
        if (command.id === "clear") {
          await createSession()
          return
        }
        if (command.id === "help") {
          setShowCommandHelp(true)
          return
        }
        if (command.id === "compact") {
          await triggerCompact(args?.trim() || undefined)
          return
        }
      }

      const wf = selectedWorkflowId
        ? workflowPresets.find((w) => w.id === selectedWorkflowId)
        : null
      await sendMessage(content, attachments, {
        agentType: wf?.mode,
        toolPolicy: wf?.toolPolicy ?? toolPolicy,
        workflowId: wf?.id,
        responseSchema: wf?.responseSchema ?? null,
      })
      setSelectedWorkflowId(null)
    },
    [
      createSession,
      currentSessionId,
      queueWorkflow,
      selectedWorkflowId,
      sendMessage,
      toolPolicy,
      triggerCompact,
      workflowPresets,
    ]
  )

  // ── Error state ──────────────────────────────────────────────────────────────
  const lastMsg = messages[messages.length - 1]
  const hasError = lastMsg?.role === "system" && !lastMsg?.metadata?.compactionMarker
  const lastUserMsg = hasError ? [...messages].reverse().find((m) => m.role === "user") : null
  const errorParsed = hasError && lastMsg ? parseLLMError(lastMsg.content ?? "") : null

  // ── Hydration skeleton ───────────────────────────────────────────────────────
  if (!hydrated) {
    return (
      <div className="bg-surface-2 flex h-full flex-col overflow-hidden">
        <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
          Loading…
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div ref={panelRef} className="bg-surface-2 flex h-full flex-col overflow-hidden">
      {/* ── Global header ───────────────────────────────────────────────────── */}
      <header className={cn("rk-chat-header", isThinking && "rk-running-line")}>
        <div className="flex min-w-0 items-center gap-2.5">
          {isThinking && (
            <span className="bg-tool-json h-1.5 w-1.5 shrink-0 animate-pulse rounded-full" />
          )}
          <h2 className="text-foreground truncate text-sm font-semibold" title={sessionTitle}>
            {sessionTitle}
          </h2>
          <ProviderPill provider={llmProvider} model={activeModel} missing={missingApiKey} />
        </div>

        <div className="flex items-center gap-1">
          {/* Export */}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-md"
            disabled={!currentSessionId}
            onClick={() =>
              currentSessionId &&
              window.open(
                `/api/sessions/${currentSessionId}/export`,
                "_blank",
                "noopener,noreferrer"
              )
            }
            aria-label="Export session"
          >
            <ClipboardDocumentList className="h-4 w-4" />
          </Button>
          {/* Settings */}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-md"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("rekdin:open-settings", { detail: { tab: "model" } })
              )
            }
            aria-label="Open settings"
          >
            <Cog8Tooth className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* ── Chat/workspace tabs ─────────────────────────────────────────────── */}
      <div className="bg-surface-2 border-border flex h-10 shrink-0 items-center border-b px-4">
        <button
          type="button"
          className={cn("rk-tab", !showWorkspaceSelector && "rk-tab-active")}
          onClick={() => setShowWorkspaceSelector(false)}
        >
          <RekdinIcon className="h-3.5 w-3.5" />
          Chat
        </button>
        <button
          type="button"
          className={cn("rk-tab", showWorkspaceSelector && "rk-tab-active")}
          onClick={() => setShowWorkspaceSelector(true)}
        >
          <GalleryVerticalEnd className="h-3.5 w-3.5" />
          Workspace
        </button>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1">
        {showWorkspaceSelector ? (
          <WorkspaceSelector active onClose={() => setShowWorkspaceSelector(false)} />
        ) : (
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Missing provider banner */}
            {missingApiKey && (
              <div className="border-status-warning/30 bg-status-warning/8 border-b px-4 py-2.5">
                <div className="flex items-start gap-2">
                  <Cog8Tooth className="text-status-warning mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                    <p className="text-foreground text-xs">{missingApiKeyMessage}</p>
                    <button
                      type="button"
                      className="text-primary shrink-0 text-xs hover:underline"
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent("rekdin:open-settings", { detail: { tab: "model" } })
                        )
                      }
                    >
                      Open Settings
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Message list */}
            <div
              ref={scrollViewportRef}
              className="rk-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5"
            >
              <div ref={innerContentRef} className="flex w-full flex-col">
                {/* ── Empty state ──────────────────────────────────────────────── */}
                {messages.length === 0 ? (
                  <div className="mx-auto flex min-h-full w-full max-w-xl flex-col justify-center py-10">
                    {/* Logo + intro */}
                    <div className="mb-8 text-center">
                      <div className="border-border bg-surface-3 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border">
                        <RekdinIcon className="text-primary h-6 w-6" />
                      </div>
                      <h3 className="text-foreground text-xl font-semibold">Rekdin</h3>
                      <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-relaxed">
                        Research, automate, and inspect every tool execution — workspace trail
                        always visible.
                      </p>
                    </div>

                    {/* Capabilities grid */}
                    <div className="mb-6">
                      <p className="rk-section-label mb-2.5">Capabilities</p>
                      <div className="grid grid-cols-2 gap-2">
                        {capabilities.map((cap) => {
                          const Icon = cap.icon
                          return (
                            <div
                              key={cap.label}
                              className="border-border bg-surface-3 flex items-center gap-2 rounded-md border px-3 py-2"
                            >
                              <Icon className="text-primary h-3.5 w-3.5 shrink-0" />
                              <span className="text-foreground truncate text-xs font-medium">
                                {cap.label}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Workflow preset tiles */}
                    <div>
                      <p className="rk-section-label mb-2.5">Workflow presets</p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {workflowPresets.map((wf) => (
                          <button
                            key={wf.id}
                            type="button"
                            disabled={isLoading || isThinking}
                            onClick={() => void launchWorkflow(wf.id)}
                            className="rk-preset-tile"
                          >
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span className="text-foreground min-w-0 truncate text-sm font-medium">
                                {wf.title}
                              </span>
                              {wf.supportsBackground && (
                                <span className="rk-workflow-bg-badge shrink-0">BG</span>
                              )}
                            </div>
                            <p className="text-muted-foreground line-clamp-1 text-left text-xs leading-relaxed">
                              {wf.description}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ── Message list ──────────────────────────────────────────── */
                  <>
                    {messages.map((message, index) => {
                      const prev = messages[index - 1]
                      const showHeader = !prev || prev.role !== message.role
                      return (
                        <ChatMessage key={message.id} message={message} showHeader={showHeader} />
                      )
                    })}

                    {/* Inline thinking indicator */}
                    {latestChunk && (
                      <div className="rk-thinking-bar">
                        <span className="rk-thinking-dot" />
                        <div className="min-w-0 flex-1">
                          <p className="rk-thinking-label">Thinking</p>
                          <p className="rk-thinking-text line-clamp-4 whitespace-pre-wrap">
                            {latestChunk}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ── Error banner ──────────────────────────────────────────────────── */}
            {hasError && lastUserMsg && errorParsed && (
              <div className="border-destructive/35 bg-destructive/8 border-t px-4 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {errorParsed.code !== null && (
                      <span className="bg-destructive/15 text-destructive shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                        {errorParsed.code}
                      </span>
                    )}
                    <p className="text-destructive truncate text-xs font-medium">
                      {errorParsed.title}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive h-7 shrink-0 gap-1.5 text-xs"
                    disabled={isLoading || isThinking}
                    onClick={() =>
                      void sendMessage(lastUserMsg.content, [], {
                        agentType: lastUserMsg.metadata?.agentType,
                        toolPolicy: isToolPolicyProfile(lastUserMsg.metadata?.toolPolicy)
                          ? lastUserMsg.metadata.toolPolicy
                          : toolPolicy,
                        responseSchema: null,
                        workflowId: lastUserMsg.metadata?.workflowId,
                      })
                    }
                  >
                    <ArrowPath className="h-3 w-3" />
                    Retry
                  </Button>
                </div>
                {errorParsed.action && (
                  <p className="text-destructive/70 mt-1 text-[11px]">{errorParsed.action}</p>
                )}
              </div>
            )}

            {/* ── Composer ──────────────────────────────────────────────────────── */}
            <div className="rk-composer-shell">
              {/* 1. Workflow chip bar */}
              <WorkflowBar
                presets={workflowPresets}
                selectedId={selectedWorkflowId}
                isDisabled={isLoading || isThinking}
                onLaunch={launchWorkflow}
                onQueue={queueWorkflow}
                currentSessionId={currentSessionId}
              />

              {/* 2. Workspace path + policy — single row */}
              <ComposerMeta
                workspaceRoot={workspaceRoot}
                toolPolicy={toolPolicy}
                isDisabled={isLoading || isThinking}
                onChangeWorkspace={() => setShowWorkspaceSelector(true)}
                onChangePolicy={setToolPolicy}
                rightSlot={
                  messages.length > 0 ? (
                    <ContextUsageRing
                      pct={contextPct}
                      isDisabled={isLoading || isThinking || isCompacting}
                      onClick={() => void triggerCompact()}
                    />
                  ) : undefined
                }
              />

              {/* 3. Selected workflow card — only when a workflow is loaded */}
              {selectedWorkflow && (
                <div className="rk-selected-workflow">
                  <div className="min-w-0">
                    <p className="text-foreground text-sm font-medium">{selectedWorkflow.title}</p>
                    <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                      {selectedWorkflow.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => setSelectedWorkflowId(null)}
                    aria-label="Clear selected workflow"
                  >
                    <XMark className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* 4. Input — approval replaces it when pending */}
              <div
                className="px-3 pb-3"
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
              >
                {pendingToolApproval ? (
                  <ToolApprovalComposer
                    approval={pendingToolApproval}
                    onApprove={() => resolveToolApproval(true)}
                    onReject={() => resolveToolApproval(false)}
                  />
                ) : (
                  <ChatInput
                    ref={chatInputRef}
                    value={inputValue}
                    onValueChange={handleInputChange}
                    onSend={handleSend}
                    isLoading={isLoading || isThinking || isCompacting}
                    disabled={false}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Slash command help dialog ────────────────────────────────────────── */}
      <Dialog open={showCommandHelp} onOpenChange={setShowCommandHelp}>
        <DialogShell
          title="Slash commands"
          description="Type / in the composer to search commands, then press Enter or Tab to insert."
          footer={
            <DialogClose asChild>
              <Button type="button">Close</Button>
            </DialogClose>
          }
        >
          <div className="px-6 py-4">
            <pre className="bg-muted/40 text-foreground overflow-x-auto rounded-xl border p-3 font-mono text-xs leading-6 whitespace-pre-wrap">
              {renderSlashCommandHelp()}
            </pre>
          </div>
        </DialogShell>
      </Dialog>
    </div>
  )
}
