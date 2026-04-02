"use client"

import * as React from "react"
import { toast } from "sonner"

import { toolLabels } from "@/components/tools/tool-labels"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useChat } from "@/contexts/chat-context"
import { ClipboardDocumentList, Cog8Tooth, Sparkles } from "@/lib/icons"
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

  const currentSession = sessions.find((session) => session.id === currentSessionId)
  const sessionTitle = currentSession?.title ?? "New conversation"
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
      <div className="bg-card flex h-full flex-col rounded-2xl border shadow-sm">
        <div className="border-b px-5 py-4">
          <div className="bg-muted h-5 w-32 animate-pulse rounded" />
        </div>
        <div className="text-muted-foreground flex flex-1 items-center justify-center">
          Loading chat…
        </div>
        <div className="px-5 py-4 opacity-50">
          <ChatInput onSend={() => Promise.resolve()} isLoading disabled />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card flex h-full flex-col rounded-2xl border shadow-sm">
      <div className="border-b px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-xs uppercase">Active session</p>
            <h2 className="text-lg font-semibold">{sessionTitle}</h2>
          </div>
          <Badge variant={isThinking ? "default" : "secondary"}>
            {isThinking ? "Thinking..." : "Ready"}
          </Badge>
        </div>
      </div>
      <ScrollArea
        className="no-scroll-min-width h-90 flex-1 px-5 py-4"
        onWheelCapture={(event) => event.stopPropagation()}
        onTouchMoveCapture={(event) => event.stopPropagation()}
      >
        <div className="flex w-full flex-col gap-3">
          {latestChunk ? (
            <div className="bg-background/80 sticky top-0 z-10 w-full rounded-xl border px-3 py-2 backdrop-blur">
              <p className="text-muted-foreground text-[11px] uppercase">Latest chunk</p>
              <div className="text-sm leading-relaxed whitespace-pre-wrap">{latestChunk}</div>
            </div>
          ) : null}
          {!hydrated ? (
            <div className="text-muted-foreground mt-20 text-center">
              <Sparkles className="mx-auto mb-3 h-6 w-6 animate-pulse" />
              <p className="mb-3">Loading your workspace…</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="mx-auto mt-16 w-full max-w-2xl text-center">
              <Sparkles className="mx-auto mb-3 h-6 w-6" />
              <p className="text-muted-foreground mb-2 text-sm">
                Ask Rekdin to use tools (web, browser automation, files, code, PDFs) to help you.
              </p>
              <p className="text-muted-foreground mb-6 text-xs">
                Tip: be specific about the output format (JSON/table/bullets) and constraints.
              </p>
              <p className="text-muted-foreground mb-6 text-xs">
                Workspace memory: add a `REKDIN.md` file in the workspace root to provide persistent
                project instructions.
              </p>

              {missingApiKeyMessage ? (
                <div className="bg-muted/40 border-border mb-4 rounded-xl border px-4 py-3 text-left text-sm">
                  <div className="flex items-start gap-2">
                    <span className="bg-primary/10 text-primary mt-0.5 rounded-full p-1">
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

              <div className="bg-muted/30 border-border rounded-xl border p-4 text-left">
                <div className="mb-4">
                  <p className="text-foreground text-sm font-semibold">Workflow presets</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {WORKFLOW_PRESETS.map((workflow) => (
                      <div key={workflow.id} className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
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
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowAllTools((prev) => !prev)}
                  >
                    {showAllTools ? "Show fewer" : "Show all"}
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {toolPreview.map(([key, label]) => (
                    <Badge key={key} variant="secondary" title={key} className="max-w-full">
                      <span className="truncate">{label}</span>
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 text-left md:grid-cols-3">
                {examplePrompts.map((item, index) => (
                  <div key={item.title} className="bg-muted/30 border-border rounded-xl border p-4">
                    <p className="text-foreground mb-2 text-sm font-semibold">{item.title}</p>
                    <pre className="text-muted-foreground mb-3 text-xs wrap-break-word whitespace-pre-wrap">
                      {item.prompt}
                    </pre>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
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
      <div className="border-t px-5 pt-3">
        <div className="flex flex-wrap gap-2">
          {WORKFLOW_PRESETS.map((workflow) => (
            <div key={workflow.id} className="flex items-center gap-2">
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
      <div className="px-5 py-4">
        <ChatInput onSend={sendMessage} isLoading={isLoading || isThinking} disabled={false} />
      </div>
    </div>
  )
}
