"use client"

import { formatDistanceToNow } from "date-fns"
import * as React from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useChat } from "@/contexts/chat-context"
import { Loader, Plus, Search, Trash } from "@/lib/icons"
import { cn } from "@/lib/utils"

export function SessionSidebar({
  className,
  onSessionOpen,
}: {
  className?: string
  onSessionOpen?: () => void
}) {
  const { sessions, currentSessionId, createSession, joinSession, deleteSession, isLoading } =
    useChat()
  const [query, setQuery] = React.useState("")
  const [hydrated, setHydrated] = React.useState(false)
  const [sessionToDelete, setSessionToDelete] = React.useState<string | null>(null)

  React.useEffect(() => {
    setHydrated(true)
  }, [])

  const normalizedQuery = query.toLowerCase()
  const filtered = sessions.filter((session) => {
    if (session.title.toLowerCase().includes(normalizedQuery)) return true
    return session.messages?.some((message) =>
      message.content.toLowerCase().includes(normalizedQuery)
    )
  })

  const handleDelete = React.useCallback(
    async (sessionId: string) => {
      await deleteSession(sessionId)
      setSessionToDelete(null)
    },
    [deleteSession]
  )

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Search bar */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative flex items-center">
          <Search className="text-sidebar-foreground/40 pointer-events-none absolute left-2.5 h-3.5 w-3.5" />
          <Input
            placeholder="Search sessions…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="border-sidebar-border bg-sidebar-accent/60 text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus-visible:ring-sidebar-ring h-8 w-full rounded-md pl-8 text-xs"
          />
        </div>
      </div>

      {/* Sessions list */}
      <ScrollArea className="no-scroll-min-width min-h-0 flex-1 overflow-auto">
        <div className="space-y-0.5 px-2 py-1">
          {!hydrated ? (
            <div className="text-sidebar-foreground/40 px-2 py-6 text-center text-xs">
              Loading sessions…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-sidebar-foreground/40 px-2 py-6 text-center text-xs">
              No sessions yet.
            </div>
          ) : (
            filtered.map((session) => (
              <div key={session.id} className="relative">
                {session.id === currentSessionId && (
                  <span className="bg-sidebar-primary absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full" />
                )}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={async () => {
                    await joinSession(session.id)
                    onSessionOpen?.()
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      void (async () => {
                        await joinSession(session.id)
                        onSessionOpen?.()
                      })()
                    }
                  }}
                  className={cn(
                    "group flex w-full cursor-pointer items-center justify-between rounded-md py-2.5 pr-1.5 pl-3 text-left transition-colors",
                    session.id === currentSessionId
                      ? "bg-sidebar-primary/15 text-sidebar-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm leading-snug font-medium">{session.title}</p>
                    <p className="text-sidebar-foreground/45 mt-0.5 text-xs">
                      {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-sidebar-foreground/30 hover:text-destructive h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                    onClick={(event) => {
                      event.stopPropagation()
                      setSessionToDelete(session.id)
                    }}
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Bottom: New session button */}
      <div className="border-sidebar-border shrink-0 border-t px-3 py-3">
        <Button
          onClick={async () => {
            await createSession()
            onSessionOpen?.()
          }}
          disabled={isLoading}
          variant="ghost"
          className="bg-sidebar-accent/60 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground h-9 w-full justify-start gap-2 rounded-lg text-sm"
        >
          {isLoading ? <Loader className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          New session
        </Button>
      </div>

      <AlertDialog
        open={sessionToDelete !== null}
        onOpenChange={(open) => !open && setSessionToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this conversation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => sessionToDelete && void handleDelete(sessionToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
