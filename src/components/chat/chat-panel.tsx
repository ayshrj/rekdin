"use client"

import * as React from "react"
import { toast } from "sonner"

import { Markdown } from "@/components/markdown"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogShell } from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  Rekdin as RekdinIcon,
} from "@/lib/icons"
import { parseLLMError } from "@/lib/llm-errors"
import { getProviderMissingConfigMessage, hasProviderCredentials } from "@/lib/llm-providers"
import { getAllWorkflowPresets } from "@/lib/workflows"
import type { ToolApprovalRequest, ToolPolicyProfile } from "@/types/runtime"

import { ChatInput, ChatInputHandle } from "./chat-input"
import { ChatMessage } from "./chat-message"

const TOOL_POLICY_OPTIONS: Array<{
  value: ToolPolicyProfile
  label: string
  description: string
}> = [
  {
    value: "read_only",
    label: "Read only",
    description: "Inspect without writes, commands, exports, or browser mutations.",
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "Inspect first, then allow targeted write or browser actions.",
  },
  {
    value: "full_auto",
    label: "Full auto",
    description: "Allow the broadest toolset supported by the selected mode.",
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
    <div className="bg-background ring-border/50 rounded-xl border shadow-(--shadow-float) ring-1">
      <div className="border-b px-3 py-2.5">
        <p className="text-foreground text-xs font-semibold">Approve tool execution</p>
        <p className="text-muted-foreground mt-0.5 text-[11px]">
          Rekdin wants to run{" "}
          <span className="text-foreground font-mono font-semibold">{approval.toolName}</span>.
          {approval.reason ? ` ${approval.reason}` : ""}
        </p>
      </div>

      <div className="max-h-80 space-y-3 overflow-y-auto p-3">
        {primaryEntries.length > 0 ? (
          <div className="grid gap-2">
            {primaryEntries.map(([key, value]) => (
              <div key={key} className="bg-muted/30 rounded-lg border px-3 py-2">
                <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                  {formatApprovalLabel(key)}
                </p>
                <p className="text-foreground mt-1 font-mono text-xs break-all">
                  {formatApprovalValue(value)}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {contentEntry ? (
          <div className="overflow-hidden rounded-lg border">
            <div className="bg-muted/30 border-b px-3 py-2">
              <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                {formatApprovalLabel(contentEntry[0])} preview
              </p>
            </div>
            <Markdown className="text-foreground max-h-64 overflow-auto p-3 text-xs">
              {String(contentEntry[1])}
            </Markdown>
          </div>
        ) : null}

        {secondaryEntries.length > 0 ? (
          <div className="overflow-hidden rounded-lg border">
            <div className="bg-muted/30 border-b px-3 py-2">
              <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Additional details
              </p>
            </div>
            <div className="divide-y">
              {secondaryEntries.map(([key, value]) => (
                <div key={key} className="grid gap-1 px-3 py-2">
                  <p className="text-muted-foreground text-xs">{formatApprovalLabel(key)}</p>
                  <p className="text-foreground text-xs break-words">
                    {formatApprovalValue(value)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="bg-muted/30 flex items-center justify-end gap-2 border-t px-3 py-2">
        <Button type="button" variant="outline" size="sm" onClick={onReject}>
          Reject
        </Button>
        <Button type="button" size="sm" onClick={onApprove}>
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
      <div className="bg-card flex h-full flex-col overflow-hidden rounded-xl border shadow-(--shadow-panel)">
        <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
          Loading…
        </div>
        <div className="px-3 pt-1 pb-3 opacity-50">
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
    <div
      ref={panelRef}
      className="bg-card flex h-full flex-col overflow-hidden rounded-xl border shadow-(--shadow-panel)"
    >
      <div
        ref={scrollViewportRef}
        className="[&::-webkit-scrollbar-thumb]:bg-border min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
      >
        <div ref={innerContentRef} className="flex w-full flex-col gap-3">
          {messages.length === 0 ? (
            /* ── Empty state ─────────────────────────────────── */
            <div className="mx-auto w-full max-w-sm py-6">
              {/* Hero row */}
              <div className="mb-5 flex items-center gap-3">
                <div className="bg-primary/10 shrink-0 rounded-xl p-2.5">
                  <RekdinIcon className="text-primary h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-foreground text-sm font-bold">Rekdin</h3>
                  <p className="text-muted-foreground text-xs">
                    AI research &amp; automation workspace
                  </p>
                </div>
              </div>

              {/* API key warning */}
              {missingApiKeyMessage ? (
                <div className="bg-muted/40 border-border mb-5 rounded-lg border px-4 py-3 text-left text-sm">
                  <div className="flex items-start gap-2">
                    <span className="bg-primary/10 text-primary mt-0.5 rounded-md p-1">
                      <Cog8Tooth className="h-4 w-4" />
                    </span>
                    <div className="space-y-1">
                      <p className="text-foreground">{missingApiKeyMessage}</p>
                      <p className="text-muted-foreground text-xs">
                        Open Settings in the top-right corner to add it.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Capabilities grid */}
              <div className="mb-5">
                <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wider uppercase">
                  What it can do
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {capabilities.map((cap) => {
                    const Icon = cap.icon
                    return (
                      <div
                        key={cap.label}
                        className="bg-muted/30 border-border/50 flex items-center gap-2 rounded-lg border px-2.5 py-2"
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
                <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wider uppercase">
                  Workflow presets
                </p>
                <div className="space-y-1.5">
                  {workflowPresets.map((workflow) => (
                    <button
                      key={workflow.id}
                      type="button"
                      disabled={isLoading || isThinking}
                      onClick={() => void launchWorkflow(workflow.id)}
                      className="border-border/60 bg-muted/30 hover:bg-muted/60 w-full cursor-pointer rounded-xl border p-3 text-left transition-colors disabled:pointer-events-none disabled:opacity-50"
                    >
                      <div className="mb-0.5 flex items-center justify-between gap-2">
                        <span className="text-foreground text-xs font-semibold">
                          {workflow.title}
                        </span>
                        {workflow.supportsBackground ? (
                          <span className="bg-primary/10 text-primary shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold">
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
            <div className="bg-muted/40 flex items-start gap-2.5 rounded-xl border px-3 py-2.5">
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
      <div className="relative shrink-0 border-t">
        {presetsCanScrollRight && (
          <div className="from-card pointer-events-none absolute top-0 right-0 z-10 h-full w-10 bg-linear-to-l to-transparent" />
        )}
        <div
          ref={presetsRef}
          className="flex gap-1 overflow-x-auto px-3 py-1.5 [&::-webkit-scrollbar]:h-0"
        >
          {workflowPresets.map((workflow) => (
            <div key={workflow.id} className="flex shrink-0 items-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => void launchWorkflow(workflow.id)}
                disabled={isLoading || isThinking}
              >
                {workflow.title}
              </Button>
              {workflow.supportsBackground ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground h-7 text-xs"
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
        <div className="border-destructive/20 bg-destructive/5 mx-3 mb-2 rounded-lg border px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              {errorParsed.code !== null && (
                <span className="bg-destructive/15 text-destructive shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
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
        className="px-3 pt-1 pb-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Tool policy
            </p>
            <p className="text-muted-foreground truncate text-[11px]">
              {TOOL_POLICY_OPTIONS.find((option) => option.value === toolPolicy)?.description}
            </p>
          </div>
          <Select
            value={toolPolicy}
            onValueChange={(value) => setToolPolicy(value as ToolPolicyProfile)}
            disabled={isLoading || isThinking}
          >
            <SelectTrigger size="sm" className="bg-background h-8 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top" align="end">
              {TOOL_POLICY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="bg-muted/30 text-muted-foreground mb-2 rounded-lg border px-2.5 py-1.5 text-[11px]">
          Workspace:{" "}
          <span className="text-foreground font-medium break-all">
            {workspaceRoot || "Default app root"}
          </span>
        </div>
        {selectedWorkflowId ? (
          <div className="bg-muted/40 text-muted-foreground mb-2 rounded-lg border px-2.5 py-1.5 text-[11px]">
            Workflow preset selected:{" "}
            <span className="text-foreground font-medium">
              {workflowPresets.find((workflow) => workflow.id === selectedWorkflowId)?.title}
            </span>
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
