"use client"

import { Image } from "@/components/ui/image"

import { BrowserShell } from "../browser-shell"
import {
  EmptyState,
  RawPayloadDisclosure,
  ToolRendererShell,
  ToolStatusBadge,
} from "../renderer-primitives"
import { type ToolResultContentPart } from "../tool-result-renderer"

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── browser_downloads ─────────────────────────────────────────────────────────

interface DownloadedFile {
  filename: string
  path?: string
  size?: number
  url?: string
  mimeType?: string
}

function normalizeDownloads(raw: unknown): DownloadedFile[] {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.files)
      ? ((raw as Record<string, unknown>).files as unknown[])
      : Array.isArray((raw as Record<string, unknown>)?.downloads)
        ? ((raw as Record<string, unknown>).downloads as unknown[])
        : []
  return arr
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
    .map((r) => ({
      filename: String(r.filename ?? r.name ?? r.file ?? ""),
      path: r.path ? String(r.path) : undefined,
      size: typeof r.size === "number" ? r.size : undefined,
      url: r.url ? String(r.url) : undefined,
      mimeType: r.mimeType ? String(r.mimeType) : r.type ? String(r.type) : undefined,
    }))
}

// ── browser_form_schema ───────────────────────────────────────────────────────

interface FormField {
  name: string
  type: string
  label?: string
  required?: boolean
  placeholder?: string
  options?: string[]
}

function normalizeFormFields(raw: unknown): FormField[] {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.fields)
      ? ((raw as Record<string, unknown>).fields as unknown[])
      : Array.isArray((raw as Record<string, unknown>)?.schema)
        ? ((raw as Record<string, unknown>).schema as unknown[])
        : []
  return arr
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
    .map((r) => ({
      name: String(r.name ?? r.id ?? r.field ?? ""),
      type: String(r.type ?? r.inputType ?? "text"),
      label: r.label ? String(r.label) : undefined,
      required: typeof r.required === "boolean" ? r.required : undefined,
      placeholder: r.placeholder ? String(r.placeholder) : undefined,
      options: Array.isArray(r.options) ? r.options.map(String) : undefined,
    }))
}

// ── Main renderer ─────────────────────────────────────────────────────────────

export function BrowserScreenshotExtRenderer({ part }: { part: ToolResultContentPart }) {
  const type = part.type
  const result = part.toolResult as Record<string, unknown> | undefined
  const input = part.toolInput as Record<string, unknown> | undefined

  // ── browser_print_pdf ──────────────────────────────────────────────────────
  if (type === "browser_print_pdf") {
    const artifactUrl = (result?.artifactUrl ?? result?.url ?? result?.pdfUrl ?? "") as string
    const pages = result?.pages ?? result?.pageCount ?? result?.numPages
    const url = (result?.sourceUrl ?? input?.url ?? "") as string

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">Print PDF</span>
            {pages != null && (
              <ToolStatusBadge variant="neutral">
                {String(pages)} page{Number(pages) !== 1 ? "s" : ""}
              </ToolStatusBadge>
            )}
            {artifactUrl && (
              <a
                href={artifactUrl}
                target="_blank"
                rel="noreferrer"
                className="rk-flat-button ml-auto font-mono text-[10px]"
              >
                Open PDF
              </a>
            )}
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {url ? (
          <div className="px-3 py-2">
            <span className="text-muted-foreground font-mono text-[10px]">{url}</span>
          </div>
        ) : (
          <EmptyState>{artifactUrl ? "PDF generated" : "No PDF data"}</EmptyState>
        )}
      </ToolRendererShell>
    )
  }

  // ── browser_downloads ──────────────────────────────────────────────────────
  if (type === "browser_downloads") {
    const files = normalizeDownloads(result?.files ?? result?.downloads ?? result ?? [])

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">Downloads</span>
            <ToolStatusBadge variant="neutral">
              {files.length} file{files.length !== 1 ? "s" : ""}
            </ToolStatusBadge>
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {files.length === 0 ? (
          <EmptyState>No downloads</EmptyState>
        ) : (
          <div className="max-h-[30vh] divide-y overflow-auto">
            {files.map((f, i) => (
              <div key={i} className="hover:bg-surface-4 flex items-center gap-2.5 px-3 py-1.5">
                <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
                  {f.filename}
                </span>
                {f.mimeType && (
                  <span className="text-muted-foreground border-border bg-surface-4 shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px]">
                    {f.mimeType}
                  </span>
                )}
                {f.size != null && (
                  <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                    {formatBytes(f.size)}
                  </span>
                )}
                {f.path && <span className="rk-path-chip max-w-40 min-w-0 truncate">{f.path}</span>}
              </div>
            ))}
          </div>
        )}
      </ToolRendererShell>
    )
  }

  // ── browser_form_schema ────────────────────────────────────────────────────
  if (type === "browser_form_schema") {
    const fields = normalizeFormFields(result?.fields ?? result?.schema ?? result ?? [])
    const formUrl = (result?.url ?? input?.url ?? "") as string
    const required = fields.filter((f) => f.required).length

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">Form Schema</span>
            {formUrl && <span className="rk-path-chip max-w-40 min-w-0 truncate">{formUrl}</span>}
            <ToolStatusBadge variant="neutral">
              {fields.length} field{fields.length !== 1 ? "s" : ""}
            </ToolStatusBadge>
            {required > 0 && (
              <span className="text-muted-foreground font-mono text-[10px]">
                {required} required
              </span>
            )}
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {fields.length === 0 ? (
          <EmptyState>No form fields</EmptyState>
        ) : (
          <div className="max-h-[35vh] divide-y overflow-auto">
            {fields.map((f, i) => (
              <div key={i} className="hover:bg-surface-4 flex items-center gap-2.5 px-3 py-1.5">
                <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
                  {f.label ?? f.name}
                </span>
                <span className="text-muted-foreground border-border bg-surface-4 shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px]">
                  {f.type}
                </span>
                {f.required && (
                  <span className="border-destructive/25 bg-destructive/10 text-destructive shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] font-medium">
                    required
                  </span>
                )}
                {f.options && f.options.length > 0 && (
                  <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                    {f.options.length} options
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </ToolRendererShell>
    )
  }

  // ── screenshot (selector / full-page, default) ────────────────────────────
  const screenshot = (result?.screenshot ?? result?.image ?? result?.data ?? "") as string
  const url = (result?.url ?? input?.url ?? "") as string
  const selector = (input?.selector ?? result?.selector ?? "") as string
  const title =
    type === "browser_full_page_screenshot"
      ? "Full Page Screenshot"
      : type === "browser_selector_screenshot"
        ? "Selector Screenshot"
        : "Screenshot"

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">{title}</span>
          {selector && (
            <span className="rk-path-chip max-w-40 min-w-0 truncate font-mono text-[10px]">
              {selector}
            </span>
          )}
          {url && (
            <span className="text-muted-foreground max-w-40 min-w-0 truncate font-mono text-[10px]">
              {url}
            </span>
          )}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {!screenshot ? (
        <EmptyState>No screenshot</EmptyState>
      ) : (
        <BrowserShell>
          <Image
            src={
              screenshot.startsWith("data:") ? screenshot : `data:image/png;base64,${screenshot}`
            }
            alt={title}
            className="h-auto w-full object-contain"
          />
        </BrowserShell>
      )}
    </ToolRendererShell>
  )
}
