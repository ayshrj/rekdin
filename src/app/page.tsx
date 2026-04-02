"use client"

import * as React from "react"

import { ChatPanel } from "@/components/chat/chat-panel"
import { OpenRouterSettings } from "@/components/openrouter-settings"
import { SessionSidebar } from "@/components/session-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { TourAlertDialog, TourProvider, type TourStep, useTour } from "@/components/tour"
import { Button } from "@/components/ui/button"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { WorkspacePanel } from "@/components/workspace-panel"
import { useChat } from "@/contexts/chat-context"
import { Clock, GalleryVerticalEnd, GitHub, PanelLeft, Rekdin, Sparkles } from "@/lib/icons"
import { cn } from "@/lib/utils"

const MAIN_LAYOUT = { chat: 38, workspace: 62 }
const TOUR_SEEN_KEY = "rekdin-tour-seen"
const PHONE_MEDIA_QUERY = "(max-width: 639px)"

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

function useIsPhone() {
  const [isPhone, setIsPhone] = React.useState<boolean | null>(null)

  React.useLayoutEffect(() => {
    const mediaQuery = window.matchMedia(PHONE_MEDIA_QUERY)
    const update = () => setIsPhone(mediaQuery.matches)
    update()
    mediaQuery.addEventListener("change", update)
    return () => mediaQuery.removeEventListener("change", update)
  }, [])

  return isPhone
}

function MobileNavButton({
  active,
  icon,
  label,
  onClick,
}: {
  active?: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-2 py-2 text-[11px] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground"
      )}
    >
      <span
        className={cn(
          "absolute inset-x-4 top-0 h-0.5 rounded-full transition-opacity",
          active ? "bg-primary opacity-100" : "opacity-0"
        )}
      />
      <span className="flex h-5 items-center justify-center">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  )
}

function HomePageContent() {
  const { connected, llmProvider, isThinking, sessions, currentSessionId } = useChat()
  const isPhone = useIsPhone()
  const viewportReady = isPhone !== null
  const isPhoneLayout = isPhone === true
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [tourOpen, setTourOpen] = React.useState(false)
  const [mobilePanel, setMobilePanel] = React.useState<"chat" | "workspace">("chat")

  React.useEffect(() => {
    if (viewportReady && !isPhoneLayout && !localStorage.getItem(TOUR_SEEN_KEY)) {
      setTourOpen(true)
    }
  }, [isPhoneLayout, viewportReady])

  React.useEffect(() => {
    if (isPhoneLayout) setTourOpen(false)
  }, [isPhoneLayout])

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
    <div className="bg-background flex h-dvh w-dvh flex-col overflow-hidden">
      <header className="bg-background/95 flex h-12 shrink-0 items-center justify-between border-b px-3 backdrop-blur sm:h-14 sm:px-4">
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
          {isThinking && (
            <span className="hidden sm:inline-flex">
              <ThinkingBadge />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex">
            <ConnectionBadge connected={connected} label={`${providerLabel} connected`} />
          </span>
          <div className="sm:hidden">
            <OpenRouterSettings
              triggerClassName="h-8 w-8 rounded-lg border"
              onRestartTour={undefined}
            />
          </div>
          <div id="tour-settings" className="hidden sm:block">
            <OpenRouterSettings onRestartTour={restartTour} />
          </div>
          <a
            href="https://github.com/ayshrj"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub profile"
            className="hidden sm:block"
          >
            <Button variant="outline" size="icon" className="rounded-full">
              <GitHub className="h-4 w-4" />
            </Button>
          </a>
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {!viewportReady ? (
        <main className="min-h-0 flex-1 px-3 pt-3">
          <div className="bg-card h-full animate-pulse rounded-xl border shadow-(--shadow-panel)" />
        </main>
      ) : !isPhoneLayout ? (
        <main className="min-h-0 flex-1 overflow-hidden p-3">
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
      ) : (
        <>
          <main className="min-h-0 flex-1 overflow-hidden px-3 pt-3">
            {mobilePanel === "chat" ? (
              <div className="h-full">
                <ChatPanel />
              </div>
            ) : (
              <div className="h-full">
                <WorkspacePanel />
              </div>
            )}
          </main>

          <nav
            className="bg-background/95 border-border shrink-0 border-t"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.25rem)" }}
          >
            <div className="flex h-14 items-stretch">
              <MobileNavButton
                active={mobilePanel === "chat"}
                icon={<Sparkles className="h-4 w-4" />}
                label="Chat"
                onClick={() => setMobilePanel("chat")}
              />
              <MobileNavButton
                active={mobilePanel === "workspace"}
                icon={<GalleryVerticalEnd className="h-4 w-4" />}
                label="Work"
                onClick={() => setMobilePanel("workspace")}
              />
              <MobileNavButton
                icon={<Clock className="h-4 w-4" />}
                label="History"
                onClick={() => setSidebarOpen(true)}
              />
              <OpenRouterSettings
                triggerVariant="ghost"
                triggerSize="default"
                triggerClassName="relative h-full min-w-0 flex-1 flex-col gap-1 rounded-none px-2 py-2 text-[11px] font-medium text-muted-foreground"
                triggerAriaLabel="Open settings"
                triggerChildren={<span className="truncate">Settings</span>}
                onRestartTour={undefined}
              />
            </div>
          </nav>
        </>
      )}

      {viewportReady && !isPhoneLayout && sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {viewportReady && !isPhoneLayout ? (
        <aside
          className={cn(
            "bg-sidebar fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-hidden transition-transform duration-300 ease-in-out lg:w-72",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="border-sidebar-border flex h-14 shrink-0 items-center gap-2.5 border-b px-4">
            <div className="bg-primary/15 flex h-7 w-7 items-center justify-center rounded-lg">
              <Rekdin className="text-primary h-4 w-4" />
            </div>
            <span className="text-sidebar-foreground text-sm font-semibold tracking-tight">
              REKDIN
            </span>
            <span className="text-sidebar-foreground/40 ml-auto text-xs">Sessions</span>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            <SessionSidebar onSessionOpen={() => setSidebarOpen(false)} />
          </div>
        </aside>
      ) : null}

      <Sheet open={isPhoneLayout && sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[75vh] rounded-t-3xl border-t p-0 [&>button]:top-3 [&>button]:right-3"
        >
          <SheetHeader className="border-b px-4 py-3 text-left">
            <SheetTitle className="flex items-center gap-2 text-sm tracking-tight">
              <span className="bg-primary/10 text-primary flex h-7 w-7 items-center justify-center rounded-lg">
                <Rekdin className="h-4 w-4" />
              </span>
              REKDIN
            </SheetTitle>
            <SheetDescription>Open previous sessions or start a new conversation.</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-hidden">
            <SessionSidebar
              className="h-full rounded-none border-0 shadow-none"
              onSessionOpen={() => setSidebarOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

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
