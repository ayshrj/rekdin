"use client"

import { ChatPanel } from "@/components/chat/chat-panel"
import { OpenRouterSettings } from "@/components/openrouter-settings"
import { SessionSidebar } from "@/components/session-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { Badge } from "@/components/ui/badge"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { WorkspacePanel } from "@/components/workspace-panel"
import { useChat } from "@/contexts/chat-context"
import { ExclamationCircle, Rekdin } from "@/lib/icons"

const MAIN_LAYOUT = {
  sessions: 22,
  chat: 34,
  workspace: 44,
}

export default function HomePage() {
  const { connected, llmProvider } = useChat()
  const providerLabel =
    llmProvider === "openai"
      ? "OpenAI"
      : llmProvider === "azure_openai"
        ? "Azure OpenAI"
        : "OpenRouter"

  return (
    <div className="bg-muted/30 flex min-h-screen flex-col">
      <header className="bg-background/80 supports-backdrop-filter:bg-background/60 flex items-center justify-between border-b px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
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
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
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
            <ResizablePanel id="sessions" minSize={18} className="min-h-0 min-w-0">
              <div className="h-full min-h-0 overflow-hidden">
                <SessionSidebar />
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle className="mx-2" />
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
  )
}
