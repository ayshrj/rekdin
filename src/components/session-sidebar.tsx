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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useChat } from "@/contexts/chat-context"
import { Loader, Plus, Trash } from "@/lib/icons"
import { cn } from "@/lib/utils"

export function SessionSidebar({
  className,
  onSessionOpen,
}: {
  className?: string
  onSessionOpen?: () => void
}) {
  const {
    sessions,
    currentSessionId,
    createSession,
    joinSession,
    deleteSession,
    connected,
    isLoading,
  } = useChat()
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
    <div className={cn("bg-card flex h-full flex-col rounded-2xl border shadow-sm", className)}>
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-xs uppercase">Sessions</p>
            <p className="text-base font-semibold">Recent conversations</p>
          </div>
          <Button
            onClick={async () => {
              await createSession()
              onSessionOpen?.()
            }}
            size="icon"
            className="rounded-full"
            disabled={isLoading}
          >
            {isLoading ? <Loader className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
        <div className="mt-3">
          <Input
            placeholder="Search..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="bg-muted/50 h-9 rounded-full"
          />
        </div>
      </div>
      <ScrollArea className="flex-1 overflow-auto">
        <div className="space-y-1 px-3 py-3">
          {!hydrated ? (
            <div className="bg-muted/40 text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
              Loading sessions…
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-muted/40 text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
              No sessions yet. Start chatting!
            </div>
          ) : (
            filtered.map((session) => (
              <div
                key={session.id}
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
                  "group flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition",
                  session.id === currentSessionId
                    ? "border-primary/40 bg-primary/5"
                    : "hover:border-border hover:bg-muted/60 border-transparent"
                )}
              >
                <div>
                  <p className="text-sm font-medium">{session.title}</p>
                  <p className="text-muted-foreground text-xs">
                    Updated{" "}
                    {formatDistanceToNow(new Date(session.updatedAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive h-8 w-8"
                  onClick={(event) => {
                    event.stopPropagation()
                    setSessionToDelete(session.id)
                  }}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
      <div className="border-t px-4 py-3">
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span>Status</span>
          <Badge variant={connected ? "default" : "secondary"}>
            {connected ? "Connected" : "Offline"}
          </Badge>
        </div>
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
