"use client"

import * as React from "react"

import { ChatPanel } from "@/components/chat/chat-panel"
import { OpenRouterSettings } from "@/components/openrouter-settings"
import { SessionSidebar } from "@/components/session-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { WorkspacePanel } from "@/components/workspace-panel"
import { useChat } from "@/contexts/chat-context"
import { PanelLeft, Rekdin } from "@/lib/icons"
import { cn } from "@/lib/utils"

const MAIN_LAYOUT = { chat: 38, workspace: 62 }

function ConnectionBadge({ connected, label }: { connected: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        connected
          ? "border-green-500/20 bg-green-500/8 text-green-700 dark:text-green-400"
          : "border-destructive/20 bg-destructive/8 text-destructive"
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", connected ? "bg-green-500" : "bg-destructive")}
      />
      {connected ? label : "Disconnected"}
    </span>
  )
}

function ThinkingBadge() {
  return (
    <span className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium">
      <span className="bg-primary h-1.5 w-1.5 animate-pulse rounded-full" />
      Thinking
    </span>
  )
}

export default function HomePage() {
  const { connected, llmProvider, isThinking, sessions, currentSessionId } = useChat()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)

  const providerLabel =
    llmProvider === "openai"
      ? "OpenAI"
      : llmProvider === "azure_openai"
        ? "Azure OpenAI"
        : "OpenRouter"

  const currentSession = sessions?.find((s) => s.id === currentSessionId)
  const sessionTitle = currentSession?.title ?? "New conversation"

  return (
    <div className="bg-background flex h-screen w-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-background/95 flex h-14 shrink-0 items-center justify-between border-b px-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground h-8 w-8 rounded-lg"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open session history"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 flex h-6 w-6 items-center justify-center rounded-md">
              <Rekdin className="text-primary h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-semibold tracking-tight">REKDIN</span>
          </div>
          <span className="text-muted-foreground hidden text-xs sm:block">·</span>
          <span className="text-muted-foreground hidden text-sm sm:block">{sessionTitle}</span>
          {isThinking && <ThinkingBadge />}
        </div>
        <div className="flex items-center gap-2">
          <ConnectionBadge connected={connected} label={`${providerLabel} connected`} />
          <OpenRouterSettings />
          <ThemeToggle />
        </div>
      </header>

      {/* Main panels — explicit height so react-resizable-panels resolves h-full */}
      <main className="overflow-hidden p-3" style={{ height: "calc(100vh - 3.5rem)" }}>
        <ResizablePanelGroup
          id="main-workspace"
          orientation="horizontal"
          defaultLayout={MAIN_LAYOUT}
          className="h-full"
        >
          <ResizablePanel id="chat" minSize={24} className="min-h-0 min-w-0">
            <ChatPanel />
          </ResizablePanel>
          <ResizableHandle withHandle className="bg-border mx-1 w-px" />
          <ResizablePanel id="workspace" minSize={28} className="min-h-0 min-w-0">
            <WorkspacePanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>

      {/* Overlay sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Overlay sidebar panel */}
      <aside
        className={cn(
          "bg-sidebar fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-hidden transition-transform duration-300 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Sidebar header */}
        <div className="border-sidebar-border flex h-14 shrink-0 items-center gap-2.5 border-b px-4">
          <div className="bg-primary/15 flex h-7 w-7 items-center justify-center rounded-lg">
            <Rekdin className="text-primary h-4 w-4" />
          </div>
          <span className="text-sidebar-foreground text-sm font-semibold tracking-tight">
            REKDIN
          </span>
          <span className="text-sidebar-foreground/40 ml-auto text-xs">Sessions</span>
        </div>

        {/* Sessions list */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <SessionSidebar onSessionOpen={() => setSidebarOpen(false)} />
        </div>
      </aside>
    </div>
  )
}
