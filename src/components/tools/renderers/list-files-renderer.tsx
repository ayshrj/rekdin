"use client"

import React from "react"

import { FileExtensionIcon } from "@/components/file-extension-icon"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ChevronDown, ChevronRight, FolderTreeIcon, InformationCircle } from "@/lib/icons"
import { cn } from "@/lib/utils"

import { CopyButton, InlineToolResult, SearchInput, useToolInvoke } from "./renderer-primitives"
import { SimpleCodeEditor } from "./simple-code-editor"
import { type ToolResultContentPart } from "./tool-result-renderer"

interface FileEntry {
  name: string
  path: string
  type: "directory" | "file"
  size: number
  modified: string
  protected?: boolean
  skipped?: boolean
  reason?: string
}

interface TreeNode {
  name: string
  path: string
  type: "directory" | "file"
  size: number
  modified: string
  protected?: boolean
  skipped?: boolean
  reason?: string
  children: TreeNode[]
}

const EMPTY_FILE_ENTRIES: FileEntry[] = []

function normalizeFileEntry(entry: unknown, index: number): FileEntry | null {
  if (!entry || typeof entry !== "object") return null

  const record = entry as Partial<FileEntry>
  const name = typeof record.name === "string" && record.name.trim() ? record.name : undefined
  const path = typeof record.path === "string" && record.path.trim() ? record.path : name
  if (!path) return null

  const type = record.type === "directory" || record.type === "file" ? record.type : "file"

  return {
    name: name ?? path.split("/").filter(Boolean).pop() ?? `entry-${index + 1}`,
    path,
    type,
    size: typeof record.size === "number" ? record.size : 0,
    modified: typeof record.modified === "string" ? record.modified : "",
    protected: record.protected,
    skipped: record.skipped,
    reason: record.reason,
  }
}

function normalizeFileEntries(files: unknown): FileEntry[] {
  if (!Array.isArray(files)) return EMPTY_FILE_ENTRIES
  return files
    .map((entry, index) => normalizeFileEntry(entry, index))
    .filter((entry): entry is FileEntry => entry !== null)
}

function buildTree(files: FileEntry[]): TreeNode[] {
  const root: TreeNode[] = []
  const map = new Map<string, TreeNode>()

  // Sort: directories first, then files, alphabetically within each group
  const sorted = [...files].sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1
    return a.path.localeCompare(b.path)
  })

  for (const entry of sorted) {
    const node: TreeNode = { ...entry, children: [] }
    map.set(entry.path, node)

    const parts = entry.path.split("/")
    if (parts.length === 1) {
      root.push(node)
    } else {
      const parentPath = parts.slice(0, -1).join("/")
      const parent = map.get(parentPath)
      if (parent) {
        parent.children.push(node)
      } else {
        // Parent not in list (e.g. recursive result missing intermediate dirs)
        root.push(node)
      }
    }
  }

  return root
}

function flattenFiles(nodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = []
  for (const node of nodes) {
    if (node.type === "file") result.push(node)
    if (node.children.length > 0) result.push(...flattenFiles(node.children))
  }
  return result
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function TreeNodeRow({
  node,
  depth,
  defaultOpen,
  onFileClick,
  activePath,
  forceOpen,
}: {
  node: TreeNode
  depth: number
  defaultOpen: boolean
  onFileClick?: (path: string) => void
  activePath?: string | null
  forceOpen?: boolean | null
}) {
  const [open, setOpen] = React.useState(defaultOpen)

  React.useEffect(() => {
    if (forceOpen !== null && forceOpen !== undefined) setOpen(forceOpen)
  }, [forceOpen])

  const isDir = node.type === "directory"
  const hasChildren = node.children.length > 0
  const isSkippedProtectedDirectory = isDir && node.protected && node.skipped
  const isActive = !isDir && activePath === node.path

  const tooltipText =
    node.reason ?? "Skipped by default because this folder is expected to be large."

  const handleClick = () => {
    if (isDir && hasChildren) setOpen((o) => !o)
    else if (!isDir) onFileClick?.(node.path)
  }

  const row = (
    <div
      className={cn(
        "group flex items-center gap-1.5 rounded px-2 py-0.75 text-[12px]",
        isDir
          ? cn(
              "text-foreground/80 font-medium",
              hasChildren ? "hover:bg-muted/40 cursor-pointer" : "hover:bg-muted/30"
            )
          : cn(
              "cursor-pointer",
              isActive ? "bg-primary/10 text-foreground" : "text-foreground/65 hover:bg-muted/30"
            )
      )}
      style={{ paddingLeft: `${8 + depth * 16}px` }}
      onClick={handleClick}
    >
      <span className="text-muted-foreground/50 w-3 shrink-0">
        {isDir && hasChildren ? (
          open ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )
        ) : null}
      </span>

      {isDir ? (
        <FolderTreeIcon
          open={open}
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-colors",
            isSkippedProtectedDirectory
              ? "text-amber-400/35 group-hover:text-amber-500/55"
              : open
                ? "text-amber-400"
                : "text-amber-500/80"
          )}
        />
      ) : (
        <FileExtensionIcon extensionName={node.name} className="h-3.5 w-3.5 text-[14px]" />
      )}

      <span className="min-w-0 flex-1 truncate font-mono">{node.name}</span>

      {isSkippedProtectedDirectory ? (
        <InformationCircle className="text-muted-foreground/35 group-hover:text-muted-foreground/60 h-3 w-3 shrink-0" />
      ) : null}

      {!isDir && node.size > 0 ? (
        <span className="text-muted-foreground/40 shrink-0 text-[10px]">
          {formatSize(node.size)}
        </span>
      ) : null}

      {/* Copy path — appears on row hover */}
      <span
        className="opacity-0 transition-opacity group-hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <CopyButton text={node.path} className="h-3 w-3 p-0" />
      </span>
    </div>
  )

  return (
    <>
      {isSkippedProtectedDirectory ? (
        <Tooltip>
          <TooltipTrigger asChild>{row}</TooltipTrigger>
          <TooltipContent side="right" align="center" className="max-w-xs text-xs">
            {tooltipText}
          </TooltipContent>
        </Tooltip>
      ) : (
        row
      )}

      {isDir && open && hasChildren ? (
        <>
          {node.children.map((child) => (
            <TreeNodeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              defaultOpen={defaultOpen}
              onFileClick={onFileClick}
              activePath={activePath}
              forceOpen={forceOpen}
            />
          ))}
        </>
      ) : null}
    </>
  )
}

type FileReadResult = { path?: string; content?: string; truncated?: boolean }

export const ListFilesRenderer: React.FC<{
  part: ToolResultContentPart
  onAction?: (action: string, data: unknown) => void
}> = ({ part }) => {
  const result = part.toolResult as { path?: string; files?: unknown } | undefined

  const rootPath: string =
    result?.path ?? (part.toolInput as { path?: string } | undefined)?.path ?? "."
  const files = React.useMemo(() => normalizeFileEntries(result?.files), [result?.files])
  const tree = React.useMemo(() => buildTree(files), [files])
  const allFileNodes = React.useMemo(() => flattenFiles(tree), [tree])

  const totalFiles = files.filter((f) => f.type === "file").length
  const totalDirs = files.filter((f) => f.type === "directory").length
  const skippedDirs = files.filter((f) => f.type === "directory" && f.skipped).length

  const {
    loading,
    result: fileResult,
    error: fileError,
    invoke,
    reset,
  } = useToolInvoke<FileReadResult>("file_read")
  const [activePath, setActivePath] = React.useState<string | null>(null)
  const [filterQuery, setFilterQuery] = React.useState("")
  const [forceOpen, setForceOpen] = React.useState<boolean | null>(null)

  const handleFileClick = React.useCallback(
    async (path: string) => {
      if (activePath === path) {
        reset()
        setActivePath(null)
        return
      }
      setActivePath(path)
      await invoke({ path })
    },
    [activePath, invoke, reset]
  )

  const handleForceOpen = React.useCallback((value: boolean) => {
    setForceOpen(value)
    setTimeout(() => setForceOpen(null), 0)
  }, [])

  const q = filterQuery.toLowerCase()
  const filteredNodes = q
    ? allFileNodes.filter(
        (n) => n.path.toLowerCase().includes(q) || n.name.toLowerCase().includes(q)
      )
    : null

  const fileContent = fileResult?.content ?? ""
  const filePath = fileResult?.path ?? activePath ?? ""
  const ext = filePath.split(".").pop()?.toLowerCase() ?? ""
  const fileName = filePath.split("/").pop() ?? filePath

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg">
      {/* Header */}
      <div className="bg-muted/20 flex items-center gap-2 border-b px-3 py-2">
        <FolderTreeIcon open className="h-3.5 w-3.5 shrink-0 text-amber-400" />
        <span
          className="text-foreground/70 min-w-0 flex-1 truncate font-mono text-[11px]"
          title={rootPath}
        >
          {rootPath}
        </span>
        {/* Search input */}
        {totalFiles > 0 && (
          <SearchInput
            value={filterQuery}
            onChange={setFilterQuery}
            placeholder="Filter files…"
            className="w-36"
          />
        )}
        {/* Stats / match count */}
        <div className="text-muted-foreground flex shrink-0 items-center gap-2 text-[10px]">
          {filteredNodes ? (
            <span className={filteredNodes.length === 0 ? "text-destructive" : ""}>
              {filteredNodes.length} match{filteredNodes.length !== 1 ? "es" : ""}
            </span>
          ) : (
            <>
              {totalDirs > 0 && <span>{totalDirs}d</span>}
              {totalFiles > 0 && <span>{totalFiles}f</span>}
              {skippedDirs > 0 && (
                <span className="text-status-warning">{skippedDirs} skipped</span>
              )}
            </>
          )}
        </div>
        {/* Expand / Collapse all — only show when not filtering */}
        {!filteredNodes && tree.length > 0 && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => handleForceOpen(true)}
              className="rk-flat-button font-mono text-[10px]"
              title="Expand all"
            >
              ↕ All
            </button>
            <button
              type="button"
              onClick={() => handleForceOpen(false)}
              className="rk-flat-button font-mono text-[10px]"
              title="Collapse all"
            >
              ↔ Col
            </button>
          </div>
        )}
      </div>

      {/* Body: filtered flat list OR full tree */}
      {tree.length === 0 ? (
        <div className="text-muted-foreground px-3 py-4 text-xs italic">Empty directory</div>
      ) : filteredNodes ? (
        filteredNodes.length === 0 ? (
          <div className="text-muted-foreground px-3 py-4 text-xs italic">No matches</div>
        ) : (
          <div className="rk-scrollbar max-h-[60vh] divide-y overflow-auto">
            {filteredNodes.map((node) => (
              <div
                key={node.path}
                className={cn(
                  "group flex cursor-pointer items-center gap-2 px-3 py-1.5 transition-colors",
                  activePath === node.path ? "bg-primary/10" : "hover:bg-muted/30"
                )}
                onClick={() => handleFileClick(node.path)}
              >
                <FileExtensionIcon
                  extensionName={node.name}
                  className="h-3.5 w-3.5 shrink-0 text-[14px]"
                />
                <span
                  className="text-foreground/75 min-w-0 flex-1 truncate font-mono text-[11px]"
                  title={node.path}
                >
                  {node.path}
                </span>
                {node.size > 0 && (
                  <span className="text-muted-foreground/40 shrink-0 text-[10px]">
                    {formatSize(node.size)}
                  </span>
                )}
                <span
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <CopyButton text={node.path} className="h-3 w-3 p-0" />
                </span>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="rk-scrollbar max-h-[60vh] overflow-auto py-1">
          {tree.map((node) => (
            <TreeNodeRow
              key={node.path}
              node={node}
              depth={0}
              defaultOpen={true}
              onFileClick={handleFileClick}
              activePath={activePath}
              forceOpen={forceOpen}
            />
          ))}
        </div>
      )}

      {/* Inline file reader */}
      {(activePath || loading) && (
        <InlineToolResult
          title={loading ? `Loading ${activePath ?? ""}…` : filePath}
          onDismiss={() => {
            reset()
            setActivePath(null)
          }}
          error={fileError}
        >
          {fileContent && (
            <div className="border-b pb-0">
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="text-muted-foreground font-mono text-[10px]">
                  {fileContent.split("\n").length} lines
                  {fileResult?.truncated ? " (truncated)" : ""}
                </span>
                <CopyButton text={fileContent} />
              </div>
              <SimpleCodeEditor
                code={fileContent}
                language={ext}
                fileName={fileName}
                showHeader={false}
                maxHeight="40vh"
                fontSize={12}
                readOnly
              />
            </div>
          )}
        </InlineToolResult>
      )}
    </div>
  )
}
