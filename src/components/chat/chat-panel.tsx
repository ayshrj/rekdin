"use client"

import * as React from "react"
import { toast } from "sonner"

import { toolLabels } from "@/components/tools/tool-labels"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useChat } from "@/contexts/chat-context"
import { ArrowPath, ClipboardDocumentList, Cog8Tooth, Sparkles } from "@/lib/icons"
import { parseLLMError } from "@/lib/llm-errors"
import { WORKFLOW_PRESETS } from "@/lib/workflows"

import { ChatInput } from "./chat-input"
import { ChatMessage } from "./chat-message"

export function ChatPanel() {
  const {
    messages,
    isLoading,
    isThinking,
    sendMessage,
    currentSessionId,
    sessions,
    llmProvider,
    openRouterApiKey,
    openAIApiKey,
    azureOpenAIApiKey,
  } = useChat()
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const scrollViewportRef = React.useRef<HTMLDivElement | null>(null)
  const stickToBottomRef = React.useRef(true)
  const lastMessageIdRef = React.useRef<string | null>(null)
  const scrollRafRef = React.useRef<number | null>(null)
  const [latestChunk, setLatestChunk] = React.useState("")
  const lastDraftIdRef = React.useRef<string | null>(null)
  const lastDraftLenRef = React.useRef(0)
  const [hydrated, setHydrated] = React.useState(false)
  const [showAllTools, setShowAllTools] = React.useState(false)
  const missingApiKey = React.useMemo(() => {
    if (llmProvider === "openai") return !openAIApiKey
    if (llmProvider === "azure_openai") return !azureOpenAIApiKey
    return !openRouterApiKey
  }, [azureOpenAIApiKey, llmProvider, openAIApiKey, openRouterApiKey])
  const missingApiKeyMessage = React.useMemo(() => {
    if (!missingApiKey) return ""
    if (llmProvider === "openai") return "Add your OpenAI API key to use chat."
    if (llmProvider === "azure_openai") {
      return "Add your Azure OpenAI API key to use chat."
    }
    return "Add your OpenRouter API key to use chat."
  }, [llmProvider, missingApiKey])

  React.useEffect(() => {
    const viewport = scrollRef.current?.closest<HTMLDivElement>(
      "[data-slot='scroll-area-viewport']"
    )
    if (!viewport) return
    scrollViewportRef.current = viewport

    const updateStickiness = () => {
      const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
      stickToBottomRef.current = distanceFromBottom < 120
    }

    updateStickiness()
    viewport.addEventListener("scroll", updateStickiness, { passive: true })
    return () => {
      viewport.removeEventListener("scroll", updateStickiness)
    }
  }, [])

  React.useEffect(() => {
    const viewport = scrollViewportRef.current
    if (!viewport) return

    if (latestChunk) return

    const lastId = messages[messages.length - 1]?.id ?? null
    const lastChanged = lastId !== lastMessageIdRef.current
    lastMessageIdRef.current = lastId

    const shouldAutoScroll = stickToBottomRef.current || lastChanged
    if (!shouldAutoScroll) return

    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current)
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRef.current?.scrollIntoView({ block: "end", behavior: isThinking ? "auto" : "smooth" })
    })
  }, [currentSessionId, isThinking, latestChunk, messages])

  React.useEffect(() => {
    if (!latestChunk) return
    const viewport = scrollViewportRef.current
    if (!viewport) return

    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current)
    scrollRafRef.current = requestAnimationFrame(() => {
      viewport.scrollTo({ top: 0, behavior: "auto" })
    })
  }, [latestChunk])

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

  sessions.find((session) => session.id === currentSessionId)
  const toolsSorted = React.useMemo(
    () =>
      Object.entries(toolLabels).sort((a, b) =>
        a[1].localeCompare(b[1], undefined, { sensitivity: "base" })
      ),
    []
  )
  const toolPreview = showAllTools ? toolsSorted : toolsSorted.slice(0, 24)
  const examplePrompts = React.useMemo(
    () => [
      {
        title: "Web research + summary",
        prompt:
          "Research the latest updates about Next.js 16. Summarize the key changes, include 5 source links, and give a short migration checklist.",
      },
      {
        title: "Browse a page and extract data",
        prompt:
          "Open https://example.com and extract the main title, the first 5 links, and any pricing info. Return as JSON.",
      },
      {
        title: "Generate a LaTeX PDF",
        prompt:
          "Create a one-page LaTeX resume template for a frontend engineer and generate a PDF. Keep it ATS-friendly and include sections for Skills, Experience, and Projects.",
      },
    ],
    []
  )
  const launchWorkflow = React.useCallback(
    async (workflowId: string, prompt?: string) => {
      const workflow = WORKFLOW_PRESETS.find((entry) => entry.id === workflowId)
      if (!workflow) return
      await sendMessage(prompt ?? workflow.prompt, [], {
        agentType: workflow.mode,
        responseSchema: workflow.responseSchema ?? null,
        workflowId: workflow.id,
      })
    },
    [sendMessage]
  )
  const queueWorkflow = React.useCallback(
    async (workflowId: string, prompt?: string) => {
      const workflow = WORKFLOW_PRESETS.find((entry) => entry.id === workflowId)
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
    [currentSessionId]
  )

  if (!hydrated) {
    return (
      <div className="bg-card flex h-full flex-col overflow-hidden rounded-xl border shadow-(--shadow-panel)">
        <div className="border-b px-4 py-3">
          <div className="bg-muted h-4 w-32 animate-pulse rounded" />
        </div>
        <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
          Loading chat…
        </div>
        <div className="px-3 pt-1 pb-3 opacity-50">
          <ChatInput onSend={() => Promise.resolve()} isLoading disabled />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card flex h-full flex-col overflow-hidden rounded-xl border shadow-(--shadow-panel)">
      <ScrollArea
        className="no-scroll-min-width min-h-0 flex-1 px-4 py-4"
        onWheelCapture={(event) => event.stopPropagation()}
        onTouchMoveCapture={(event) => event.stopPropagation()}
      >
        <div className="flex w-full flex-col gap-3">
          {latestChunk ? (
            <div className="bg-primary/5 sticky top-0 z-10 mb-2 w-full rounded-lg border px-3 py-2 backdrop-blur">
              <p className="text-primary/60 text-[10px] font-medium tracking-wider uppercase">
                Streaming
              </p>
              <div className="text-sm leading-relaxed whitespace-pre-wrap">{latestChunk}</div>
            </div>
          ) : null}
          {messages.length === 0 ? (
            <div className="mx-auto mt-12 w-full max-w-xl text-center">
              <div className="mb-4 flex justify-center">
                <div className="bg-muted/50 rounded-xl border p-3">
                  <Sparkles className="text-muted-foreground h-5 w-5" />
                </div>
              </div>
              <h3 className="text-foreground mb-1 text-sm font-semibold">Start a research task</h3>
              <p className="text-muted-foreground mb-6 text-xs leading-relaxed">
                Ask Rekdin to use tools (web, browser automation, files, code, PDFs). Be specific
                about output format and constraints.
              </p>

              {missingApiKeyMessage ? (
                <div className="bg-muted/40 border-border mb-4 rounded-lg border px-4 py-3 text-left text-sm">
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

              <div className="bg-muted/40 rounded-lg border p-3 text-left">
                <div className="mb-4">
                  <p className="text-foreground text-sm font-semibold">Workflow presets</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {WORKFLOW_PRESETS.map((workflow) => (
                      <div key={workflow.id} className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
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
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-foreground text-sm font-semibold">Available tools</p>
                    <p className="text-muted-foreground text-xs">
                      {toolsSorted.length} tools available
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllTools((prev) => !prev)}
                  >
                    {showAllTools ? "Show fewer" : "Show all"}
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {toolPreview.map(([key, label]) => (
                    <Badge key={key} variant="secondary" title={key} className="max-w-full">
                      <span className="truncate">{label}</span>
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 text-left md:grid-cols-3">
                {examplePrompts.map((item, index) => (
                  <div key={item.title} className="bg-muted/30 rounded-lg border p-3">
                    <p className="text-foreground mb-2 text-sm font-semibold">{item.title}</p>
                    <pre className="text-muted-foreground mb-3 text-xs wrap-break-word whitespace-pre-wrap">
                      {item.prompt}
                    </pre>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        void launchWorkflow(
                          WORKFLOW_PRESETS[index]?.id ?? "workspace-edit",
                          item.prompt
                        )
                      }
                    >
                      <ClipboardDocumentList className="mr-2 h-4 w-4" />
                      Run preset
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, index) => {
              const prev = messages[index - 1]
              const showHeader = !prev || prev.role !== message.role
              return <ChatMessage key={message.id} message={message} showHeader={showHeader} />
            })
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>
      <div className="bg-muted/30 shrink-0 border-t px-4 py-2">
        <div className="flex gap-1.5 overflow-x-auto sm:flex-wrap">
          {WORKFLOW_PRESETS.map((workflow) => (
            <div key={workflow.id} className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
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
      {(() => {
        const lastMsg = messages[messages.length - 1]
        const hasError = lastMsg?.role === "system"
        const lastUserMsg = hasError ? [...messages].reverse().find((m) => m.role === "user") : null
        if (!hasError || !lastUserMsg) return null
        const parsed = parseLLMError(lastMsg.content ?? "")
        return (
          <div className="border-destructive/20 bg-destructive/5 mx-3 mb-2 rounded-lg border px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                {parsed.code !== null && (
                  <span className="bg-destructive/15 text-destructive shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                    {parsed.code}
                  </span>
                )}
                <p className="text-destructive truncate text-xs font-medium">{parsed.title}</p>
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
                    responseSchema: null,
                    workflowId: lastUserMsg.metadata?.workflowId,
                  })
                }
              >
                <ArrowPath className="h-3 w-3" />
                Retry
              </Button>
            </div>
            {parsed.action && (
              <p className="text-destructive/70 mt-1 text-[11px]">{parsed.action}</p>
            )}
          </div>
        )
      })()}
      <div
        className="px-3 pt-1 pb-3 sm:pb-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <ChatInput onSend={sendMessage} isLoading={isLoading || isThinking} disabled={false} />
      </div>
    </div>
  )
}
