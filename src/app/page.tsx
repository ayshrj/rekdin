"use client"

import * as React from "react"

import { ChatPanel } from "@/components/chat/chat-panel"
import { OpenRouterSettings } from "@/components/openrouter-settings"
import { SessionSidebar } from "@/components/session-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { TourAlertDialog, TourProvider, type TourStep, useTour } from "@/components/tour"
import { Button } from "@/components/ui/button"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { WorkspacePanel } from "@/components/workspace-panel"
import { useChat } from "@/contexts/chat-context"
import { GitHub, PanelLeft, Rekdin } from "@/lib/icons"
import { cn } from "@/lib/utils"

const MAIN_LAYOUT = { chat: 38, workspace: 62 }
const TOUR_SEEN_KEY = "rekdin-tour-seen"

const TOUR_STEPS: TourStep[] = [
  {
    selectorId: "tour-sidebar-btn",
    position: "bottom",
    content: (
      <div>
        <p className="text-foreground mb-1 text-sm font-semibold">Session history</p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Open your past conversations here. Create new sessions or jump back into any previous one.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-chat-panel",
    position: "right",
    content: (
      <div>
        <p className="text-foreground mb-1 text-sm font-semibold">Chat</p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Describe a research task or command. Rekdin uses tools like web search, browser
          automation, and file editing to complete your request step by step.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-chat-input",
    position: "top",
    content: (
      <div>
        <p className="text-foreground mb-1 text-sm font-semibold">Message input</p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Press Enter to send or Shift+Enter for a new line. Attach files with the paperclip icon.
          You can also select workflow presets above to run pre-built tasks instantly.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-workspace-panel",
    position: "left",
    content: (
      <div>
        <p className="text-foreground mb-1 text-sm font-semibold">Workspace</p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Every tool call appears in the Timeline as it runs. Download artifacts, inspect results,
          and review the activity log — all updating live.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-settings",
    position: "bottom",
    content: (
      <div>
        <p className="text-foreground mb-1 text-sm font-semibold">Settings</p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Add your API key to connect to OpenRouter, OpenAI, or Azure OpenAI. You can also change
          models and configure agent behavior here.
        </p>
      </div>
    ),
  },
]

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

function HomePageContent() {
  const { connected, llmProvider, isThinking, sessions, currentSessionId } = useChat()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [tourOpen, setTourOpen] = React.useState(false)

  React.useEffect(() => {
    if (!localStorage.getItem(TOUR_SEEN_KEY)) {
      setTourOpen(true)
    }
  }, [])

  const markTourSeen = React.useCallback(() => {
    localStorage.setItem(TOUR_SEEN_KEY, "1")
  }, [])

  const { restartTour } = useTour()

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
            id="tour-sidebar-btn"
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
          <div id="tour-settings">
            <OpenRouterSettings onRestartTour={restartTour} />
          </div>
          <a
            href="https://github.com/ayshrj"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub profile"
          >
            <Button variant="outline" size="icon" className="rounded-full">
              <GitHub className="h-4 w-4" />
            </Button>
          </a>
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
            <div id="tour-chat-panel" className="h-full">
              <ChatPanel />
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle className="bg-border mx-1 w-px" />
          <ResizablePanel id="workspace" minSize={28} className="min-h-0 min-w-0">
            <div id="tour-workspace-panel" className="h-full">
              <WorkspacePanel />
            </div>
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

      <TourAlertDialog
        isOpen={tourOpen}
        setIsOpen={setTourOpen}
        onStart={markTourSeen}
        onSkip={markTourSeen}
      />
    </div>
  )
}

export default function HomePage() {
  return (
    <TourProvider steps={TOUR_STEPS} onComplete={() => {}} onSkip={() => {}}>
      <HomePageContent />
    </TourProvider>
  )
}
