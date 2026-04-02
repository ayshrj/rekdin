"use client"

import * as React from "react"

import { ChatPanel } from "@/components/chat/chat-panel"
import { OpenRouterSettings } from "@/components/openrouter-settings"
import { SessionSidebar } from "@/components/session-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { Badge } from "@/components/ui/badge"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { WorkspacePanel } from "@/components/workspace-panel"
import { useChat } from "@/contexts/chat-context"
import { ExclamationCircle, Rekdin } from "@/lib/icons"

const MAIN_LAYOUT = {
  chat: 40,
  workspace: 60,
}

export default function HomePage() {
  const { connected, llmProvider } = useChat()
  const [historyOpen, setHistoryOpen] = React.useState(false)
  const providerLabel =
    llmProvider === "openai"
      ? "OpenAI"
      : llmProvider === "azure_openai"
        ? "Azure OpenAI"
        : "OpenRouter"

  return (
    <SidebarProvider
      open={historyOpen}
      onOpenChange={setHistoryOpen}
      defaultOpen={false}
      style={
        {
          "--sidebar-width": "24rem",
          "--sidebar-width-mobile": "min(24rem, calc(100vw - 1rem))",
        } as React.CSSProperties
      }
      className="bg-muted/30 [&_[data-slot=sidebar-gap]]:hidden"
    >
      <Sidebar side="left" variant="floating" collapsible="offcanvas" className="z-50 p-2">
        <SidebarHeader className="border-b px-4 py-4">
          <div className="text-left">
            <p className="text-muted-foreground text-xs uppercase">Chat history</p>
            <p className="text-base font-semibold">Switch sessions</p>
          </div>
        </SidebarHeader>
        <SidebarContent className="p-4">
          <SessionSidebar
            className="h-full rounded-[1.5rem] shadow-none"
            onSessionOpen={() => setHistoryOpen(false)}
          />
        </SidebarContent>
      </Sidebar>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="bg-background/80 supports-backdrop-filter:bg-background/60 flex items-center justify-between border-b px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <SidebarTrigger
              className="bg-background hover:bg-muted h-11 w-11 rounded-2xl border shadow-sm"
              aria-label="Open chat history"
            />
            <div className="bg-primary/10 text-primary rounded-xl p-2">
              <Rekdin className="h-6 w-6" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase">Rekdin</p>
              <h1 className="text-2xl leading-tight font-semibold">Research & Automation</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={connected ? "default" : "destructive"} className="gap-1 text-xs">
              <span
                className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
              />
              {connected ? `${providerLabel} connected` : "Disconnected"}
            </Badge>
            <OpenRouterSettings />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-hidden p-4">
          <div className="flex h-[calc(100vh-152px)] min-h-0 min-w-0 flex-col gap-4 lg:flex-row">
            <ResizablePanelGroup
              id="main-workspace"
              orientation="horizontal"
              defaultLayout={MAIN_LAYOUT}
              className="min-h-0 min-w-0 flex-1"
            >
              <ResizablePanel id="chat" minSize={24} className="min-h-0 min-w-0">
                <div className="h-full min-h-0 overflow-hidden">
                  <ChatPanel />
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle className="mx-2" />
              <ResizablePanel id="workspace" minSize={28} className="min-h-0 min-w-0">
                <div className="h-full min-h-0 overflow-hidden">
                  <WorkspacePanel />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </main>
        <footer className="bg-background/80 text-muted-foreground border-t px-6 py-3 text-xs">
          <p className="flex items-center gap-2">
            <ExclamationCircle className="h-4 w-4" />
            Uses LangChain + tools. Use the <span className="font-medium">+</span> button in the
            Sessions panel to start a new conversation.
          </p>
        </footer>
      </div>
    </SidebarProvider>
  )
}
