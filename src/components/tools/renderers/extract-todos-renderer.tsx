"use client"

import { type ToolResultContentPart } from "./tool-result-renderer"

interface TodoItem {
  file?: string
  line?: number
  text?: string
  type?: string
}

const TYPE_STYLES: Record<string, string> = {
  TODO: "bg-blue-500/10 text-blue-600",
  FIXME: "bg-destructive/10 text-destructive",
  HACK: "bg-amber-500/10 text-amber-600",
  NOTE: "bg-muted text-muted-foreground",
  XXX: "bg-destructive/10 text-destructive",
  BUG: "bg-destructive/10 text-destructive",
}

export function ExtractTodosRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as { count?: number; todos?: TodoItem[] } | undefined
  const todos: TodoItem[] = result?.todos ?? []
  const count = result?.count ?? todos.length

  // Type breakdown
  const breakdown: Record<string, number> = {}
  for (const todo of todos) {
    const t = (todo.type ?? "TODO").toUpperCase()
    breakdown[t] = (breakdown[t] ?? 0) + 1
  }

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg">
      {/* Header */}
      <div className="bg-muted/20 flex items-center gap-2 border-b px-3 py-2">
        <span className="text-foreground text-xs font-semibold">TODO Items</span>
        <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">
          {count}
        </span>
        {Object.entries(breakdown).map(([type, n]) => (
          <span
            key={type}
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${TYPE_STYLES[type] ?? "bg-muted text-muted-foreground"}`}
          >
            {type} {n}
          </span>
        ))}
      </div>

      {todos.length === 0 ? (
        <div className="text-muted-foreground px-3 py-4 text-xs italic">No TODOs found</div>
      ) : (
        <div className="max-h-[50vh] divide-y overflow-auto">
          {todos.map((todo, i) => {
            const type = (todo.type ?? "TODO").toUpperCase()
            return (
              <div key={i} className="hover:bg-muted/20 flex items-start gap-2.5 px-3 py-2">
                <span
                  className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${TYPE_STYLES[type] ?? "bg-muted text-muted-foreground"}`}
                >
                  {type}
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  {(todo.file || todo.line !== undefined) && (
                    <div className="text-muted-foreground/60 font-mono text-[10px]">
                      {todo.file}
                      {todo.line !== undefined ? `:${todo.line}` : ""}
                    </div>
                  )}
                  <p className="text-foreground/80 text-xs leading-relaxed">{todo.text}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
