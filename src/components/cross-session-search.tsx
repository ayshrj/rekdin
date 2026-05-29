"use client"

import * as React from "react"

import { useChat } from "@/contexts/chat-context"
import { loadSessions } from "@/lib/client/idb"
import { Clock, Search } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { ChatSession } from "@/types/chat"

interface SearchHit {
  sessionId: string
  sessionTitle: string
  sessionDate: string
  messageRole: string
  excerpt: string
  matchIndex: number
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/25 text-foreground rounded-[2px] px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export function CrossSessionSearch() {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [hits, setHits] = React.useState<SearchHit[]>([])
  const [searching, setSearching] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const { joinSession } = useChat()

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "f") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === "Escape" && open) setOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open])

  React.useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else setQuery("")
  }, [open])

  React.useEffect(() => {
    if (!query.trim()) {
      setHits([])
      return
    }
    const q = query.trim().toLowerCase()
    let cancelled = false

    setSearching(true)
    loadSessions()
      .then((sessions: ChatSession[]) => {
        if (cancelled) return
        const results: SearchHit[] = []
        for (const session of sessions) {
          for (const msg of session.messages ?? []) {
            const content = msg.content ?? ""
            const idx = content.toLowerCase().indexOf(q)
            if (idx === -1) continue
            const start = Math.max(0, idx - 40)
            const excerpt =
              (start > 0 ? "…" : "") +
              content.slice(start, idx + q.length + 60).trim() +
              (idx + q.length + 60 < content.length ? "…" : "")
            results.push({
              sessionId: session.id,
              sessionTitle: session.title || "Untitled",
              sessionDate: new Date(session.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              }),
              messageRole: msg.role,
              excerpt,
              matchIndex: idx,
            })
            if (results.length >= 40) break
          }
          if (results.length >= 40) break
        }
        setHits(results)
        setSearching(false)
      })
      .catch(() => setSearching(false))

    return () => {
      cancelled = true
    }
  }, [query])

  if (!open) return null

  return (
    <div
      className="bg-background/80 fixed inset-0 z-50 flex items-start justify-center pt-20 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      <div className="bg-popover border-border w-full max-w-xl overflow-hidden rounded-xl border shadow-2xl">
        {/* Search input */}
        <div className="border-border flex items-center gap-2 border-b px-3 py-2.5">
          <Search className="text-muted-foreground h-4 w-4 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all sessions…"
            className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          <kbd className="border-border text-muted-foreground rounded border px-1.5 py-0.5 font-mono text-[10px]">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="rk-scrollbar max-h-[420px] overflow-y-auto">
          {searching ? (
            <p className="text-muted-foreground py-6 text-center text-xs">Searching…</p>
          ) : query.trim() && hits.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-xs">
              No results for &ldquo;{query}&rdquo;
            </p>
          ) : hits.length > 0 ? (
            <div className="divide-border divide-y">
              {hits.map((hit, i) => (
                <button
                  key={i}
                  type="button"
                  className="hover:bg-surface-3 w-full px-4 py-3 text-left transition-colors"
                  onClick={() => {
                    void joinSession(hit.sessionId)
                    setOpen(false)
                  }}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <Clock className="text-muted-foreground h-3 w-3 shrink-0" />
                    <span className="text-foreground min-w-0 flex-1 truncate text-xs font-medium">
                      {hit.sessionTitle}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-[10px]">
                      {hit.sessionDate}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded px-1 py-0.5 font-mono text-[9px] uppercase",
                        hit.messageRole === "user"
                          ? "bg-primary/10 text-primary"
                          : "bg-surface-4 text-muted-foreground"
                      )}
                    >
                      {hit.messageRole}
                    </span>
                  </div>
                  <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
                    {highlight(hit.excerpt, query)}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground py-6 text-center text-xs">
              Type to search across all sessions
            </p>
          )}
        </div>

        <div className="border-border text-muted-foreground border-t px-4 py-2 font-mono text-[10px]">
          ⌘⇧F to toggle · Enter to open session · Esc to close
        </div>
      </div>
    </div>
  )
}
