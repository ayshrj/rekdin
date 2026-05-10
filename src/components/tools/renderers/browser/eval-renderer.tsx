"use client"

import {
  CopyButton,
  EmptyState,
  RawPayloadDisclosure,
  ToolRendererShell,
  ToolStatusBadge,
} from "../renderer-primitives"
import { SimpleCodeEditor } from "../simple-code-editor"
import { type ToolResultContentPart } from "../tool-result-renderer"

const LOG_LEVEL_COLORS: Record<string, string> = {
  error: "text-destructive",
  warn: "text-amber-500",
  warning: "text-amber-500",
  info: "text-blue-500",
  log: "text-foreground/60",
  debug: "text-muted-foreground",
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function BrowserEvalRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined
  const input = part.toolInput as Record<string, unknown> | undefined

  const expression = String(
    input?.expression ?? input?.code ?? input?.script ?? result?.expression ?? ""
  )
  const returnValue = result?.result ?? result?.value ?? result?.returnValue ?? result?.output
  const consoleOutput = result?.console ?? result?.consoleOutput ?? result?.logs
  const success = result?.success !== false && !result?.error
  const errorMsg = result?.error ? String(result.error) : undefined

  const consoleLines: Array<{ level: string; message: string }> = Array.isArray(consoleOutput)
    ? (consoleOutput as Record<string, unknown>[]).map((e) => ({
        level: String(e?.level ?? e?.type ?? "log"),
        message: String(e?.message ?? e?.text ?? e ?? ""),
      }))
    : typeof consoleOutput === "string" && consoleOutput
      ? [{ level: "log", message: consoleOutput }]
      : []

  const resultStr = returnValue !== undefined ? stringify(returnValue) : ""

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Evaluate</span>
          <ToolStatusBadge variant={success ? "success" : "error"}>
            {success ? "success" : "error"}
          </ToolStatusBadge>
          {resultStr && <CopyButton text={resultStr} className="ml-auto" />}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {expression && (
        <div>
          <div className="bg-surface-4 border-b px-3 py-1">
            <span className="rk-section-label">expression</span>
          </div>
          <SimpleCodeEditor
            code={expression}
            language="javascript"
            fileName="eval.js"
            showHeader={false}
            maxHeight="20vh"
            fontSize={12}
          />
        </div>
      )}
      {errorMsg ? (
        <div className="px-3 py-2">
          <span className="text-destructive font-mono text-[11px]">{errorMsg}</span>
        </div>
      ) : returnValue !== undefined ? (
        <div>
          <div className="bg-surface-4 border-t border-b px-3 py-1">
            <span className="rk-section-label">return value</span>
          </div>
          <SimpleCodeEditor
            code={resultStr}
            language="json"
            fileName="result.json"
            showHeader={false}
            maxHeight="30vh"
            fontSize={12}
          />
        </div>
      ) : !expression ? (
        <EmptyState>No expression</EmptyState>
      ) : null}
      {consoleLines.length > 0 && (
        <div className="border-t">
          <div className="bg-surface-4 border-b px-3 py-1">
            <span className="rk-section-label">console ({consoleLines.length})</span>
          </div>
          <div className="max-h-[20vh] divide-y overflow-auto">
            {consoleLines.map((line, i) => (
              <div key={i} className="hover:bg-surface-4 flex items-start gap-2 px-3 py-1">
                <span
                  className={`shrink-0 font-mono text-[9px] font-semibold uppercase ${LOG_LEVEL_COLORS[line.level] ?? "text-muted-foreground"}`}
                >
                  {line.level.slice(0, 5)}
                </span>
                <span className="text-foreground/70 min-w-0 flex-1 font-mono text-[10px] break-all">
                  {line.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </ToolRendererShell>
  )
}
