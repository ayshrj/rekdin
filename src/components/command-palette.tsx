"use client"

import * as React from "react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { useChat } from "@/contexts/chat-context"
import { SLASH_COMMANDS } from "@/lib/commands"
import {
  Bolt,
  BookOpen,
  Clock,
  CodeBracket,
  CommandLine,
  FileText,
  FolderTree,
  Globe,
  Plus,
} from "@/lib/icons"
import { getAllWorkflowPresets } from "@/lib/workflows"
import type { WorkflowPreset } from "@/types/runtime"

function categoryIcon(category: WorkflowPreset["category"]) {
  switch (category) {
    case "research":
      return <BookOpen className="h-3.5 w-3.5 shrink-0" />
    case "browser":
      return <Globe className="h-3.5 w-3.5 shrink-0" />
    case "workspace":
      return <FolderTree className="h-3.5 w-3.5 shrink-0" />
    case "document":
      return <FileText className="h-3.5 w-3.5 shrink-0" />
    case "code":
      return <CodeBracket className="h-3.5 w-3.5 shrink-0" />
    default:
      return <Bolt className="h-3.5 w-3.5 shrink-0" />
  }
}

export function CommandPalette() {
  const [open, setOpen] = React.useState(false)
  const { sessions, currentSessionId, joinSession, createSession, customWorkflows } = useChat()

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    const onOpenEvent = () => setOpen(true)
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("rekdin:open-palette", onOpenEvent)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("rekdin:open-palette", onOpenEvent)
    }
  }, [])

  const run = React.useCallback((fn: () => void) => {
    fn()
    setOpen(false)
  }, [])

  const workflowPresets = getAllWorkflowPresets(customWorkflows)
  const recentSessions = sessions.slice(0, 6)

  return (
    <CommandDialog open={open} onOpenChange={setOpen} showCloseButton={false}>
      <CommandInput placeholder="Search sessions, commands, workflows…" />
      <CommandList className="max-h-[420px]">
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Sessions">
          <CommandItem value="new session create" onSelect={() => run(() => void createSession())}>
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span>New session</span>
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          {recentSessions.map((session) => (
            <CommandItem
              key={session.id}
              value={`session ${session.id} ${session.title}`}
              onSelect={() => {
                if (session.id !== currentSessionId) {
                  run(() => void joinSession(session.id))
                } else {
                  setOpen(false)
                }
              }}
            >
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{session.title || "Untitled"}</span>
              {session.id === currentSessionId && <CommandShortcut>current</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Commands">
          {SLASH_COMMANDS.map((cmd) => (
            <CommandItem
              key={cmd.id}
              value={`command ${cmd.id} ${cmd.label} ${cmd.description}`}
              onSelect={() =>
                run(() => {
                  switch (cmd.id) {
                    case "workspace":
                      window.dispatchEvent(new CustomEvent("rekdin:open-workspace"))
                      break
                    case "settings":
                    case "model":
                      window.dispatchEvent(
                        new CustomEvent("rekdin:open-settings", { detail: { tab: "model" } })
                      )
                      break
                    case "clear":
                      void createSession()
                      break
                    case "compact":
                      window.dispatchEvent(
                        new CustomEvent("rekdin:ui-action", {
                          detail: { action: "compact" },
                        })
                      )
                      break
                    default:
                      window.dispatchEvent(
                        new CustomEvent("rekdin:ui-action", {
                          detail: { action: cmd.id, payload: {} },
                        })
                      )
                  }
                })
              }
            >
              <CommandLine className="h-3.5 w-3.5 shrink-0" />
              <span className="font-mono text-xs">{cmd.usage}</span>
              <span className="text-muted-foreground ml-2 min-w-0 flex-1 truncate text-xs">
                {cmd.description}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Workflows">
          {workflowPresets.map((wf) => (
            <CommandItem
              key={wf.id}
              value={`workflow ${wf.id} ${wf.title} ${wf.description}`}
              onSelect={() =>
                run(() => {
                  window.dispatchEvent(
                    new CustomEvent("rekdin:ui-action", {
                      detail: {
                        action: "run_workflow",
                        payload: { workflowId: wf.id },
                      },
                    })
                  )
                })
              }
            >
              {categoryIcon(wf.category)}
              <span className="font-medium">{wf.title}</span>
              <span className="text-muted-foreground ml-2 min-w-0 flex-1 truncate text-xs">
                {wf.description}
              </span>
              {wf.supportsBackground && <CommandShortcut>BG</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
