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

function SessionSkeleton() {
  return (
    <div className="space-y-0 px-0 py-1">
      {[75, 55, 68, 48].map((w, i) => (
        <div key={i} className="border-border/50 px-3 py-3">
          <div
            className="bg-surface-4 mb-1.5 h-3 animate-pulse rounded-sm"
            style={{ width: `${w}%` }}
          />
          <div className="bg-surface-4 h-2 w-14 animate-pulse rounded-sm" />
        </div>
      ))}
    </div>
  )
}

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
      <div className="px-3 py-3">
        <div className="relative flex items-center">
          <Search className="text-muted-foreground pointer-events-none absolute left-2.5 h-3.5 w-3.5" />
          <Input
            placeholder="Search sessions…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-9 w-full rounded-md pl-8 text-xs"
          />
        </div>
      </div>

      <ScrollArea className="no-scroll-min-width min-h-0 flex-1 overflow-auto">
        {!hydrated ? (
          <SessionSkeleton />
        ) : filtered.length === 0 ? (
          <div className="flex h-full min-h-60 flex-col items-center justify-center gap-2 px-4 text-center">
            <Plus className="text-muted-foreground/40 h-8 w-8" />
            <p className="text-muted-foreground text-xs">
              {query ? "No sessions match" : "No sessions yet"}
            </p>
          </div>
        ) : (
          <div className="py-1">
            {filtered.map((session) => {
              const firstUserMsg = session.messages?.find((m) => m.role === "user")?.content ?? ""
              const preview =
                typeof firstUserMsg === "string" ? firstUserMsg.replace(/\s+/g, " ").trim() : ""
              const msgCount = session.messages?.length ?? 0

              return (
                <div key={session.id} className="relative">
                  {session.id === currentSessionId && (
                    <span className="bg-primary absolute inset-y-2 left-0 w-0.5 rounded-full" />
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
                      "group flex h-16 w-full cursor-pointer items-start justify-between gap-2 border-y border-transparent py-2 pr-2 text-left transition-colors duration-150 ease-out",
                      session.id === currentSessionId
                        ? "bg-surface-3 text-foreground pl-3"
                        : "text-muted-foreground hover:bg-surface-3 hover:text-foreground pl-3"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-sm leading-snug",
                          session.id === currentSessionId ? "font-semibold" : "font-medium"
                        )}
                      >
                        {session.title}
                      </p>
                      {preview ? (
                        <p className="text-muted-foreground mt-0.5 truncate text-[11px] leading-tight">
                          {preview}
                        </p>
                      ) : null}
                      <div className="text-muted-foreground mt-1.5 flex items-center gap-1.5 font-mono text-[10px]">
                        <span>
                          {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    {msgCount > 0 ? (
                      <span className="bg-surface-4 text-muted-foreground mt-7 shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[10px]">
                        {msgCount}
                      </span>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 absolute top-2 right-1 h-5 w-5 shrink-0 rounded-md opacity-0 group-hover:opacity-100"
                      onClick={(event) => {
                        event.stopPropagation()
                        setSessionToDelete(session.id)
                      }}
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>

      <div className="border-border shrink-0 border-t px-3 py-3">
        <Button
          onClick={async () => {
            await createSession()
            onSessionOpen?.()
          }}
          disabled={isLoading}
          variant="ghost"
          className="bg-surface-3 text-muted-foreground hover:bg-surface-4 hover:text-foreground h-9 w-full justify-start gap-2 rounded-md text-sm"
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
