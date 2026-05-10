"use client"

import * as React from "react"
import { toast } from "sonner"

import { Markdown } from "@/components/markdown"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogShell } from "@/components/ui/dialog"
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

      <div className="rk-scrollbar max-h-80 space-y-3 overflow-y-auto px-4 py-2">
        <span className="border-tool-json/35 bg-tool-json/15 text-tool-json inline-flex rounded-sm border px-2 py-0.5 font-mono text-xs">
          {approval.toolName}
        </span>
        {primaryEntries.length > 0 ? (
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
        ) : null}

        {contentEntry ? (
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
        ) : null}

        {secondaryEntries.length > 0 ? (
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
        ) : null}
      </div>

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

/**
 * Renders the primary chat surface, workflow launcher, background queue actions, and tool policy
 * selector that feed `ChatContext.sendMessage`.
 */
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
  } = useChat()

  const panelRef = React.useRef<HTMLDivElement | null>(null)
  const scrollViewportRef = React.useRef<HTMLDivElement | null>(null)
  const innerContentRef = React.useRef<HTMLDivElement | null>(null)
  const presetsRef = React.useRef<HTMLDivElement | null>(null)
  const stickToBottomRef = React.useRef(true)
  const lastMessageIdRef = React.useRef<string | null>(null)
  const [latestChunk, setLatestChunk] = React.useState("")
  const lastDraftIdRef = React.useRef<string | null>(null)
  const lastDraftLenRef = React.useRef(0)
  const [hydrated, setHydrated] = React.useState(false)
  const [presetsCanScrollRight, setPresetsCanScrollRight] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")
  const [toolPolicy, setToolPolicy] = React.useState<ToolPolicyProfile>("balanced")
  const [selectedWorkflowId, setSelectedWorkflowId] = React.useState<string | null>(null)
  const [showCommandHelp, setShowCommandHelp] = React.useState(false)
  const chatInputRef = React.useRef<ChatInputHandle | null>(null)

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
  const currentSession = sessions.find((session) => session.id === currentSessionId)
  const sessionTitle = currentSession?.title ?? "New conversation"
  const selectedPolicy = TOOL_POLICY_OPTIONS.find((option) => option.value === toolPolicy)
  const selectedWorkflow = selectedWorkflowId
    ? workflowPresets.find((workflow) => workflow.id === selectedWorkflowId)
    : null

  const missingApiKeyMessage = React.useMemo(() => {
    if (!missingApiKey) return ""
    return getProviderMissingConfigMessage(llmProvider).replace("Set your ", "Add your ")
  }, [llmProvider, missingApiKey])

  // Intercept wheel on the whole panel so scrolling works without clicking first.
  // Uses a non-passive listener so preventDefault() is allowed; skips textareas
  // so the input box can still scroll independently.
  React.useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest("textarea")) return
      const viewport = scrollViewportRef.current
      if (!viewport) return
      e.preventDefault()
      viewport.scrollTop += e.deltaY
    }
    panel.addEventListener("wheel", onWheel, { passive: false })
    return () => panel.removeEventListener("wheel", onWheel)
  }, [])

  // Detect whether the presets bar has hidden overflow to the right
  React.useEffect(() => {
    const el = presetsRef.current
    if (!el) return
    const check = () =>
      setPresetsCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
    check()
    el.addEventListener("scroll", check, { passive: true })
    window.addEventListener("resize", check, { passive: true })
    return () => {
      el.removeEventListener("scroll", check)
      window.removeEventListener("resize", check)
    }
  }, [])

  // Stickiness detection — tracks whether the user is near the bottom
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

  // ResizeObserver: follow content growth instantly while stuck to bottom.
  // Using instant scrollTop (no smooth) means no animation ever competes with
  // itself — the root cause of the streaming bounce.
  React.useEffect(() => {
    const viewport = scrollViewportRef.current
    const inner = innerContentRef.current
    if (!viewport || !inner) return
    const observer = new ResizeObserver(() => {
      if (stickToBottomRef.current) {
        viewport.scrollTop = viewport.scrollHeight
      }
    })
    observer.observe(inner)
    return () => observer.disconnect()
  }, [])

  // Scroll to bottom on session switch
  React.useEffect(() => {
    const viewport = scrollViewportRef.current
    if (viewport) viewport.scrollTop = viewport.scrollHeight
  }, [currentSessionId])

  // Scroll to bottom + re-enable stickiness when a brand-new message arrives
  React.useEffect(() => {
    const lastId = messages[messages.length - 1]?.id ?? null
    if (lastId === lastMessageIdRef.current) return
    lastMessageIdRef.current = lastId
    stickToBottomRef.current = true
    const viewport = scrollViewportRef.current
    if (viewport) viewport.scrollTop = viewport.scrollHeight
  }, [messages])

  // Track thinking / draft chunk for the inline indicator
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

  const launchWorkflow = React.useCallback(
    (workflowId: string) => {
      const workflow = workflowPresets.find((entry) => entry.id === workflowId)
      if (!workflow) return
      setSelectedWorkflowId(workflow.id)
      setInputValue(workflow.prompt)
      setTimeout(() => chatInputRef.current?.focus(), 0)
    },
    [workflowPresets]
  )

  const queueWorkflow = React.useCallback(
    async (workflowId: string, prompt?: string) => {
      const workflow = workflowPresets.find((entry) => entry.id === workflowId)
      if (!workflow) return
      if (!currentSessionId) {
        toast.error("Open a session before queueing a background workflow.")
        return
      }
      const response = await fetch("/api/background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId,
          message: prompt ?? workflow.prompt,
          agentMode: workflow.mode,
          toolPolicy: workflow.toolPolicy ?? toolPolicy,
          workflowId: workflow.id,
          responseSchema: workflow.responseSchema ?? null,
        }),
      }).catch(() => null)
      if (!response?.ok) {
        toast.error("Unable to queue the background workflow.")
        return
      }
      toast.success(`${workflow.title} queued in the background.`)
    },
    [currentSessionId, toolPolicy, workflowPresets]
  )

  const handleInputChange = React.useCallback((nextValue: string) => {
    setInputValue(nextValue)
    if (!nextValue.trim()) {
      setSelectedWorkflowId(null)
    }
  }, [])

  const handleSend = React.useCallback(
    async (content: string, attachments: File[]) => {
      const slashCommand = parseSlashCommand(content)
      if (slashCommand) {
        const { command, args } = slashCommand
        if (command.handlerType === "workflow" && command.workflowId) {
          const workflow = workflowPresets.find((entry) => entry.id === command.workflowId)
          if (!workflow) {
            toast.error(`Workflow not found for ${command.usage}`)
            return
          }
          const prompt = buildWorkflowPrompt(workflow, args)
          if (command.backgroundPreferred && workflow.supportsBackground && currentSessionId) {
            await queueWorkflow(workflow.id, prompt)
            return
          }
          await sendMessage(prompt, attachments, {
            agentType: workflow.mode,
            toolPolicy: workflow.toolPolicy ?? toolPolicy,
            workflowId: workflow.id,
            responseSchema: workflow.responseSchema ?? null,
          })
          return
        }
        if (command.id === "workspace" || command.id === "settings") {
          window.dispatchEvent(
            new CustomEvent("rekdin:open-settings", {
              detail: { tab: command.id === "workspace" ? "workspace" : "model" },
            })
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
      }
      const workflow = selectedWorkflowId
        ? workflowPresets.find((entry) => entry.id === selectedWorkflowId)
        : null
      await sendMessage(content, attachments, {
        agentType: workflow?.mode,
        toolPolicy: workflow?.toolPolicy ?? toolPolicy,
        workflowId: workflow?.id,
        responseSchema: workflow?.responseSchema ?? null,
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
      workflowPresets,
    ]
  )

  if (!hydrated) {
    return (
      <div className="bg-surface-2 flex h-full flex-col overflow-hidden">
        <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
          Loading…
        </div>
        <div className="border-border bg-surface-3 border-t px-4 py-3 opacity-50">
          <ChatInput
            value=""
            onValueChange={() => {}}
            onSend={() => Promise.resolve()}
            isLoading
            disabled
          />
        </div>
      </div>
    )
  }

  // Error state
  const lastMsg = messages[messages.length - 1]
  const hasError = lastMsg?.role === "system"
  const lastUserMsg = hasError ? [...messages].reverse().find((m) => m.role === "user") : null
  const errorParsed = hasError && lastMsg ? parseLLMError(lastMsg.content ?? "") : null

  return (
    <div ref={panelRef} className="bg-surface-2 flex h-full flex-col overflow-hidden">
      <header
        className={cn(
          "bg-surface-2 border-border flex h-12 shrink-0 items-center justify-between border-b px-4",
          isThinking && "rk-running-line"
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {isThinking ? (
            <span className="bg-tool-json size-1.5 animate-pulse rounded-full" />
          ) : null}
          <h2 className="truncate text-base font-semibold" title={sessionTitle}>
            {sessionTitle}
          </h2>
        </div>
        <div className="flex items-center gap-1">
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
            aria-label="Export current session"
          >
            <ClipboardDocumentList className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <div
        ref={scrollViewportRef}
        className="rk-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
      >
        <div ref={innerContentRef} className="flex w-full flex-col gap-3">
          {messages.length === 0 ? (
            <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center py-8">
              <div className="mb-6 text-center">
                <div className="bg-surface-3 mx-auto mb-4 flex size-12 items-center justify-center rounded-lg border">
                  <RekdinIcon className="text-primary h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold">Rekdin</h3>
                <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm leading-relaxed">
                  Research, automate, inspect tool execution, and keep the workspace trail visible.
                </p>
              </div>

              {missingApiKeyMessage ? (
                <div className="border-status-warning/35 bg-status-warning/10 mb-5 rounded-lg border px-4 py-3 text-left text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-status-warning mt-0.5">
                      <Cog8Tooth className="h-4 w-4" />
                    </span>
                    <div className="space-y-1">
                      <p className="text-foreground">{missingApiKeyMessage}</p>
                      <p className="text-muted-foreground text-xs">
                        Open Settings to add the provider credentials.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mb-6">
                <p className="rk-section-label mb-2">Capabilities</p>
                <div className="grid grid-cols-2 gap-2">
                  {capabilities.map((cap) => {
                    const Icon = cap.icon
                    return (
                      <div
                        key={cap.label}
                        className="bg-surface-3 border-border flex items-center gap-2 rounded-md border px-3 py-2"
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

              {/* Workflow presets */}
              <div>
                <p className="rk-section-label mb-2">Workflow presets</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {workflowPresets.map((workflow) => (
                    <button
                      key={workflow.id}
                      type="button"
                      disabled={isLoading || isThinking}
                      onClick={() => void launchWorkflow(workflow.id)}
                      className="bg-surface-3 hover:bg-surface-4 border-border h-20 w-full cursor-pointer rounded-lg border p-4 text-left transition-colors disabled:pointer-events-none disabled:opacity-40"
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-foreground min-w-0 truncate text-sm font-medium">
                          {workflow.title}
                        </span>
                        {workflow.supportsBackground ? (
                          <span className="bg-tool-json/15 text-tool-json shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-medium">
                            BG
                          </span>
                        ) : null}
                      </div>
                      <p className="text-muted-foreground line-clamp-1 text-xs leading-relaxed">
                        {workflow.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ── Message list ────────────────────────────────── */
            messages.map((message, index) => {
              const prev = messages[index - 1]
              const showHeader = !prev || prev.role !== message.role
              return <ChatMessage key={message.id} message={message} showHeader={showHeader} />
            })
          )}

          {/* Thinking indicator — inline at bottom, never sticky */}
          {latestChunk ? (
            <div className="bg-surface-2/70 flex items-start gap-2.5 rounded-xl border px-3 py-2.5">
              <span className="bg-primary mt-1.25 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full" />
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground mb-0.5 text-[10px] font-semibold tracking-wider uppercase">
                  Thinking
                </p>
                <p className="text-muted-foreground line-clamp-5 text-xs leading-relaxed whitespace-pre-wrap">
                  {latestChunk}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Workflow presets bar ───────────────────────────────── */}
      <div className="bg-surface-2 border-border relative shrink-0 border-t">
        {presetsCanScrollRight ? (
          <div className="bg-surface-2 pointer-events-none absolute top-0 right-0 z-10 h-full w-4" />
        ) : null}
        <div ref={presetsRef} className="rk-scrollbar flex gap-2 overflow-x-auto px-4 py-2">
          {workflowPresets.map((workflow) => (
            <div key={workflow.id} className="flex shrink-0 items-center">
              <button
                type="button"
                className={cn(
                  "bg-surface-3 border-border text-muted-foreground hover:bg-surface-4 hover:text-foreground h-7 rounded-full border px-3 text-xs transition-colors",
                  selectedWorkflowId === workflow.id &&
                    "bg-primary text-primary-foreground border-primary hover:bg-primary hover:text-primary-foreground"
                )}
                onClick={() => void launchWorkflow(workflow.id)}
                disabled={isLoading || isThinking}
              >
                {workflow.title}
              </button>
              {workflow.supportsBackground ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-tool-json h-7 rounded-full px-2 font-mono text-[10px]"
                  onClick={() => void queueWorkflow(workflow.id)}
                  disabled={isLoading || isThinking || !currentSessionId}
                >
                  Queue
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* ── Error banner ──────────────────────────────────────── */}
      {hasError && lastUserMsg && errorParsed ? (
        <div className="border-destructive/35 bg-destructive/10 border-t px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              {errorParsed.code !== null && (
                <span className="bg-destructive/15 text-destructive shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                  {errorParsed.code}
                </span>
              )}
              <p className="text-destructive truncate text-xs font-medium">{errorParsed.title}</p>
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
      ) : null}

      {/* ── Input ─────────────────────────────────────────────── */}
      <div
        className="bg-surface-3 border-border border-t px-4 py-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <div className="bg-surface-2 border-border -mx-4 mb-3 flex items-center justify-between gap-3 border-b px-4 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <Globe className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
            <span
              className={cn(
                "truncate font-mono text-xs",
                workspaceRoot ? "text-muted-foreground" : "text-muted-foreground italic"
              )}
              title={workspaceRoot || "App root (default)"}
            >
              {workspaceRoot || "App root (default)"}
            </span>
          </div>
          <button
            type="button"
            className="text-primary text-xs hover:underline"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("rekdin:open-settings", { detail: { tab: "workspace" } })
              )
            }
          >
            Change
          </button>
        </div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="bg-surface-3 border-border flex rounded-md border p-1">
            {TOOL_POLICY_OPTIONS.map((option) => {
              const Icon = option.icon
              const active = toolPolicy === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={isLoading || isThinking}
                  title={option.description}
                  onClick={() => setToolPolicy(option.value)}
                  className={cn(
                    "text-muted-foreground flex h-7 items-center gap-1.5 rounded-sm px-2 text-xs transition-colors disabled:pointer-events-none disabled:opacity-40",
                    active && option.value === "read_only" && "bg-surface-4 text-foreground",
                    active &&
                      option.value === "balanced" &&
                      "bg-status-warning/15 text-status-warning",
                    active && option.value === "full_auto" && "bg-primary/15 text-primary"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {option.shortLabel}
                </button>
              )
            })}
          </div>
          <p className="text-muted-foreground min-w-0 flex-1 truncate text-right text-xs">
            {selectedPolicy?.description}
          </p>
        </div>
        {selectedWorkflow ? (
          <div className="border-primary/35 bg-primary/10 mb-3 rounded-lg border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-foreground text-sm font-medium">{selectedWorkflow.title}</p>
                <p className="text-muted-foreground mt-1 line-clamp-1 text-xs">
                  {selectedWorkflow.description}
                </p>
              </div>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedWorkflowId(null)}
                aria-label="Clear selected workflow"
              >
                <XMark className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
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
            isLoading={isLoading || isThinking}
            disabled={false}
          />
        )}
      </div>
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
