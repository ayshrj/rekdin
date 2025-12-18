"use client"

import * as React from "react"
import { formatDistanceToNow } from "date-fns"
import { Loader2, Plus, Trash2 } from "lucide-react"

import { useChat } from "@/contexts/chat-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export function SessionSidebar() {
  const { sessions, currentSessionId, createSession, joinSession, deleteSession, connected, isLoading } =
    useChat()
  const [query, setQuery] = React.useState("")
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    setHydrated(true)
  }, [])

  const filtered = sessions.filter((session) =>
    session.title.toLowerCase().includes(query.toLowerCase())
  )

  const handleDelete = React.useCallback(
    async (sessionId: string) => {
      if (!window.confirm("Delete this conversation?")) return
      await deleteSession(sessionId)
    },
    [deleteSession]
  )

  return (
    <div className="flex h-full flex-col rounded-2xl border bg-card shadow-sm">
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Sessions</p>
            <p className="text-base font-semibold">Recent conversations</p>
          </div>
          <Button onClick={() => void createSession()} size="icon" className="rounded-full" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
        <div className="mt-3">
          <Input
            placeholder="Search..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-9 rounded-full bg-muted/50"
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-1 px-3 py-3">
          {!hydrated ? (
            <div className="rounded-lg border border-dashed bg-muted/40 p-6 text-center text-sm text-muted-foreground">
              Loading sessions…
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/40 p-6 text-center text-sm text-muted-foreground">
              No sessions yet. Start chatting!
            </div>
          ) : (
            filtered.map((session) => (
              <div
                key={session.id}
                role="button"
                tabIndex={0}
                onClick={() => void joinSession(session.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    void joinSession(session.id)
                  }
                }}
                className={cn(
                  "group flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition",
                  session.id === currentSessionId
                    ? "border-primary/40 bg-primary/5"
                    : "border-transparent hover:border-border hover:bg-muted/60"
                )}
              >
                <div>
                  <p className="text-sm font-medium">{session.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Updated{" "}
                    {formatDistanceToNow(new Date(session.updatedAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={(event) => {
                    event.stopPropagation()
                    void handleDelete(session.id)
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
      <div className="border-t px-4 py-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Status</span>
          <Badge variant={connected ? "default" : "secondary"}>
            {connected ? "Connected" : "Offline"}
          </Badge>
        </div>
      </div>
    </div>
  )
}
