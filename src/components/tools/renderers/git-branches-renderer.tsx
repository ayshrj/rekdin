"use client"

import { type ToolResultContentPart } from "./tool-result-renderer"

function parseBranches(output: string) {
  const lines = output
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  const local: { name: string; current: boolean }[] = []
  const remote: string[] = []
  for (const line of lines) {
    const isCurrent = line.startsWith("*")
    const name = line.replace(/^\*\s*/, "").trim()
    if (name.startsWith("remotes/")) {
      remote.push(name.replace("remotes/", ""))
    } else {
      local.push({ name, current: isCurrent })
    }
  }
  return { local, remote }
}

export function GitBranchesRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as { output?: string; exitCode?: number } | undefined
  const output = result?.output ?? ""
  const { local, remote } = parseBranches(output)
  const totalCount = local.length + remote.length

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg">
      {/* Header */}
      <div className="bg-muted/20 flex items-center gap-2 border-b px-3 py-2">
        <span className="text-foreground text-xs font-semibold">Git Branches</span>
        <span className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-[10px]">
          {totalCount} branch{totalCount !== 1 ? "es" : ""}
        </span>
      </div>

      {totalCount === 0 ? (
        <div className="text-muted-foreground px-3 py-4 text-xs italic">No branches found</div>
      ) : (
        <div className="max-h-[50vh] overflow-auto">
          {/* Local */}
          {local.length > 0 && (
            <>
              <div className="border-b px-3 py-1">
                <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                  Local
                </span>
              </div>
              <div className="divide-y">
                {local.map((b, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 px-3 py-2 ${b.current ? "bg-primary/5" : "hover:bg-muted/20"}`}
                  >
                    <span
                      className={`min-w-0 flex-1 truncate font-mono text-xs ${
                        b.current ? "text-primary font-semibold" : "text-foreground/80"
                      }`}
                    >
                      {b.name}
                    </span>
                    {b.current && (
                      <span className="bg-primary/10 text-primary shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium">
                        current
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Remote */}
          {remote.length > 0 && (
            <>
              <div className="border-t border-b px-3 py-1">
                <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                  Remote
                </span>
              </div>
              <div className="divide-y">
                {remote.map((name, i) => (
                  <div key={i} className="hover:bg-muted/20 px-3 py-2">
                    <span className="text-muted-foreground/70 truncate font-mono text-xs">
                      {name}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
