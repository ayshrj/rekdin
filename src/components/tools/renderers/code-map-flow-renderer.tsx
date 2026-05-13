"use client"

import { useMemo, useState } from "react"

import {
  EmptyState,
  RawPayloadDisclosure,
  RendererTab,
  RendererTabBar,
  SegmentedControl,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import {
  getArray,
  getNumber,
  getResult,
  getString,
  pickArray,
  pickStringArray,
  stableKey,
} from "./renderer-utils"
import { type ToolResultContentPart } from "./tool-result-renderer"

type NodeEntry = {
  name: string
  file: string
  props: string[]
  usedBy: string[]
  children: NodeEntry[]
}

function normalizeNode(item: Record<string, unknown>): NodeEntry {
  return {
    name: getString(
      item.name ?? item.component ?? item.hook ?? item.endpoint ?? item.route ?? item.symbol,
      "unnamed"
    ),
    file: getString(item.file ?? item.path ?? item.source ?? item.backendHandler),
    props: pickStringArray(item, ["props", "params", "requestShape", "methods"]),
    usedBy: pickStringArray(item, ["usedBy", "callers", "consumers", "calledFrom"]),
    children: getArray(item.children).map(normalizeNode),
  }
}

function flatten(nodes: NodeEntry[]): NodeEntry[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)])
}

function TraceRows({ rows }: { rows: Record<string, unknown>[] }) {
  if (rows.length === 0) return <EmptyState>No trace steps returned</EmptyState>
  return (
    <ol className="divide-y">
      {rows.map((row, index) => {
        const file = getString(row.file ?? row.path ?? row.source)
        const line = getNumber(row.line)
        return (
          <li key={stableKey(index, file, row.action)} className="px-3 py-2">
            <div className="flex items-start gap-2">
              <span className="bg-surface-4 text-muted-foreground inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border font-mono text-[10px]">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-foreground/85 font-mono text-[11px]">
                  {getString(row.action ?? row.type ?? row.kind, "step")}
                </div>
                {file ? (
                  <div className="rk-path-chip mt-1 inline-flex max-w-full truncate">
                    {file}
                    {line ? `:${line}` : ""}
                  </div>
                ) : null}
                <div className="text-muted-foreground mt-1 text-[10px] leading-relaxed break-words">
                  {getString(row.detail ?? row.message ?? row.description ?? row.value)}
                </div>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// Width of each guide/connector column in px. Fixed so vertical lines align across rows.
const TREE_COL = 14

function GuideCol({ active }: { active: boolean }) {
  return (
    <div className="relative shrink-0" style={{ width: TREE_COL }}>
      {active && (
        <div
          className="bg-border/50 absolute inset-y-0"
          style={{ width: 1, left: "50%", transform: "translateX(-0.5px)" }}
        />
      )}
    </div>
  )
}

function ConnectorCol({ isLast }: { isLast: boolean }) {
  return (
    <div className="relative shrink-0" style={{ width: TREE_COL }}>
      {/* Vertical segment: full height for ├, top-half only for └ */}
      <div
        className="bg-border/55 absolute"
        style={{
          width: 1,
          left: "50%",
          top: 0,
          bottom: isLast ? "50%" : 0,
          transform: "translateX(-0.5px)",
        }}
      />
      {/* Horizontal branch from center to right edge */}
      <div
        className="bg-border/55 absolute"
        style={{ height: 1, top: "50%", left: "50%", right: 0, transform: "translateY(-0.5px)" }}
      />
    </div>
  )
}

function TreeRows({
  nodes,
  depth,
  level = 0,
  guides = [] as boolean[],
}: {
  nodes: NodeEntry[]
  depth: number
  level?: number
  guides?: boolean[]
}) {
  if (nodes.length === 0 && level === 0) return <EmptyState>No nodes returned</EmptyState>
  if (level >= depth) return null

  return (
    <>
      {nodes.map((node, index) => {
        const isLast = index === nodes.length - 1
        const hasChildren = node.children.length > 0 && level + 1 < depth
        const shortFile = node.file ? node.file.split("/").slice(-2).join("/") : ""

        return (
          <div key={stableKey(level, node.name, node.file)}>
            <div className="hover:bg-surface-4/60 flex min-w-0 items-stretch px-3 transition-colors">
              {guides.map((active, i) => (
                <GuideCol key={i} active={active} />
              ))}
              <ConnectorCol isLast={isLast} />
              <div className="min-w-0 flex-1 py-1.25 pl-1.5">
                <div className="flex min-w-0 items-baseline gap-2">
                  <span
                    className={`min-w-0 truncate font-mono text-[11px] leading-5 font-medium ${
                      level === 0 ? "text-foreground" : "text-foreground/80"
                    }`}
                  >
                    {node.name}
                  </span>
                  {shortFile ? (
                    <span className="rk-path-chip max-w-48 shrink-0 truncate">{shortFile}</span>
                  ) : null}
                  {hasChildren ? (
                    <span className="text-muted-foreground/40 ml-auto shrink-0 font-mono text-[10px]">
                      {node.children.length}
                    </span>
                  ) : null}
                </div>
                {node.props.length > 0 || node.usedBy.length > 0 ? (
                  <div className="mt-0.5 flex min-w-0 items-center gap-2">
                    {node.props.length > 0 ? (
                      <span className="text-muted-foreground/70 min-w-0 truncate font-mono text-[10px]">
                        {node.props.slice(0, 5).join(" · ")}
                      </span>
                    ) : null}
                    {node.usedBy.length > 0 ? (
                      <span className="text-muted-foreground/50 shrink-0 font-mono text-[10px]">
                        ↑ {node.usedBy.slice(0, 3).join(", ")}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
            {hasChildren && (
              <TreeRows
                nodes={node.children}
                depth={depth}
                level={level + 1}
                guides={[...guides, !isLast]}
              />
            )}
          </div>
        )
      })}
    </>
  )
}

export function CodeMapFlowRenderer({ part }: { part: ToolResultContentPart }) {
  const result = getResult(part)
  const [tab, setTab] = useState<"tree" | "table" | "raw">("tree")
  const [depth, setDepth] = useState<"shallow" | "medium" | "full">("medium")
  const isFlow = [
    "state_flow_trace",
    "event_handler_trace",
    "type_dependency_trace",
    "prop_drilling_trace",
  ].includes(part.type)
  const nodes = useMemo(() => {
    const raw = pickArray(result, [
      "nodes",
      "components",
      "hooks",
      "routes",
      "endpoints",
      "items",
      "results",
    ])
    if (raw.length) return raw.map(normalizeNode)
    return result.name || result.component || result.symbol ? [normalizeNode(result)] : []
  }, [result])
  const rows = pickArray(result, ["steps", "trace", "flow", "events", "items", "results"])
  const flat = flatten(nodes)
  const depthCount = depth === "shallow" ? 1 : depth === "medium" ? 3 : 99
  const files = new Set(flat.map((node) => node.file).filter(Boolean)).size

  return (
    <ToolRendererShell
      className="border-tool-code/25"
      header={
        <>
          <span className="text-foreground min-w-0 flex-1 truncate font-mono text-[11px] font-semibold">
            {getString(part.toolName ?? part.type, "code_map")}
          </span>
          <ToolStatusBadge variant="neutral">
            {isFlow ? rows.length : flat.length} nodes
          </ToolStatusBadge>
          <ToolStatusBadge variant="neutral">{files} files</ToolStatusBadge>
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      <div className="flex items-center justify-between gap-2 border-b">
        <RendererTabBar>
          <RendererTab active={tab === "tree"} onClick={() => setTab("tree")}>
            {isFlow ? "Trace" : "Tree"}
          </RendererTab>
          <RendererTab active={tab === "table"} onClick={() => setTab("table")}>
            Table
          </RendererTab>
          <RendererTab active={tab === "raw"} onClick={() => setTab("raw")}>
            Raw
          </RendererTab>
        </RendererTabBar>
        {!isFlow && tab === "tree" ? (
          <div className="pr-3">
            <SegmentedControl
              value={depth}
              onChange={setDepth}
              options={[
                { value: "shallow", label: "shallow" },
                { value: "medium", label: "medium" },
                { value: "full", label: "full" },
              ]}
            />
          </div>
        ) : null}
      </div>
      {tab === "tree" ? (
        <div className="max-h-[44vh] overflow-auto">
          {isFlow ? <TraceRows rows={rows} /> : <TreeRows nodes={nodes} depth={depthCount} />}
        </div>
      ) : tab === "table" ? (
        <div className="max-h-[44vh] divide-y overflow-auto">
          {flat.length === 0 ? (
            <EmptyState>No table rows returned</EmptyState>
          ) : (
            flat.map((node) => (
              <div
                key={stableKey(node.name, node.file)}
                className="grid grid-cols-[1fr_1fr_auto] gap-2 px-3 py-1.5 font-mono text-[11px]"
              >
                <span className="text-foreground/85 min-w-0 truncate">{node.name}</span>
                <span className="rk-path-chip min-w-0 truncate">{node.file || "unknown"}</span>
                <span className="text-muted-foreground">{node.usedBy.length} uses</span>
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
