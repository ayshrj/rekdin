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
import { getProviderLabel } from "@/lib/llm-providers"
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
          Choose between OpenRouter, OpenAI, Gemini, Claude, Grok, or Azure OpenAI. You can also
          change models and configure agent behavior here.
        </p>
      </div>
    ),
  },
]

function ConnectionBadge({ connected, label }: { connected: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.08em] uppercase transition-colors",
        connected
          ? "border-status-success/30 bg-status-success/10 text-status-success"
          : "border-destructive/25 bg-destructive/10 text-destructive"
      )}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        {connected && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-50" />
        )}
        <span
          className={cn(
            "relative inline-flex h-1.5 w-1.5 rounded-full",
            connected ? "bg-status-success" : "bg-destructive"
          )}
        />
      </span>
      {connected ? label : "Disconnected"}
    </span>
  )
}

function ThinkingBadge() {
  return (
    <span className="border-primary/25 bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] font-semibold tracking-[0.08em] uppercase">
      <span className="bg-primary h-1.5 w-1.5 animate-pulse rounded-full" />
      Agent thinking
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
        "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-2 py-2 font-mono text-[10px] font-semibold tracking-[0.08em] uppercase transition-colors",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <span
        className={cn(
          "absolute inset-x-5 top-0 h-0.5 rounded-full transition-opacity",
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

  const providerLabel = getProviderLabel(llmProvider)

  const currentSession = sessions?.find((s) => s.id === currentSessionId)
  const sessionTitle = currentSession?.title ?? "New conversation"

  return (
    <div className="from-background via-surface-0 to-surface-2 dark:via-surface-0 rk-shell-grid flex h-dvh w-dvw flex-col overflow-hidden bg-radial-[at_50%_0%]">
      <header className="bg-surface-1/90 flex h-14 shrink-0 items-center justify-between border-b px-3 backdrop-blur-xl sm:h-16 sm:px-4">
        <div className="flex items-center gap-3">
          <Button
            id="tour-sidebar-btn"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground border-border/60 bg-surface-2/60 h-9 w-9 rounded-lg border"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open session history"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-primary/10 ring-primary/20 flex h-9 w-9 items-center justify-center rounded-lg ring-1">
              <Rekdin className="text-primary h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-black tracking-[0.2em]">REKDIN</span>
                <span className="bg-border hidden h-3 w-px sm:block" />
                <span
                  className="text-muted-foreground hidden max-w-60 truncate text-xs sm:block"
                  title={sessionTitle}
                >
                  {sessionTitle}
                </span>
              </div>
              <p className="text-muted-foreground hidden font-mono text-[10px] tracking-[0.14em] uppercase sm:block">
                local research and automation workspace
              </p>
            </div>
          </div>
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
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg">
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
          <div className="rk-panel h-full animate-pulse" />
        </main>
      ) : !isPhoneLayout ? (
        <main className="min-h-0 flex-1 overflow-hidden p-3">
          <ResizablePanelGroup
            id="main-workspace"
            orientation="horizontal"
            defaultLayout={MAIN_LAYOUT}
            className="h-full rounded-xl"
          >
            <ResizablePanel id="chat" minSize={24} className="min-h-0 min-w-0">
              <div id="tour-chat-panel" className="h-full">
                <ChatPanel />
              </div>
            </ResizablePanel>
            <ResizableHandle
              withHandle
              className="bg-border/70 data-[resize-handle-state=hover]:bg-primary/50 mx-1 w-px rounded-full"
            />
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
            className="bg-surface-1/95 border-border shrink-0 border-t backdrop-blur-xl"
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
                triggerClassName="relative h-full min-w-0 flex-1 flex-col gap-1 rounded-none px-2 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
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
            "bg-sidebar border-sidebar-border fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-hidden border-r shadow-(--shadow-float) transition-transform duration-300 ease-in-out lg:w-80",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="border-sidebar-border flex h-16 shrink-0 items-center gap-3 border-b px-4">
            <div className="bg-primary/15 ring-primary/20 flex h-9 w-9 items-center justify-center rounded-lg ring-1">
              <Rekdin className="text-primary h-4 w-4" />
            </div>
            <div>
              <p className="text-sidebar-foreground font-mono text-[11px] font-black tracking-[0.18em]">
                REKDIN
              </p>
              <p className="text-sidebar-foreground/45 font-mono text-[10px] tracking-[0.14em] uppercase">
                Session archive
              </p>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            <SessionSidebar onSessionOpen={() => setSidebarOpen(false)} />
          </div>
        </aside>
      ) : null}

      <Sheet open={isPhoneLayout && sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="bottom"
          className="bg-sidebar max-h-[75vh] rounded-t-3xl border-t p-0 [&>button]:top-3 [&>button]:right-3"
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
