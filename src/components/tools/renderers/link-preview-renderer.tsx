"use client"

import { Image } from "@/components/ui/image"
import { ArrowTopRightOnSquare, Globe } from "@/lib/icons"

import { type ToolResultContentPart } from "./tool-result-renderer"

export function LinkPreviewRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as
    | {
        url?: string
        title?: string
        description?: string
        image?: string
        error?: string
      }
    | undefined

  const url = result?.url ?? (part.toolInput as { url?: string } | undefined)?.url ?? ""
  const title = result?.title
  const description = result?.description
  const image = result?.image
  const error = result?.error

  let domain = ""
  try {
    domain = new URL(url).hostname.replace(/^www\./, "")
  } catch {
    /* ignore */
  }

  if (error) {
    return (
      <div className="w-full min-w-0 overflow-hidden rounded-lg">
        <div className="bg-muted/20 flex items-center gap-2 border-b px-3 py-2">
          <Globe className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
          <span className="text-foreground/70 min-w-0 truncate font-mono text-[11px]">{url}</span>
        </div>
        <div className="text-destructive px-3 py-3 text-xs">{error}</div>
      </div>
    )
  }

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg border">
      <div className="flex min-h-20 items-stretch">
        {/* Thumbnail */}
        {image && (
          <div className="relative h-auto w-28 shrink-0 overflow-hidden rounded-l">
            <Image src={image} alt={title ?? ""} fill className="object-cover" unoptimized />
          </div>
        )}

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5 p-3">
          <div className="min-w-0 space-y-1">
            {domain && (
              <div className="flex items-center gap-1.5">
                <Globe className="text-muted-foreground/60 h-3 w-3 shrink-0" />
                <span className="text-muted-foreground text-[10px]">{domain}</span>
              </div>
            )}
            {title && (
              <p className="text-foreground line-clamp-2 text-sm leading-snug font-semibold">
                {title}
              </p>
            )}
            {description && (
              <p className="text-muted-foreground line-clamp-2 text-[11px] leading-relaxed">
                {description}
              </p>
            )}
          </div>

          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-tool-browser hover:text-tool-browser/80 inline-flex items-center gap-1 text-[10px] font-medium transition-colors"
            >
              Open
              <ArrowTopRightOnSquare className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
