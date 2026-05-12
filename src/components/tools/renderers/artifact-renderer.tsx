"use client"

import { FileExtensionIcon } from "@/components/file-extension-icon"

import {
  CopyButton,
  EmptyState,
  RawPayloadDisclosure,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { SimpleCodeEditor } from "./simple-code-editor"
import { type ToolResultContentPart } from "./tool-result-renderer"

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function mimeToLanguage(mime: string): string {
  if (mime.includes("javascript") || mime.includes("typescript")) return "typescript"
  if (mime.includes("json")) return "json"
  if (mime.includes("html")) return "html"
  if (mime.includes("css")) return "css"
  if (mime.includes("markdown")) return "markdown"
  if (mime.includes("python")) return "python"
  if (mime.includes("yaml")) return "yaml"
  if (mime.includes("xml")) return "xml"
  if (mime.includes("text")) return "text"
  return "text"
}

// ── artifact entry ────────────────────────────────────────────────────────────

interface ArtifactEntry {
  id?: string
  name: string
  type?: string
  size?: number
  createdAt?: string
  url?: string
}

function normalizeArtifacts(raw: unknown): ArtifactEntry[] {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.artifacts)
      ? ((raw as Record<string, unknown>).artifacts as unknown[])
      : Array.isArray((raw as Record<string, unknown>)?.files)
        ? ((raw as Record<string, unknown>).files as unknown[])
        : []
  return arr
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
    .map((r) => ({
      id: r.id ? String(r.id) : undefined,
      name: String(r.name ?? r.filename ?? r.path ?? ""),
      type: r.type ? String(r.type) : r.mimeType ? String(r.mimeType) : undefined,
      size: typeof r.size === "number" ? r.size : undefined,
      createdAt: r.createdAt ? String(r.createdAt) : r.created ? String(r.created) : undefined,
      url: r.url ? String(r.url) : r.artifactUrl ? String(r.artifactUrl) : undefined,
    }))
}

// ── asset manifest entry ──────────────────────────────────────────────────────

interface AssetEntry {
  path: string
  hash?: string
  size?: number
  type?: string
}

function normalizeAssets(raw: unknown): AssetEntry[] {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.assets)
      ? ((raw as Record<string, unknown>).assets as unknown[])
      : Array.isArray((raw as Record<string, unknown>)?.files)
        ? ((raw as Record<string, unknown>).files as unknown[])
        : []
  return arr
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
    .map((r) => ({
      path: String(r.path ?? r.file ?? r.name ?? ""),
      hash: r.hash ? String(r.hash) : r.digest ? String(r.digest) : undefined,
      size: typeof r.size === "number" ? r.size : undefined,
      type: r.type ? String(r.type) : undefined,
    }))
}

// ── Main renderer ─────────────────────────────────────────────────────────────

export function ArtifactRenderer({ part }: { part: ToolResultContentPart }) {
  const type = part.type
  const result = part.toolResult as Record<string, unknown> | undefined

  // ── artifact_delete ────────────────────────────────────────────────────────
  if (type === "artifact_delete") {
    const success = result?.success !== false && !result?.error
    const name = (result?.name ?? result?.filename ?? result?.id ?? "") as string
    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">
              Delete Artifact
            </span>
            {name && <span className="rk-path-chip max-w-50 min-w-0 truncate">{name}</span>}
            <ToolStatusBadge variant={success ? "success" : "error"}>
              {success ? "deleted" : "failed"}
            </ToolStatusBadge>
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        <EmptyState>
          {success ? "Artifact deleted successfully" : String(result?.error ?? "Delete failed")}
        </EmptyState>
      </ToolRendererShell>
    )
  }

  // ── artifact_read ──────────────────────────────────────────────────────────
  if (type === "artifact_read") {
    const name = (result?.name ?? result?.filename ?? "") as string
    const mimeType = (result?.mimeType ?? result?.type ?? "text/plain") as string
    const content = (result?.content ?? result?.data ?? result?.text ?? "") as string
    const language = mimeToLanguage(mimeType)

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">Artifact</span>
            {name && (
              <>
                <FileExtensionIcon extensionName={name} className="h-3.5 w-3.5 shrink-0" />
                <span className="rk-path-chip max-w-50 min-w-0 truncate">{name}</span>
              </>
            )}
            <span className="text-muted-foreground border-border bg-surface-4 shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px]">
              {mimeType}
            </span>
            {content && <CopyButton text={content} className="ml-auto" />}
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {!content ? (
          <EmptyState>No content</EmptyState>
        ) : (
          <SimpleCodeEditor
            code={content}
            language={language}
            fileName={name || "artifact"}
            showHeader={false}
            maxHeight="50vh"
            fontSize={12}
          />
        )}
      </ToolRendererShell>
    )
  }

  // ── asset_manifest ─────────────────────────────────────────────────────────
  if (type === "asset_manifest") {
    const assets = normalizeAssets(result?.assets ?? result?.files ?? result ?? [])
    const totalSize = assets.reduce((n, a) => n + (a.size ?? 0), 0)

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">
              Asset Manifest
            </span>
            <ToolStatusBadge variant="neutral">
              {assets.length} asset{assets.length !== 1 ? "s" : ""}
            </ToolStatusBadge>
            {totalSize > 0 && (
              <span className="text-muted-foreground font-mono text-[10px]">
                {formatBytes(totalSize)}
              </span>
            )}
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {assets.length === 0 ? (
          <EmptyState>No assets</EmptyState>
        ) : (
          <div className="rk-scrollbar max-h-[40vh] divide-y overflow-auto">
            {assets.map((a, i) => (
              <div key={i} className="hover:bg-surface-4 flex items-center gap-2.5 px-3 py-1.5">
                <FileExtensionIcon extensionName={a.path} className="h-3 w-3 shrink-0" />
                <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
                  {a.path}
                </span>
                {a.hash && (
                  <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                    {a.hash.slice(0, 8)}
                  </span>
                )}
                {a.size != null && (
                  <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                    {formatBytes(a.size)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </ToolRendererShell>
    )
  }

  // ── artifact_list (default) ────────────────────────────────────────────────
  const artifacts = normalizeArtifacts(result?.artifacts ?? result?.files ?? result ?? [])

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Artifacts</span>
          <ToolStatusBadge variant="neutral">
            {artifacts.length} artifact{artifacts.length !== 1 ? "s" : ""}
          </ToolStatusBadge>
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {artifacts.length === 0 ? (
        <EmptyState>No artifacts</EmptyState>
      ) : (
        <div className="rk-scrollbar max-h-[40vh] divide-y overflow-auto">
          {artifacts.map((a, i) => (
            <div key={i} className="hover:bg-surface-4 flex items-center gap-2.5 px-3 py-1.5">
              <FileExtensionIcon extensionName={a.name} className="h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-foreground/80 block min-w-0 truncate font-mono text-[11px]">
                  {a.name}
                </span>
                {a.createdAt && (
                  <span className="text-muted-foreground font-mono text-[10px]">{a.createdAt}</span>
                )}
              </div>
              {a.type && (
                <span className="text-muted-foreground border-border bg-surface-4 shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px]">
                  {a.type}
                </span>
              )}
              {a.size != null && (
                <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                  {formatBytes(a.size)}
                </span>
              )}
              {a.url && (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rk-flat-button shrink-0 font-mono text-[10px]"
                >
                  Open
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </ToolRendererShell>
  )
}
