"use client"

import { useMemo, useState } from "react"

import {
  EmptyState,
  RawPayloadDisclosure,
  RendererTab,
  RendererTabBar,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { getBoolean, getResult, getString, pickArray, stableKey } from "./renderer-utils"
import { type ToolResultContentPart } from "./tool-result-renderer"

type TestGapRow = {
  source: string
  testFile: string
  suggested: string
  covered: boolean
}

export function TestGapRenderer({ part }: { part: ToolResultContentPart }) {
  const result = getResult(part)
  const [tab, setTab] = useState<"missing" | "covered" | "all">("missing")
  const rows = useMemo<TestGapRow[]>(
    () =>
      pickArray(result, ["files", "sources", "results", "items"]).map((item) => ({
        source: getString(item.source ?? item.file ?? item.path),
        testFile: getString(item.testFile ?? item.test ?? item.existingTest),
        suggested: getString(item.suggestedTestFile ?? item.suggested ?? item.recommendation),
        covered: getBoolean(item.hasTest ?? item.covered ?? item.tested, false),
      })),
    [result]
  )
  const covered = rows.filter((row) => row.covered)
  const missing = rows.filter((row) => !row.covered)
  const visible = tab === "missing" ? missing : tab === "covered" ? covered : rows

  return (
    <ToolRendererShell
      className="border-tool-code/25"
      header={
        <>
          <span className="text-foreground min-w-0 flex-1 truncate font-mono text-[11px] font-semibold">
            test_gap_analysis
          </span>
          <ToolStatusBadge variant="neutral">{rows.length} source files</ToolStatusBadge>
          <ToolStatusBadge variant="success">{covered.length} covered</ToolStatusBadge>
          <ToolStatusBadge variant={missing.length ? "warning" : "success"}>
            {missing.length} missing
          </ToolStatusBadge>
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      <RendererTabBar>
        <RendererTab active={tab === "missing"} onClick={() => setTab("missing")}>
          Missing
        </RendererTab>
        <RendererTab active={tab === "covered"} onClick={() => setTab("covered")}>
          Covered
        </RendererTab>
        <RendererTab active={tab === "all"} onClick={() => setTab("all")}>
          All
        </RendererTab>
      </RendererTabBar>
      {visible.length === 0 ? (
        <EmptyState>No files in this view</EmptyState>
      ) : (
        <div className="max-h-[44vh] divide-y overflow-auto">
          {visible.map((row) => (
            <div key={stableKey(row.source, row.testFile)} className="px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <ToolStatusBadge variant={row.covered ? "success" : "error"}>
                  {row.covered ? "TESTED" : "NO TEST"}
                </ToolStatusBadge>
                <span className="rk-path-chip min-w-0 flex-1 truncate">
                  {row.source || "unknown source"}
                </span>
              </div>
              <div className="text-muted-foreground mt-1 font-mono text-[10px]">
                {row.covered
                  ? row.testFile || "covered"
                  : `Suggested: ${row.suggested || "not provided"}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </ToolRendererShell>
  )
}
