"use client"

import { useState } from "react"

import { BrowserShell } from "./browser-shell"
import {
  EmptyState,
  RawPayloadDisclosure,
  RendererTab,
  RendererTabBar,
  ToolRendererShell,
  ToolStatusBadge,
  toScreenshotSrc,
} from "./renderer-primitives"
import { getArray, getNumber, getResult, getString, pickArray, stableKey } from "./renderer-utils"
import { type ToolResultContentPart } from "./tool-result-renderer"

function ScreenshotImage({ src, alt }: { src: string; alt: string }) {
  if (!src) return <EmptyState>No screenshot image returned</EmptyState>
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={toScreenshotSrc(src)}
      alt={alt}
      className="bg-surface-4 max-h-[56vh] w-full object-contain"
    />
  )
}

export function ScreenshotCompareRenderer({ part }: { part: ToolResultContentPart }) {
  const result = getResult(part)
  const [tab, setTab] = useState<"before" | "after" | "diff" | "matrix">(
    part.type === "responsive_screenshot_matrix" ? "matrix" : "before"
  )
  const screenshots = pickArray(result, ["screenshots", "viewports", "items"])
  const before = getString(result.before ?? result.beforeScreenshot ?? result.baseline)
  const after = getString(
    result.after ?? result.afterScreenshot ?? result.current ?? result.screenshot
  )
  const diff = getString(result.diff ?? result.diffScreenshot ?? result.image)
  const mismatch = getNumber(result.mismatchPercent ?? result.mismatch ?? result.diffPercent)
  const url = getString(result.url)

  return (
    <ToolRendererShell
      className="border-tool-browser/25"
      header={
        <>
          <span className="text-foreground min-w-0 flex-1 truncate font-mono text-[11px] font-semibold">
            {getString(part.toolName ?? part.type, "screenshot_compare")}
          </span>
          {url ? (
            <span className="text-muted-foreground min-w-0 truncate font-mono text-[10px]">
              {url}
            </span>
          ) : null}
          {mismatch ? (
            <ToolStatusBadge variant="warning">{mismatch}% mismatch</ToolStatusBadge>
          ) : null}
          {screenshots.length ? (
            <ToolStatusBadge variant="neutral">{screenshots.length} viewports</ToolStatusBadge>
          ) : null}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      <RendererTabBar>
        {part.type === "responsive_screenshot_matrix" ? (
          <RendererTab active={tab === "matrix"} onClick={() => setTab("matrix")}>
            Matrix
          </RendererTab>
        ) : (
          <>
            <RendererTab active={tab === "before"} onClick={() => setTab("before")}>
              Before
            </RendererTab>
            <RendererTab active={tab === "after"} onClick={() => setTab("after")}>
              After
            </RendererTab>
            <RendererTab active={tab === "diff"} onClick={() => setTab("diff")}>
              Diff
            </RendererTab>
          </>
        )}
      </RendererTabBar>
      <BrowserShell url={url} className="rounded-none border-0">
        {tab === "matrix" ? (
          screenshots.length === 0 ? (
            <EmptyState>No responsive screenshots returned</EmptyState>
          ) : (
            <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
              {screenshots.map((item, index) => {
                const src = getString(item.screenshot ?? item.image ?? item.src)
                return (
                  <div
                    key={stableKey(index, item.label)}
                    className="bg-surface-4 overflow-hidden rounded border"
                  >
                    <div className="text-muted-foreground border-b px-2 py-1 font-mono text-[10px]">
                      {getString(item.label ?? item.viewport ?? item.name, `viewport ${index + 1}`)}
                    </div>
                    <ScreenshotImage src={src} alt="Responsive screenshot" />
                  </div>
                )
              })}
            </div>
          )
        ) : tab === "before" ? (
          <ScreenshotImage src={before} alt="Before screenshot" />
        ) : tab === "after" ? (
          <ScreenshotImage src={after || getString(result.screenshot)} alt="After screenshot" />
        ) : (
          <div>
            <ScreenshotImage src={diff} alt="Diff screenshot" />
            {getArray(result.regions).length ? (
              <div className="divide-y border-t">
                {getArray(result.regions).map((region, index) => (
                  <div
                    key={index}
                    className="text-muted-foreground px-3 py-1.5 font-mono text-[10px]"
                  >
                    region {index + 1}: x {getNumber(region.x)}, y {getNumber(region.y)}, w{" "}
                    {getNumber(region.width)}, h {getNumber(region.height)}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </BrowserShell>
    </ToolRendererShell>
  )
}
