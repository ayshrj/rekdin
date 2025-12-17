"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { Markdown } from "@/components/markdown"

type ChatAction =
  | { type: "show_toast"; variant: "info" | "success" | "warning" | "error"; message?: string }
  | { type: "update_weather_widget"; city: string; weather: string }

type ChatResponse =
  | {
      reply: string
      action: ChatAction | null
      decision: { type: "calculation" | "weather" | "general"; params?: Record<string, unknown> }
    }
  | { error: string }

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  meta?: { decisionType?: "calculation" | "weather" | "general" }
}

export default function Home() {
  const [input, setInput] = React.useState("")
  const [isSending, setIsSending] = React.useState(false)
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "Ask me for a calculation, weather in a city, or anything general.",
    },
  ])
  const [weatherWidget, setWeatherWidget] = React.useState<{
    city: string
    weather: string
  } | null>(null)

  const scrollRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: "end" })
  }, [messages.length])

  async function send() {
    const message = input.trim()
    if (!message || isSending) return

    setInput("")
    setIsSending(true)
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: message }])

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      })
      const data = (await res.json()) as ChatResponse
      if (!res.ok || "error" in data) {
        const error = "error" in data ? data.error : `Request failed (${res.status})`
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: error },
        ])
        toast.error(error)
        return
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.reply,
          meta: { decisionType: data.decision.type },
        },
      ])

      if (data.action?.type === "show_toast") {
        const msg = data.action.message ?? data.reply
        const variant = data.action.variant
        if (variant === "success") toast.success(msg)
        else if (variant === "warning") toast.warning(msg)
        else if (variant === "error") toast.error(msg)
        else toast.info(msg)
      }

      if (data.action?.type === "update_weather_widget") {
        setWeatherWidget({ city: data.action.city, weather: data.action.weather })
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : "Unknown error"
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: error },
      ])
      toast.error(error)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center gap-4 p-4 font-sans md:p-8">
      <div className="w-full max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>OpenRouter + LangChain (Tools Router)</CardTitle>
            <CardDescription>
              Calls <span className="font-mono">/api/chat</span> which routes to calculator /
              weather tools, otherwise falls back to a normal chat response.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {weatherWidget ? (
              <div className="rounded-lg border px-3 py-2 text-sm">
                <div className="text-muted-foreground">Weather widget</div>
                <div className="font-medium">{weatherWidget.city}</div>
                <div>{weatherWidget.weather}</div>
              </div>
            ) : null}

            <ScrollArea className="h-[52vh] rounded-lg border">
              <div className="flex flex-col gap-3 p-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "max-w-[90%] rounded-lg border px-3 py-2 text-sm",
                      m.role === "user" ? "ml-auto bg-muted" : "mr-auto bg-background"
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="uppercase tracking-wide">{m.role}</span>
                      {m.meta?.decisionType ? (
                        <span className="font-mono">route:{m.meta.decisionType}</span>
                      ) : null}
                    </div>
                    {m.role === "assistant" ? (
                      <Markdown>{m.content}</Markdown>
                    ) : (
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
                    )}
                  </div>
                ))}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>

            <div className="flex flex-col gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder='Try: "What is (50 * 3) + 10?" or "How is the weather in London?"'
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    void send()
                  }
                }}
                disabled={isSending}
              />
              <div className="flex items-center justify-end gap-2">
                <Button onClick={() => void send()} disabled={isSending || !input.trim()}>
                  {isSending ? (
                    <>
                      <Spinner className="mr-2" />
                      Sending
                    </>
                  ) : (
                    "Send"
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
