"use client"

import { FileExtensionIcon } from "@/components/file-extension-icon"

import {
  CopyButton,
  EmptyState,
  RawPayloadDisclosure,
  ToolMetaRow,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { SimpleCodeEditor } from "./simple-code-editor"
import { type ToolResultContentPart } from "./tool-result-renderer"

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function getExt(path: string): string {
  return path.split(".").pop()?.toLowerCase() ?? ""
}

const CODE_EXTS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "c",
  "cpp",
  "cs",
  "swift",
  "kt",
  "php",
  "sh",
  "bash",
  "css",
  "scss",
  "html",
  "xml",
  "yaml",
  "yml",
  "toml",
  "json",
  "jsonc",
  "sql",
  "prisma",
  "graphql",
])

export function FileStatRenderer({ part }: { part: ToolResultContentPart }) {
  const type = part.type
  const result = part.toolResult as Record<string, unknown> | undefined
  const inputPath =
    (part.toolInput as { path?: string } | undefined)?.path ??
    (result?.path as string | undefined) ??
    ""

  // ── file_head_tail ────────────────────────────────────────────────────────
  if (type === "file_head_tail") {
    const path = (result?.path ?? inputPath) as string
    const content = (result?.head ?? result?.tail ?? result?.content ?? "") as string
    const mode = (result?.mode ?? (result?.head ? "head" : "tail")) as string
    const requestedLines = result?.lines ?? result?.requestedLines
    const totalLines = result?.totalLines

    const ext = getExt(path)
    const isCode = CODE_EXTS.has(ext)

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">
              File {String(mode).toUpperCase()}
            </span>
            {path && (
              <>
                <FileExtensionIcon extensionName={path} className="h-3.5 w-3.5 shrink-0" />
                <span className="rk-path-chip max-w-60 min-w-0 truncate">{path}</span>
              </>
            )}
            {requestedLines != null && (
              <ToolStatusBadge variant="neutral">{String(requestedLines)} lines</ToolStatusBadge>
            )}
            {totalLines != null && (
              <span className="text-muted-foreground font-mono text-[10px]">
                of {String(totalLines)} total
              </span>
            )}
            {content && <CopyButton text={content} className="ml-auto" />}
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {!content ? (
          <EmptyState>No content</EmptyState>
        ) : isCode ? (
          <SimpleCodeEditor
            code={content}
            language={ext}
            fileName={path.split("/").pop() ?? path}
            showHeader={false}
            maxHeight="40vh"
            fontSize={12}
          />
        ) : (
          <pre className="text-foreground/80 max-h-[40vh] overflow-auto px-3 py-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
            {content}
          </pre>
        )}
      </ToolRendererShell>
    )
  }

  // ── file_stat ─────────────────────────────────────────────────────────────
  const path = (result?.path ?? inputPath) as string
  const size = result?.size
  const sizeHuman = result?.sizeHuman
  const permissions = (result?.permissions ?? result?.mode) as string | undefined
  const owner = (result?.owner ?? result?.user) as string | undefined
  const modified = (result?.modified ?? result?.mtime) as string | undefined
  const created = (result?.created ?? result?.ctime) as string | undefined
  const lineCount = result?.lineCount ?? result?.lines
  const isDir = Boolean(result?.isDirectory ?? result?.directory)

  const displaySize: string | undefined =
    sizeHuman != null
      ? String(sizeHuman)
      : typeof size === "number"
        ? formatSize(size)
        : size != null
          ? String(size)
          : undefined

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">File Stat</span>
          {path && (
            <>
              <FileExtensionIcon extensionName={path} className="h-3.5 w-3.5 shrink-0" />
              <span className="rk-path-chip max-w-60 min-w-0 truncate">{path}</span>
            </>
          )}
          <ToolStatusBadge variant="neutral">{isDir ? "directory" : "file"}</ToolStatusBadge>
          {displaySize && (
            <span className="text-muted-foreground font-mono text-[10px]">{displaySize}</span>
          )}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {!result ? (
        <EmptyState>No metadata</EmptyState>
      ) : (
        <div className="divide-y">
          {path && (
            <ToolMetaRow label="path" mono>
              {path}
            </ToolMetaRow>
          )}
          {permissions && (
            <ToolMetaRow label="permissions" mono>
              {permissions}
            </ToolMetaRow>
          )}
          {owner && (
            <ToolMetaRow label="owner" mono>
              {owner}
            </ToolMetaRow>
          )}
          {displaySize && (
            <ToolMetaRow label="size" mono>
              {displaySize}
            </ToolMetaRow>
          )}
          {lineCount != null && (
            <ToolMetaRow label="lines" mono>
              {String(lineCount)}
            </ToolMetaRow>
          )}
          {modified && (
            <ToolMetaRow label="modified" mono>
              {modified}
            </ToolMetaRow>
          )}
          {created && (
            <ToolMetaRow label="created" mono>
              {created}
            </ToolMetaRow>
          )}
        </div>
      )}
    </ToolRendererShell>
  )
}
