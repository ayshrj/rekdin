"use client"

import * as React from "react"
import { Sparkles } from "lucide-react"

import { useChat } from "@/contexts/chat-context"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChatMessage } from "./chat-message"
import { ChatInput } from "./chat-input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function ChatPanel() {
  const { messages, isLoading, isThinking, sendMessage, currentSessionId, sessions, createSession } =
    useChat()
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  React.useEffect(() => {
    setHydrated(true)
  }, [])

  const currentSession = sessions.find((session) => session.id === currentSessionId)

  if (!hydrated) {
    return (
      <div className="flex h-full flex-col rounded-2xl border bg-card shadow-sm">
        <div className="border-b px-5 py-4">
          <div className="h-5 w-32 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          Loading chat…
        </div>
        <div className="px-5 py-4 opacity-50">
          <ChatInput onSend={() => Promise.resolve()} isLoading disabled />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border bg-card shadow-sm">
      <div className="border-b px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Active session</p>
            <h2 className="text-lg font-semibold">{currentSession?.title ?? "No session"}</h2>
          </div>
          <Badge variant={isThinking ? "default" : "secondary"}>
            {isThinking ? "Thinking..." : "Ready"}
          </Badge>
        </div>
      </div>
      <ScrollArea className="flex-1 px-5 py-4">
        <div className="flex flex-col gap-3">
          {!hydrated ? (
            <div className="mt-20 text-center text-muted-foreground">
              <Sparkles className="mx-auto mb-3 h-6 w-6 animate-pulse" />
              <p className="mb-3">Loading your workspace…</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="mt-20 text-center text-muted-foreground">
              <Sparkles className="mx-auto mb-3 h-6 w-6" />
              <p className="mb-3">Ask Terminator to research, summarize websites, or execute commands.</p>
              {!currentSessionId ? (
                <button
                  onClick={() => void createSession()}
                  className="rounded-full border bg-primary px-4 py-2 text-sm text-primary-foreground shadow-sm"
                >
                  Start a session
                </button>
              ) : null}
            </div>
          ) : (
            messages.map((message) => <ChatMessage key={message.id} message={message} />)
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>
      <div className={cn("px-5 py-4", !currentSessionId && "opacity-50")}>
        <ChatInput onSend={sendMessage} isLoading={isLoading || isThinking} disabled={!currentSessionId} />
      </div>
    </div>
  )
}
