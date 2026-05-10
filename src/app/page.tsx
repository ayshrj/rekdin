"use client"

import * as React from "react"

import { ChatPanel } from "@/components/chat/chat-panel"
import { OpenRouterSettings } from "@/components/openrouter-settings"
import { SessionSidebar } from "@/components/session-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { TourAlertDialog, TourProvider, type TourStep, useTour } from "@/components/tour"
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
import { Clock, GalleryVerticalEnd, GitHub, Rekdin, Sparkles } from "@/lib/icons"
import { getProviderLabel } from "@/lib/llm-providers"
import { cn } from "@/lib/utils"

const TOUR_SEEN_KEY = "rekdin-tour-seen"
const PHONE_MEDIA_QUERY = "(max-width: 639px)"
const MAIN_LAYOUT = { chat: 58, workspace: 42 }

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
        "bg-surface-3 inline-flex max-w-full items-center gap-2 rounded-full px-2.5 py-1 text-xs transition-colors",
        connected ? "text-muted-foreground" : "text-muted-foreground"
      )}
    >
      <span className="relative flex size-2 shrink-0">
        <span
          className={cn(
            "relative inline-flex size-2 rounded-full",
            connected ? "bg-status-success" : "bg-muted-foreground"
          )}
        />
      </span>
      <span className="truncate">{connected ? label : "No provider"}</span>
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
        "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-2 py-1.5 text-[10px] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <span className="flex h-5 items-center justify-center">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  )
}

function DesktopRail({
  connected,
  providerLabel,
  sessionsOpen,
  onToggleSessions,
  onRestartTour,
}: {
  connected: boolean
  providerLabel: string
  sessionsOpen: boolean
  onToggleSessions: () => void
  onRestartTour: () => void
}) {
  return (
    <aside
      className="bg-surface-1 border-border hidden h-dvh shrink-0 overflow-hidden border-r transition-[width] duration-200 ease-out sm:flex"
      style={{ width: sessionsOpen ? 300 : 56 }}
    >
      <div className="border-border bg-surface-1 flex w-14 shrink-0 flex-col border-r">
        <div className="flex h-14 items-center justify-center">
          <div className="bg-surface-3 flex size-8 items-center justify-center rounded-lg">
            <Rekdin className="text-primary h-4 w-4" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 px-2 pt-2">
          <button
            id="tour-sidebar-btn"
            type="button"
            onClick={onToggleSessions}
            aria-label={sessionsOpen ? "Collapse session history" : "Open session history"}
            className={cn("rk-icon-button", sessionsOpen && "bg-primary/15 text-primary")}
          >
            <Clock className="h-4 w-4" />
          </button>
          <div id="tour-settings">
            <OpenRouterSettings
              triggerVariant="ghost"
              triggerSize="icon"
              triggerClassName="rk-icon-button"
              onRestartTour={onRestartTour}
            />
          </div>
          <ThemeToggle />
          <a
            href="https://github.com/ayshrj"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub profile"
            className="rk-icon-button"
          >
            <GitHub className="h-4 w-4" />
          </a>
        </div>
      </div>

      {sessionsOpen ? (
        <div className="bg-surface-2 flex min-w-0 flex-1 flex-col">
          <div className="bg-surface-3 border-border flex h-14 shrink-0 items-center border-b px-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Sessions</p>
              <div className="mt-1">
                <ConnectionBadge connected={connected} label={providerLabel} />
              </div>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <SessionSidebar />
          </div>
        </div>
      ) : null}
    </aside>
  )
}

function HomePageContent() {
  const { connected, llmProvider } = useChat()
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
  const openWorkspaceSelector = React.useCallback(() => {
    if (isPhoneLayout) {
      setMobilePanel("chat")
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("rekdin:open-workspace"))
      }, 0)
      return
    }

    window.dispatchEvent(new CustomEvent("rekdin:open-workspace"))
  }, [isPhoneLayout])

  return (
    <div className="bg-background text-foreground flex h-dvh w-dvw overflow-hidden">
      {!viewportReady ? (
        <main className="min-h-0 flex-1">
          <div className="bg-surface-2 h-full animate-pulse" />
        </main>
      ) : !isPhoneLayout ? (
        <>
          <DesktopRail
            connected={connected}
            providerLabel={providerLabel}
            sessionsOpen={sidebarOpen}
            onToggleSessions={() => setSidebarOpen((open) => !open)}
            onRestartTour={restartTour}
          />
          <main className="min-w-0 flex-1 overflow-hidden">
            <ResizablePanelGroup
              id="main-workspace"
              orientation="horizontal"
              defaultLayout={MAIN_LAYOUT}
              className="h-full"
            >
              <ResizablePanel id="chat" minSize={34} className="min-h-0 min-w-[340px]">
                <section id="tour-chat-panel" className="h-full min-h-0 min-w-0">
                  <ChatPanel />
                </section>
              </ResizablePanel>
              <ResizableHandle
                withHandle
                className="bg-border data-[resize-handle-state=hover]:bg-primary/70 w-px"
              />
              <ResizablePanel id="workspace" minSize={28} className="min-h-0 min-w-[360px]">
                <section id="tour-workspace-panel" className="h-full min-h-0 min-w-0">
                  <WorkspacePanel onChangeWorkspace={openWorkspaceSelector} />
                </section>
              </ResizablePanel>
            </ResizablePanelGroup>
          </main>
        </>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <main className="min-h-0 flex-1 overflow-hidden">
            {mobilePanel === "chat" ? (
              <div className="h-full">
                <ChatPanel />
              </div>
            ) : (
              <div className="h-full">
                <WorkspacePanel onChangeWorkspace={openWorkspaceSelector} />
              </div>
            )}
          </main>

          <nav
            className="bg-surface-1 border-border shrink-0 border-t"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex h-[52px] items-stretch">
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
                triggerClassName="relative h-full min-w-0 flex-1 flex-col gap-0.5 rounded-none px-2 py-1.5 text-[10px] font-medium text-muted-foreground hover:bg-transparent data-[variant=ghost]:hover:bg-transparent"
                triggerAriaLabel="Open settings"
                triggerChildren={<span className="truncate">Settings</span>}
                onRestartTour={undefined}
              />
            </div>
          </nav>
        </div>
      )}

      <Sheet open={isPhoneLayout && sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="bottom"
          className="bg-surface-2 max-h-[70vh] rounded-t-xl border-t p-0 [&>button]:top-3 [&>button]:right-3"
        >
          <div className="bg-surface-5 mx-auto mt-2 h-1 w-8 rounded-full" />
          <SheetHeader className="bg-surface-3 border-b px-4 py-3 text-left">
            <SheetTitle className="text-sm tracking-tight">Sessions</SheetTitle>
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
