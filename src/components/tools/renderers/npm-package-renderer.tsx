"use client"

import { ArrowDownTray, ArrowTopRightOnSquare, NpmLogoIcon } from "@/lib/icons"

import { type ToolResultContentPart } from "./tool-result-renderer"

function formatDownloads(n?: number): string {
  if (!n) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function NpmPackageRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as
    | {
        name?: string
        latest?: string
        license?: string
        description?: string
        homepage?: string
        downloadsLastWeek?: number
        repository?: string | { type?: string; url?: string }
      }
    | undefined

  const name = result?.name ?? (part.toolInput as { name?: string } | undefined)?.name ?? "package"
  const latest = result?.latest
  const license = result?.license
  const description = result?.description
  const homepage = result?.homepage
  const downloads = result?.downloadsLastWeek
  const rawRepo = result?.repository
  // repository can be a string or { type, url }
  const repo: string | undefined =
    typeof rawRepo === "string"
      ? rawRepo
      : typeof rawRepo === "object" && rawRepo !== null
        ? ((rawRepo as { url?: string }).url?.replace(/^git\+/, "").replace(/\.git$/, "") ??
          undefined)
        : undefined

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg">
      {/* Header */}
      <div className="bg-muted/20 flex items-center gap-2 border-b px-3 py-2">
        {/* npm badge */}
        <NpmLogoIcon height={36} width={36} />
        <span className="text-foreground min-w-0 flex-1 truncate font-mono text-sm font-semibold">
          {name}
        </span>
        {latest && (
          <span className="shrink-0 rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-emerald-600">
            v{latest}
          </span>
        )}
      </div>

      {/* Description */}
      {description && (
        <div className="border-b px-3 py-2.5">
          <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
        </div>
      )}

      {/* Stats */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b px-3 py-2">
        {license && (
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
              License
            </span>
            <span className="bg-muted rounded px-1.5 py-0.5 text-[10px] font-medium">
              {license}
            </span>
          </div>
        )}
        {downloads !== undefined && (
          <div className="flex items-center gap-1.5">
            <ArrowDownTray className="text-muted-foreground/60 h-3 w-3" />
            <span className="text-foreground/70 text-[11px]">
              {formatDownloads(downloads)}/week
            </span>
          </div>
        )}
      </div>

      {/* Links */}
      <div className="flex flex-wrap items-center gap-3 px-3 py-2">
        {homepage && (
          <a
            href={homepage}
            target="_blank"
            rel="noreferrer"
            className="text-tool-browser inline-flex items-center gap-1 text-[11px] hover:underline"
          >
            Homepage
            <ArrowTopRightOnSquare className="h-3 w-3" />
          </a>
        )}
        {repo && (
          <a
            href={repo.startsWith("http") ? repo : `https://github.com/${repo}`}
            target="_blank"
            rel="noreferrer"
            className="text-tool-browser inline-flex items-center gap-1 text-[11px] hover:underline"
          >
            Repository
            <ArrowTopRightOnSquare className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  )
}
