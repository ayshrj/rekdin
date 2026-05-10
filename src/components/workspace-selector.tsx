"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useChat } from "@/contexts/chat-context"
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronRight,
  GalleryVerticalEnd,
  InformationCircle,
} from "@/lib/icons"
import { cn } from "@/lib/utils"

type WorkspaceDirectory = {
  name: string
  path: string
  hidden: boolean
  protected?: boolean
  skipped?: boolean
  reason?: string
}

type WorkspaceBrowseResponse = {
  currentPath: string
  parentPath: string | null
  defaultPath: string
  directories: WorkspaceDirectory[]
  error?: string
}

type BrowseOptions = {
  recordHistory?: boolean
  historyIndex?: number
}

function DirectoryRow({
  directory,
  onOpen,
}: {
  directory: WorkspaceDirectory
  onOpen: () => void
}) {
  const isProtected = Boolean(directory.protected)
  const tooltipText =
    directory.reason ?? "This folder is protected or skipped because it is expected to be large."

  const row = (
    <button
      type="button"
      disabled={isProtected}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
        "hover:bg-surface-4/80",
        "disabled:cursor-not-allowed disabled:hover:bg-transparent",
        isProtected && "text-muted-foreground"
      )}
      onClick={onOpen}
    >
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
          isProtected
            ? "border-border/60 bg-muted/20 text-muted-foreground/45"
            : "border-border bg-surface-4 text-primary/80 group-hover:text-primary"
        )}
      >
        <GalleryVerticalEnd className="h-3.5 w-3.5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{directory.name}</span>

          {directory.hidden ? (
            <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-1.5 py-0.5 text-[10px]">
              hidden
            </span>
          ) : null}

          {isProtected ? (
            <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-1.5 py-0.5 text-[10px]">
              protected
            </span>
          ) : null}
        </div>

        <p className="text-muted-foreground/60 mt-0.5 truncate font-mono text-[11px]">
          {directory.path}
        </p>
      </div>

      {isProtected ? (
        <InformationCircle className="text-muted-foreground/45 h-3.5 w-3.5 shrink-0" />
      ) : (
        <ChevronRight className="text-muted-foreground/50 group-hover:text-muted-foreground h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
      )}
    </button>
  )

  if (!isProtected) return row

  return (
    <Tooltip>
      <TooltipTrigger asChild>{row}</TooltipTrigger>
      <TooltipContent side="left" align="center" className="text-xs">
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  )
}

export function WorkspaceSelector({ active = true }: { active?: boolean }) {
  const { workspaceRoot, updateWorkspaceSettings } = useChat()

  const [workspaceRootDraft, setWorkspaceRootDraft] = React.useState("")
  const [workspaceBrowserPath, setWorkspaceBrowserPath] = React.useState("")
  const [workspaceDefaultPath, setWorkspaceDefaultPath] = React.useState("")
  const [workspaceParentPath, setWorkspaceParentPath] = React.useState<string | null>(null)
  const [workspaceDirectories, setWorkspaceDirectories] = React.useState<WorkspaceDirectory[]>([])
  const [isLoadingWorkspace, setIsLoadingWorkspace] = React.useState(false)
  const [history, setHistory] = React.useState<string[]>([])
  const [historyIndex, setHistoryIndex] = React.useState(-1)

  const historyIndexRef = React.useRef(-1)

  const browseWorkspace = React.useCallback(
    async (targetPath?: string, options: BrowseOptions = {}) => {
      try {
        setIsLoadingWorkspace(true)

        const params = targetPath ? `?path=${encodeURIComponent(targetPath)}` : ""
        const res = await fetch(`/api/workspace/browse${params}`, { cache: "no-store" })
        const data = (await res.json()) as WorkspaceBrowseResponse

        if (!res.ok) {
          toast.error(data.error ?? "Unable to browse workspace folders")
          return false
        }

        setWorkspaceBrowserPath(data.currentPath)
        setWorkspaceDefaultPath(data.defaultPath)
        setWorkspaceParentPath(data.parentPath)
        setWorkspaceDirectories(data.directories ?? [])

        if (options.historyIndex !== undefined) {
          historyIndexRef.current = options.historyIndex
          setHistoryIndex(options.historyIndex)
        } else if (options.recordHistory !== false) {
          setHistory((prev) => {
            const next = prev.slice(0, Math.max(historyIndexRef.current + 1, 0))

            if (next[next.length - 1] !== data.currentPath) {
              next.push(data.currentPath)
            }

            const nextIndex = next.length - 1
            historyIndexRef.current = nextIndex
            setHistoryIndex(nextIndex)

            return next
          })
        }

        return true
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to browse workspace folders")
        return false
      } finally {
        setIsLoadingWorkspace(false)
      }
    },
    []
  )

  React.useEffect(() => {
    if (!active) return

    setWorkspaceRootDraft(workspaceRoot)
    setHistory([])
    historyIndexRef.current = -1
    setHistoryIndex(-1)

    void browseWorkspace(workspaceRoot || undefined, { recordHistory: true })
  }, [active, browseWorkspace, workspaceRoot])

  const saveWorkspace = React.useCallback(() => {
    updateWorkspaceSettings({ workspaceRoot: workspaceRootDraft })
    toast.success("Workspace saved")
  }, [updateWorkspaceSettings, workspaceRootDraft])

  const canGoBack = historyIndex > 0
  const canGoForward = historyIndex >= 0 && historyIndex < history.length - 1

  return (
    <TooltipProvider delayDuration={250}>
      <div className="bg-surface-2 flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="border-border/80 bg-surface-2/95 shrink-0 border-b px-4 py-3">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                <GalleryVerticalEnd className="h-4 w-4" />
              </div>

              <div className="min-w-0">
                <h3 className="text-sm leading-none font-semibold">Workspace</h3>
                <p className="text-muted-foreground mt-1 truncate font-mono text-xs">
                  {workspaceRoot || "App root (default)"}
                </p>
              </div>
            </div>

            <Button type="button" size="sm" onClick={saveWorkspace}>
              <Check className="h-3.5 w-3.5" />
              Save
            </Button>
          </div>
        </div>

        <div className="rk-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
          <div className="flex w-full flex-col gap-4">
            <div className="border-border bg-surface-3/70 rounded-xl border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Label className="text-muted-foreground text-xs">Selected workspace</Label>
                  <p className="text-foreground/80 mt-1 font-mono text-xs break-all">
                    {workspaceRootDraft || "App root (default)"}
                  </p>
                </div>

                {workspaceRootDraft ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      setWorkspaceRootDraft("")
                      void browseWorkspace(workspaceDefaultPath || undefined)
                    }}
                  >
                    Reset
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="border-border bg-surface-3/70 rounded-xl border p-3">
              <div className="space-y-2">
                <Label htmlFor="chat-workspace-root">Workspace root</Label>

                <div className="flex gap-2">
                  <Input
                    id="chat-workspace-root"
                    className="font-mono text-xs"
                    placeholder={workspaceRoot || "App root (default)"}
                    value={workspaceRootDraft}
                    onChange={(event) => setWorkspaceRootDraft(event.target.value)}
                  />

                  <Button
                    type="button"
                    variant="outline"
                    disabled={isLoadingWorkspace}
                    onClick={() => void browseWorkspace(workspaceRootDraft || undefined)}
                  >
                    Open
                  </Button>
                </div>

                <p className="text-muted-foreground text-xs">
                  Tools, repo audit, file access, and git helpers use this as the project boundary.
                </p>
              </div>
            </div>

            <div className="border-border bg-surface-3 overflow-hidden rounded-xl border">
              <div className="border-border bg-surface-4/60 border-b p-3">
                <div className="flex flex-col gap-3">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">Folder browser</p>
                      <p className="text-muted-foreground mt-1 truncate font-mono text-xs">
                        {workspaceBrowserPath || workspaceDefaultPath || "Loading..."}
                      </p>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      disabled={!workspaceBrowserPath}
                      onClick={() => setWorkspaceRootDraft(workspaceBrowserPath)}
                    >
                      Select current
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      disabled={isLoadingWorkspace || !canGoBack}
                      onClick={() => {
                        const nextIndex = historyIndex - 1
                        const target = history[nextIndex]

                        if (target) {
                          void browseWorkspace(target, {
                            recordHistory: false,
                            historyIndex: nextIndex,
                          })
                        }
                      }}
                      aria-label="Go back"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      disabled={isLoadingWorkspace || !canGoForward}
                      onClick={() => {
                        const nextIndex = historyIndex + 1
                        const target = history[nextIndex]

                        if (target) {
                          void browseWorkspace(target, {
                            recordHistory: false,
                            historyIndex: nextIndex,
                          })
                        }
                      }}
                      aria-label="Go forward"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isLoadingWorkspace || !workspaceParentPath}
                      onClick={() =>
                        workspaceParentPath && void browseWorkspace(workspaceParentPath)
                      }
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={isLoadingWorkspace}
                      onClick={() => void browseWorkspace(workspaceDefaultPath || undefined)}
                    >
                      Repo root
                    </Button>
                  </div>
                </div>
              </div>

              <div className="max-h-[44vh] overflow-y-auto p-2">
                {isLoadingWorkspace ? (
                  <div className="flex flex-col items-center justify-center px-2 py-10 text-center">
                    <div className="border-primary/30 border-t-primary mb-3 h-5 w-5 animate-spin rounded-full border-2" />
                    <p className="text-muted-foreground text-sm">Loading folders...</p>
                  </div>
                ) : workspaceDirectories.length === 0 ? (
                  <div className="px-2 py-10 text-center">
                    <p className="text-sm font-medium">No child folders found</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Try moving up or selecting the current directory.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {workspaceDirectories.map((directory) => (
                      <DirectoryRow
                        key={directory.path}
                        directory={directory}
                        onOpen={() => void browseWorkspace(directory.path)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
