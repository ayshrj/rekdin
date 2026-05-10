"use client"

import {
  CopyButton,
  EmptyState,
  RawPayloadDisclosure,
  ToolMetaRow,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

function num(v: unknown): string {
  if (v == null) return ""
  const n = Number(v)
  if (Number.isNaN(n)) return String(v)
  return n >= 1000 ? n.toLocaleString() : String(n)
}

// ── Main renderer ─────────────────────────────────────────────────────────────

export function DomainInfoRenderer({ part }: { part: ToolResultContentPart }) {
  const type = part.type
  const result = part.toolResult as Record<string, unknown> | undefined

  // ── github_repo_info ───────────────────────────────────────────────────────
  if (type === "github_repo_info") {
    const name = (result?.fullName ?? result?.full_name ?? result?.name ?? "") as string
    const description = (result?.description ?? "") as string
    const stars = result?.stars ?? result?.stargazersCount ?? result?.stargazers_count
    const forks = result?.forks ?? result?.forksCount ?? result?.forks_count
    const language = (result?.language ?? "") as string
    const openIssues = result?.openIssues ?? result?.open_issues_count ?? result?.issues
    const license = (result?.license ??
      result?.spdxId ??
      (result?.licenseInfo as Record<string, unknown>)?.spdxId ??
      "") as string
    const url = (result?.url ?? result?.htmlUrl ?? result?.html_url ?? "") as string
    const topics = Array.isArray(result?.topics) ? result.topics.map(String) : []
    const isPrivate = Boolean(result?.private)
    const archived = Boolean(result?.archived)

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">GitHub Repo</span>
            {name && <span className="rk-path-chip max-w-50 min-w-0 truncate">{name}</span>}
            {language && (
              <span className="text-muted-foreground border-border bg-surface-4 shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px]">
                {language}
              </span>
            )}
            {isPrivate && <ToolStatusBadge variant="warning">private</ToolStatusBadge>}
            {archived && <ToolStatusBadge variant="neutral">archived</ToolStatusBadge>}
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="rk-flat-button ml-auto font-mono text-[10px]"
              >
                Open
              </a>
            )}
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {description && (
          <div className="border-b px-3 py-2">
            <p className="text-foreground/70 font-mono text-[11px] leading-relaxed">
              {description}
            </p>
          </div>
        )}
        <div className="divide-y">
          {stars != null && (
            <ToolMetaRow label="stars" mono>
              {num(stars)}
            </ToolMetaRow>
          )}
          {forks != null && (
            <ToolMetaRow label="forks" mono>
              {num(forks)}
            </ToolMetaRow>
          )}
          {openIssues != null && (
            <ToolMetaRow label="open issues" mono>
              {num(openIssues)}
            </ToolMetaRow>
          )}
          {license && (
            <ToolMetaRow label="license" mono>
              {license}
            </ToolMetaRow>
          )}
        </div>
        {topics.length > 0 && (
          <div className="border-t px-3 py-2">
            <div className="flex flex-wrap gap-1">
              {topics.map((t, i) => (
                <span
                  key={i}
                  className="text-primary rounded border border-[color-mix(in_srgb,var(--primary)_20%,transparent)] bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] px-1.5 py-0.5 font-mono text-[9px]"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </ToolRendererShell>
    )
  }

  // ── citation_metadata ──────────────────────────────────────────────────────
  if (type === "citation_metadata") {
    const title = (result?.title ?? "") as string
    const authors = Array.isArray(result?.authors) ? result.authors.map(String) : []
    const doi = (result?.doi ?? result?.DOI ?? "") as string
    const year = result?.year ?? result?.publishedYear ?? result?.date
    const journal = (result?.journal ?? result?.venue ?? result?.publisher ?? "") as string
    const abstract = (result?.abstract ?? result?.summary ?? "") as string
    const url = (result?.url ?? result?.link ?? "") as string

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">Citation</span>
            {year != null && (
              <span className="text-muted-foreground border-border bg-surface-4 shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px]">
                {String(year)}
              </span>
            )}
            {doi && <CopyButton text={doi} className="ml-auto" />}
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {title && (
          <div className="border-b px-3 py-2">
            <p className="text-foreground/80 font-mono text-[11px] leading-snug font-semibold">
              {title}
            </p>
          </div>
        )}
        <div className="divide-y">
          {authors.length > 0 && (
            <ToolMetaRow label="authors" mono>
              {authors.join(", ")}
            </ToolMetaRow>
          )}
          {journal && (
            <ToolMetaRow label="journal" mono>
              {journal}
            </ToolMetaRow>
          )}
          {doi && (
            <ToolMetaRow label="doi" mono>
              {doi}
            </ToolMetaRow>
          )}
          {url && (
            <div className="flex items-center gap-2 px-3 py-1.5">
              <span className="rk-section-label w-24 shrink-0">url</span>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-primary min-w-0 flex-1 truncate font-mono text-[10px] hover:underline"
              >
                {url}
              </a>
            </div>
          )}
        </div>
        {abstract && (
          <div className="border-t px-3 py-2">
            <span className="rk-section-label mb-1.5 block">Abstract</span>
            <p className="text-foreground/70 font-mono text-[10px] leading-relaxed">{abstract}</p>
          </div>
        )}
      </ToolRendererShell>
    )
  }

  // ── package_compare ────────────────────────────────────────────────────────
  if (type === "package_compare") {
    const packages = Array.isArray(result?.packages)
      ? (result.packages as Record<string, unknown>[])
      : Array.isArray(result?.results)
        ? (result.results as Record<string, unknown>[])
        : []

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const cols = ["name", "version", "license", "downloads", "description"] as const

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">
              Package Compare
            </span>
            <ToolStatusBadge variant="neutral">
              {packages.length} package{packages.length !== 1 ? "s" : ""}
            </ToolStatusBadge>
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {packages.length === 0 ? (
          <EmptyState>No packages</EmptyState>
        ) : (
          <div className="rk-scrollbar max-h-[40vh] divide-y overflow-auto">
            {packages.map((p, i) => {
              const pkgVersion = p.version != null ? String(p.version) : ""
              const pkgLicense = p.license != null ? String(p.license) : ""
              const pkgDesc = p.description != null ? String(p.description) : ""
              return (
                <div key={i} className="hover:bg-surface-4 px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-foreground/80 font-mono text-[11px] font-semibold">
                      {String(p.name ?? "")}
                    </span>
                    {pkgVersion && (
                      <span className="text-muted-foreground font-mono text-[10px]">
                        {pkgVersion}
                      </span>
                    )}
                    {pkgLicense && (
                      <span className="text-muted-foreground border-border bg-surface-4 shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px]">
                        {pkgLicense}
                      </span>
                    )}
                    {p.downloads != null && (
                      <span className="text-muted-foreground ml-auto shrink-0 font-mono text-[10px]">
                        {num(p.downloads)}/wk
                      </span>
                    )}
                  </div>
                  {pkgDesc && (
                    <p className="text-muted-foreground mt-0.5 line-clamp-1 font-mono text-[10px]">
                      {pkgDesc}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </ToolRendererShell>
    )
  }

  // ── domain_info (default) ──────────────────────────────────────────────────
  const domain = (result?.domain ?? result?.host ?? result?.url ?? "") as string
  const registrar = (result?.registrar ?? "") as string
  const ips = Array.isArray(result?.ips)
    ? result.ips.map(String)
    : result?.ip
      ? [String(result.ip)]
      : []
  const nameservers = Array.isArray(result?.nameservers)
    ? result.nameservers.map(String)
    : result?.ns
      ? [String(result.ns)]
      : []
  const created = (result?.created ??
    result?.creationDate ??
    result?.registrationDate ??
    "") as string
  const expires = (result?.expires ?? result?.expirationDate ?? "") as string
  const status = (result?.status ?? result?.domainStatus ?? "") as string

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Domain Info</span>
          {domain && <span className="rk-path-chip max-w-50 min-w-0 truncate">{domain}</span>}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {!result ? (
        <EmptyState>No domain data</EmptyState>
      ) : (
        <div className="divide-y">
          {registrar && (
            <ToolMetaRow label="registrar" mono>
              {registrar}
            </ToolMetaRow>
          )}
          {ips.length > 0 && (
            <ToolMetaRow label="ip" mono>
              {ips.join(", ")}
            </ToolMetaRow>
          )}
          {nameservers.length > 0 && (
            <ToolMetaRow label="nameservers" mono>
              {nameservers.join(", ")}
            </ToolMetaRow>
          )}
          {created && (
            <ToolMetaRow label="created" mono>
              {created}
            </ToolMetaRow>
          )}
          {expires && (
            <ToolMetaRow label="expires" mono>
              {expires}
            </ToolMetaRow>
          )}
          {status && (
            <ToolMetaRow label="status" mono>
              {status}
            </ToolMetaRow>
          )}
        </div>
      )}
    </ToolRendererShell>
  )
}
