"use client"

import {
  CopyButton,
  EmptyState,
  RawPayloadDisclosure,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { SimpleCodeEditor } from "./simple-code-editor"
import { type ToolResultContentPart } from "./tool-result-renderer"

function sizeLabel(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return `${value.length}B`
  if (Array.isArray(value)) return `${value.length} item${value.length !== 1 ? "s" : ""}`
  if (typeof value === "object")
    return `${Object.keys(value as object).length} key${Object.keys(value as object).length !== 1 ? "s" : ""}`
  return ""
}

function typeLabel(value: unknown): string {
  if (value == null) return "null"
  if (Array.isArray(value)) return "array"
  return typeof value
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function DataQueryRenderer({ part }: { part: ToolResultContentPart }) {
  const type = part.type
  const result = part.toolResult as Record<string, unknown> | undefined

  const isYaml = type === "yaml_query" || type === "yaml_patch"
  const language = isYaml ? "yaml" : "json"

  // ── yaml_patch ─────────────────────────────────────────────────────────────
  if (type === "yaml_patch") {
    const before = result?.before ?? result?.original ?? result?.input ?? ""
    const after = result?.after ?? result?.patched ?? result?.output ?? result?.result ?? ""
    const patchExpression = (result?.patch ?? result?.query ?? result?.expression ?? "") as string

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">YAML Patch</span>
            {patchExpression && (
              <span className="text-primary rounded border border-[color-mix(in_srgb,var(--primary)_25%,transparent)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] px-1.5 py-0.5 font-mono text-[10px]">
                {String(patchExpression)}
              </span>
            )}
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        <div className="grid grid-cols-2 divide-x">
          <div>
            <div className="bg-surface-4 border-b px-3 py-1">
              <span className="text-muted-foreground font-mono text-[10px] font-semibold">
                before
              </span>
            </div>
            <SimpleCodeEditor
              code={stringify(before)}
              language="yaml"
              fileName="before.yaml"
              showHeader={false}
              maxHeight="35vh"
              fontSize={11}
            />
          </div>
          <div>
            <div className="bg-surface-4 border-b px-3 py-1">
              <span className="text-muted-foreground font-mono text-[10px] font-semibold">
                after
              </span>
            </div>
            <SimpleCodeEditor
              code={stringify(after)}
              language="yaml"
              fileName="after.yaml"
              showHeader={false}
              maxHeight="35vh"
              fontSize={11}
            />
          </div>
        </div>
      </ToolRendererShell>
    )
  }

  // ── json_query / yaml_query ────────────────────────────────────────────────
  const query = (result?.query ??
    result?.expression ??
    result?.filter ??
    result?.path ??
    (part.toolInput as Record<string, unknown> | undefined)?.query ??
    "") as string

  const rawResult = result?.result ?? result?.output ?? result?.data ?? result?.value ?? result

  const resultStr = stringify(rawResult)
  const typeLbl = typeLabel(rawResult)
  const sizeLbl = sizeLabel(rawResult)
  const title = type === "yaml_query" ? "YAML Query" : "JSON Query"

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">{title}</span>
          {query && (
            <span className="text-primary rounded border border-[color-mix(in_srgb,var(--primary)_25%,transparent)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] px-1.5 py-0.5 font-mono text-[10px]">
              {String(query)}
            </span>
          )}
          <ToolStatusBadge variant="neutral">{typeLbl}</ToolStatusBadge>
          {sizeLbl && (
            <span className="text-muted-foreground font-mono text-[10px]">{sizeLbl}</span>
          )}
          <CopyButton text={resultStr} className="ml-auto" />
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {rawResult == null ? (
        <EmptyState>No result</EmptyState>
      ) : (
        <SimpleCodeEditor
          code={resultStr}
          language={language}
          fileName={`result.${language}`}
          showHeader={false}
          maxHeight="45vh"
          fontSize={12}
        />
      )}
    </ToolRendererShell>
  )
}
