"use client"

import React from "react"

import { ChevronDown, ChevronRight, File } from "@/lib/icons"
import { cn } from "@/lib/utils"

import { type ToolResultContentPart } from "./tool-result-renderer"

interface FileEntry {
  name: string
  path: string
  type: "directory" | "file"
  size: number
  modified: string
}

interface TreeNode {
  name: string
  path: string
  type: "directory" | "file"
  size: number
  modified: string
  children: TreeNode[]
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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FolderIcon({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      {open ? (
        <path d="M1.5 3A1.5 1.5 0 0 0 0 4.5v8A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 14.5 5H7.621a1.5 1.5 0 0 1-1.06-.44L5.5 3.5A1.5 1.5 0 0 0 4.44 3H1.5Z" />
      ) : (
        <path d="M.54 3.87.5 3a2 2 0 0 1 2-2h3.19a2 2 0 0 1 1.345.513l.984.86A1 1 0 0 0 8.71 2.5H13.5A1.5 1.5 0 0 1 15 4v.63l.54.44A.5.5 0 0 1 16 5.5v8a.5.5 0 0 1-.5.5h-15a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .04-.13ZM1.5 4h13v8h-13V4Z" />
      )}
    </svg>
  )
}

function TreeNodeRow({
  node,
  depth,
  defaultOpen,
}: {
  node: TreeNode
  depth: number
  defaultOpen: boolean
}) {
  const [open, setOpen] = React.useState(defaultOpen)
  const isDir = node.type === "directory"
  const hasChildren = node.children.length > 0

  return (
    <>
      <div
        className={cn(
          "group flex items-center gap-1.5 rounded px-2 py-[3px] text-[12px]",
          isDir
            ? "text-foreground/80 hover:bg-muted/40 cursor-pointer font-medium"
            : "text-foreground/65 hover:bg-muted/30"
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => isDir && hasChildren && setOpen((o) => !o)}
      >
        {/* Expand chevron */}
        <span className="w-3 shrink-0">
          {isDir && hasChildren ? (
            open ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )
          ) : null}
        </span>

        {/* Icon */}
        {isDir ? (
          <FolderIcon
            open={open}
            className={cn("h-3.5 w-3.5 shrink-0", open ? "text-amber-400" : "text-amber-500/80")}
          />
        ) : (
          <File className="text-muted-foreground/60 h-3.5 w-3.5 shrink-0" />
        )}

        {/* Name */}
        <span className="min-w-0 flex-1 truncate font-mono">{node.name}</span>

        {/* Size (files only) */}
        {!isDir && node.size > 0 && (
          <span className="text-muted-foreground/40 shrink-0 text-[10px]">
            {formatSize(node.size)}
          </span>
        )}
      </div>

      {isDir && open && hasChildren && (
        <>
          {node.children.map((child) => (
            <TreeNodeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              defaultOpen={defaultOpen}
            />
          ))}
        </>
      )}
    </>
  )
}

export const ListFilesRenderer: React.FC<{
  part: ToolResultContentPart
  onAction?: (action: string, data: unknown) => void
}> = ({ part }) => {
  const result = part.toolResult as { path?: string; files?: FileEntry[] } | undefined

  const rootPath: string =
    result?.path ?? (part.toolInput as { path?: string } | undefined)?.path ?? "."
  const files: FileEntry[] = result?.files ?? []
  const tree = React.useMemo(() => buildTree(files), [files])

  const totalFiles = files.filter((f) => f.type === "file").length
  const totalDirs = files.filter((f) => f.type === "directory").length

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg">
      {/* Header */}
      <div className="bg-muted/20 flex items-center justify-between border-b px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <FolderIcon open className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          <span className="text-foreground/70 truncate font-mono text-[11px]" title={rootPath}>
            {rootPath}
          </span>
        </div>
        <div className="text-muted-foreground flex shrink-0 items-center gap-2 text-[10px]">
          {totalDirs > 0 && (
            <span>
              {totalDirs} folder{totalDirs !== 1 ? "s" : ""}
            </span>
          )}
          {totalFiles > 0 && (
            <span>
              {totalFiles} file{totalFiles !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Tree */}
      {tree.length === 0 ? (
        <div className="text-muted-foreground px-3 py-4 text-xs italic">Empty directory</div>
      ) : (
        <div className="max-h-[60vh] overflow-auto py-1">
          {tree.map((node) => (
            <TreeNodeRow key={node.path} node={node} depth={0} defaultOpen={true} />
          ))}
        </div>
      )}
    </div>
  )
}
