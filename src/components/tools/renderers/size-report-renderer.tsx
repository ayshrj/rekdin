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
  formatBytes,
  getNumber,
  getResult,
  getString,
  pickArray,
  stableKey,
} from "./renderer-utils"
import { type ToolResultContentPart } from "./tool-result-renderer"

export function SizeReportRenderer({ part }: { part: ToolResultContentPart }) {
  const result = getResult(part)
  const [tab, setTab] = useState<"items" | "raw">("items")
  const items = pickArray(result, ["items", "packages", "chunks", "assets", "hotspots", "results"])
  const total = getNumber(result.totalBytes ?? result.totalSize ?? result.total)
  const max = Math.max(...items.map((item) => getNumber(item.bytes ?? item.size ?? item.score)), 1)

  return (
    <ToolRendererShell
      className="border-tool-data/25"
      header={
        <>
          <span className="text-foreground min-w-0 flex-1 truncate font-mono text-[11px] font-semibold">
            {getString(part.toolName ?? part.type, "size_report")}
          </span>
          {total ? (
            <ToolStatusBadge variant="neutral">total: {formatBytes(total)}</ToolStatusBadge>
          ) : null}
          <ToolStatusBadge variant="neutral">{items.length} items</ToolStatusBadge>
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      <RendererTabBar>
        <RendererTab active={tab === "items"} onClick={() => setTab("items")}>
          Ranked
        </RendererTab>
        <RendererTab active={tab === "raw"} onClick={() => setTab("raw")}>
          Raw
        </RendererTab>
      </RendererTabBar>
      {tab === "items" ? (
        items.length === 0 ? (
          <EmptyState>No size rows returned</EmptyState>
        ) : (
          <div className="max-h-[44vh] divide-y overflow-auto">
            {items.slice(0, 50).map((item, index) => {
              const value = getNumber(item.bytes ?? item.size ?? item.score)
              const width = Math.max(4, Math.min(100, (value / max) * 100))
              return (
                <div
                  key={stableKey(index, item.name)}
                  className="grid grid-cols-[1fr_auto_7rem] items-center gap-3 px-3 py-1.5 font-mono text-[11px]"
                >
                  <div className="min-w-0">
                    <div className="text-foreground/85 truncate">
                      {getString(item.name ?? item.path ?? item.package ?? item.file)}
                    </div>
                    <div className="text-muted-foreground truncate text-[10px]">
                      {getString(item.importedBy ?? item.reason ?? item.description)}
                    </div>
                  </div>
                  <span className="text-muted-foreground">
                    {item.bytes || item.size ? formatBytes(value) : value}
                  </span>
                  <div className="bg-surface-4 h-1.5 overflow-hidden rounded">
                    <div className="bg-tool-data h-full rounded" style={{ width: `${width}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : (
        <RawPayloadDisclosure payload={result} defaultOpen />
      )}
    </ToolRendererShell>
  )
}
