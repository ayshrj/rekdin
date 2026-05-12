"use client"

import { useState } from "react"

import { FileExtensionIcon } from "@/components/file-extension-icon"
import { ChevronDown, ChevronRight } from "@/lib/icons"

import {
  CopyButton,
  EmptyState,
  InlineToolResult,
  RawPayloadDisclosure,
  ToolRendererShell,
  ToolStatusBadge,
  useToolInvoke,
} from "./renderer-primitives"
import { SimpleCodeEditor } from "./simple-code-editor"
import { type ToolResultContentPart } from "./tool-result-renderer"

type FileReadResult = { path?: string; content?: string; truncated?: boolean }

interface OutlineSymbol {
  name: string
  kind: string
  line?: number
  endLine?: number
  children?: OutlineSymbol[]
}

const KIND_COLORS: Record<string, string> = {
  class: "text-purple-500",
  interface: "text-purple-400",
  type: "text-purple-300",
  enum: "text-orange-500",
  function: "text-blue-500",
  method: "text-blue-400",
  property: "text-amber-500",
  variable: "text-emerald-500",
  const: "text-emerald-500",
  constructor: "text-blue-300",
  module: "text-foreground/60",
  namespace: "text-foreground/60",
}

const KIND_LABELS: Record<string, string> = {
  class: "cls",
  interface: "iface",
  type: "type",
  enum: "enum",
  function: "fn",
  method: "fn",
  property: "prop",
  variable: "var",
  const: "const",
  constructor: "ctor",
  module: "mod",
  namespace: "ns",
}

function kindColor(kind: string) {
  return KIND_COLORS[kind.toLowerCase()] ?? "text-muted-foreground"
}

function kindLabel(kind: string) {
  return KIND_LABELS[kind.toLowerCase()] ?? kind.slice(0, 4)
}

function normalizeSymbols(raw: unknown): OutlineSymbol[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
    .map((r) => ({
      name: String(r.name ?? r.text ?? "?"),
      kind: String(r.kind ?? r.type ?? "symbol"),
      line:
        typeof r.line === "number"
          ? r.line
          : typeof r.lineNumber === "number"
            ? r.lineNumber
            : undefined,
      endLine: typeof r.endLine === "number" ? r.endLine : undefined,
      children: Array.isArray(r.children) ? normalizeSymbols(r.children) : undefined,
    }))
}

function countAll(symbols: OutlineSymbol[]): number {
  return symbols.reduce((n, s) => n + 1 + countAll(s.children ?? []), 0)
}

function SymbolRow({
  symbol,
  depth,
  onSymbolClick,
  activeLine,
}: {
  symbol: OutlineSymbol
  depth: number
  onSymbolClick?: (line: number) => void
  activeLine?: number | null
}) {
  const [open, setOpen] = useState(true)
  const hasChildren = (symbol.children?.length ?? 0) > 0
  const color = kindColor(symbol.kind)
  const label = kindLabel(symbol.kind)
  const isActive = symbol.line != null && symbol.line === activeLine

  return (
    <>
      <div
        className={`flex items-center gap-1.5 py-0.75 transition-colors ${
          isActive ? "bg-primary/10" : "hover:bg-surface-4"
        } ${symbol.line != null ? "cursor-pointer" : ""}`}
        style={{ paddingLeft: `${12 + depth * 16}px`, paddingRight: "12px" }}
        onClick={() => symbol.line != null && onSymbolClick?.(symbol.line)}
      >
        <span className="text-muted-foreground/50 w-3 shrink-0">
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setOpen((v) => !v)
              }}
              className="flex items-center"
            >
              {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          ) : null}
        </span>
        <span
          className={`w-9 shrink-0 rounded px-1 py-px font-mono text-[9px] font-medium tracking-wide uppercase ${color} bg-current/10`}
          style={{ backgroundColor: "transparent" }}
        >
          <span className={color}>{label}</span>
        </span>
        <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
          {symbol.name}
        </span>
        {symbol.line != null && (
          <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
            :{symbol.line}
          </span>
        )}
      </div>
      {open &&
        hasChildren &&
        symbol.children?.map((child, i) => (
          <SymbolRow
            key={i}
            symbol={child}
            depth={depth + 1}
            onSymbolClick={onSymbolClick}
            activeLine={activeLine}
          />
        ))}
    </>
  )
}

export function FileOutlineRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined
  const inputPath =
    (part.toolInput as { path?: string } | undefined)?.path ??
    (result?.path as string | undefined) ??
    ""

  const path = (result?.path ?? inputPath) as string
  const rawSymbols = result?.symbols ?? result?.outline ?? result?.items ?? result
  const symbols = normalizeSymbols(Array.isArray(rawSymbols) ? rawSymbols : [])
  const total = countAll(symbols)

  const {
    loading,
    result: fileResult,
    error: fileError,
    invoke,
    reset,
  } = useToolInvoke<FileReadResult>("file_read")
  const [activeLine, setActiveLine] = useState<number | null>(null)

  const handleSymbolClick = async (line: number) => {
    if (activeLine === line) {
      reset()
      setActiveLine(null)
      return
    }
    setActiveLine(line)
    if (!fileResult) await invoke({ path })
  }

  const fileContent = fileResult?.content ?? ""
  const ext = path.split(".").pop()?.toLowerCase() ?? ""
  const fileName = path.split("/").pop() ?? path

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">File Outline</span>
          {path && (
            <>
              <FileExtensionIcon extensionName={path} className="h-3.5 w-3.5 shrink-0" />
              <span className="rk-path-chip max-w-60 min-w-0 truncate">{path}</span>
            </>
          )}
          <ToolStatusBadge variant="neutral">
            {total} symbol{total !== 1 ? "s" : ""}
          </ToolStatusBadge>
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {symbols.length === 0 ? (
        <EmptyState>No symbols found</EmptyState>
      ) : (
        <div className="rk-scrollbar max-h-[50vh] overflow-auto py-1">
          {symbols.map((s, i) => (
            <SymbolRow
              key={i}
              symbol={s}
              depth={0}
              onSymbolClick={handleSymbolClick}
              activeLine={activeLine}
            />
          ))}
        </div>
      )}

      {(activeLine != null || loading) && (
        <InlineToolResult
          title={loading && !fileContent ? `Loading ${path}…` : `${path} :${activeLine}`}
          onDismiss={() => {
            reset()
            setActiveLine(null)
          }}
          error={fileError}
        >
          {fileContent && (
            <div>
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="text-muted-foreground font-mono text-[10px]">
                  {fileContent.split("\n").length} lines · jump to :{activeLine}
                </span>
                <CopyButton text={fileContent} />
              </div>
              <SimpleCodeEditor
                code={fileContent}
                language={ext}
                fileName={fileName}
                showHeader={false}
                maxHeight="40vh"
                fontSize={12}
                readOnly
              />
            </div>
          )}
        </InlineToolResult>
      )}
    </ToolRendererShell>
  )
}
