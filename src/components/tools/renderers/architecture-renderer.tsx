"use client"

import { useState } from "react"

import {
  EmptyState,
  RawPayloadDisclosure,
  RendererTab,
  RendererTabBar,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import {
  getNumber,
  getResult,
  getString,
  pickArray,
  pickStringArray,
  stableKey,
} from "./renderer-utils"
import { type ToolResultContentPart } from "./tool-result-renderer"

export function ArchitectureRenderer({ part }: { part: ToolResultContentPart }) {
  const result = getResult(part)
  const [tab, setTab] = useState<"domains" | "coupling" | "hotspots" | "raw">("domains")
  const domains = pickArray(result, ["domains", "majorDomains", "features", "items"])
  const coupling = pickArray(result, ["coupling", "imports", "mostImported", "cycles"])
  const hotspots = pickArray(result, ["hotspots", "files", "results", "items"])
  const cycles = pickArray(result, ["cycles", "circularDependencies"])
  const fileCount = getNumber(
    result.fileCount ?? result.files,
    domains.reduce((n, d) => n + getNumber(d.fileCount), 0)
  )

  return (
    <ToolRendererShell
      className="border-tool-code/25"
      header={
        <>
          <span className="text-foreground min-w-0 flex-1 truncate font-mono text-[11px] font-semibold">
            {getString(part.toolName ?? part.type, "architecture")}
          </span>
          <ToolStatusBadge variant="neutral">{domains.length} domains</ToolStatusBadge>
          <ToolStatusBadge variant="neutral">{fileCount} files</ToolStatusBadge>
          {cycles.length ? (
            <ToolStatusBadge variant="warning">{cycles.length} cycles</ToolStatusBadge>
          ) : null}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      <RendererTabBar>
        <RendererTab active={tab === "domains"} onClick={() => setTab("domains")}>
          Domains
        </RendererTab>
        <RendererTab active={tab === "coupling"} onClick={() => setTab("coupling")}>
          Coupling
        </RendererTab>
        <RendererTab active={tab === "hotspots"} onClick={() => setTab("hotspots")}>
          Hotspots
        </RendererTab>
        <RendererTab active={tab === "raw"} onClick={() => setTab("raw")}>
          Raw
        </RendererTab>
      </RendererTabBar>
      {tab === "domains" ? (
        <div className="max-h-[44vh] divide-y overflow-auto">
          {domains.length === 0 ? (
            <EmptyState>No domains returned</EmptyState>
          ) : (
            domains.map((domain, index) => {
              const files = pickStringArray(domain, ["files", "paths"])
              return (
                <div key={stableKey(index, domain.name)} className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground/85 font-mono text-[11px] font-semibold">
                      {getString(domain.name ?? domain.domain ?? domain.feature, "domain")}
                    </span>
                    <ToolStatusBadge variant="neutral">
                      {getNumber(domain.fileCount, files.length)} files
                    </ToolStatusBadge>
                  </div>
                  {getString(domain.entry ?? domain.entrypoint) ? (
                    <div className="rk-path-chip mt-1 inline-flex">
                      {getString(domain.entry ?? domain.entrypoint)}
                    </div>
                  ) : null}
                  {files.length ? (
                    <div className="text-muted-foreground mt-1 font-mono text-[10px]">
                      {files.slice(0, 4).join(" · ")}
                    </div>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      ) : tab === "coupling" ? (
        <div className="max-h-[44vh] divide-y overflow-auto">
          {[...coupling, ...cycles].length === 0 ? (
            <EmptyState>No coupling data returned</EmptyState>
          ) : (
            [...coupling, ...cycles].map((item, index) => (
              <div key={stableKey(index, item.file)} className="px-3 py-2 font-mono text-[11px]">
                <div className="text-foreground/85">
                  {getString(item.file ?? item.path ?? item.name ?? item.from, "dependency")}
                </div>
                <div className="text-muted-foreground mt-1 text-[10px]">
                  {getString(item.reason ?? item.detail ?? item.to ?? item.message)}
                </div>
              </div>
            ))
          )}
        </div>
      ) : tab === "hotspots" ? (
        <div className="max-h-[44vh] divide-y overflow-auto">
          {hotspots.length === 0 ? (
            <EmptyState>No hotspots returned</EmptyState>
          ) : (
            hotspots.map((item, index) => (
              <div
                key={stableKey(index, item.path)}
                className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="rk-path-chip max-w-full truncate">
                    {getString(item.path ?? item.file ?? item.name)}
                  </div>
                  <div className="text-muted-foreground mt-1 font-mono text-[10px]">
                    {pickStringArray(item, ["reasons", "signals"]).join(" · ") ||
                      getString(item.reason)}
                  </div>
                </div>
                <ToolStatusBadge variant={getNumber(item.score) > 70 ? "warning" : "neutral"}>
                  {getNumber(item.score)} score
                </ToolStatusBadge>
              </div>
            ))
          )}
        </div>
      ) : (
        <RawPayloadDisclosure payload={result} defaultOpen />
      )}
    </ToolRendererShell>
  )
}
