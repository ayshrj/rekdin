"use client"

import { AlertCircle, Bot } from "lucide-react"

import { useChat } from "@/contexts/chat-context"
import { ThemeToggle } from "@/components/theme-toggle"
import { SessionSidebar } from "@/components/session-sidebar"
import { ChatPanel } from "@/components/chat/chat-panel"
import { WorkspacePanel } from "@/components/workspace-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export default function HomePage() {
  const { connected, createSession } = useChat()

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="flex items-center justify-between border-b bg-background/80 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Terminator</p>
            <h1 className="text-2xl font-semibold leading-tight">Research & Automation</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={connected ? "default" : "destructive"} className="gap-1 text-xs">
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
            {connected ? "OpenRouter connected" : "Disconnected"}
          </Badge>
          <Button onClick={() => void createSession()} size="sm" className="rounded-full">
            Start new session
          </Button>
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1 p-4">
        <div className="flex h-[calc(100vh-152px)] flex-col gap-4 lg:flex-row">
          <section className="overflow-hidden lg:h-full lg:w-[280px] xl:w-[320px]">
            <SessionSidebar />
          </section>
          <section className="min-h-[360px] flex-1 overflow-hidden lg:h-full">
            <ChatPanel />
          </section>
          <section className="min-h-[320px] overflow-hidden lg:h-full lg:w-[420px] xl:w-[480px]">
            <WorkspacePanel />
          </section>
        </div>
      </main>
      <footer className="border-t bg-background/80 px-6 py-3 text-xs text-muted-foreground">
        <p className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Uses LangChain + OpenRouter tools.{" "}
          <button
            type="button"
            onClick={() => {
              void createSession()
            }}
            className="underline cursor-pointer"
          >
            Start a new session
          </button>
        </p>
      </footer>
    </div>
  )
}
