"use client"

import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { ChevronRight } from "@/lib/icons"
import { cn } from "@/lib/utils"

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
export type JsonObject = { [key: string]: JsonValue }
type JsonType = "null" | "array" | "object" | "string" | "number" | "boolean"

export type ShowOnlyKeys = {
  keys: string[]
  mode?: "remove" | "blur"
}

function getJsonType(value: JsonValue): JsonType {
  if (value === null) return "null"
  if (Array.isArray(value)) return "array"
  if (typeof value === "object") return "object"
  if (typeof value === "string") return "string"
  if (typeof value === "number") return "number"
  return "boolean"
}

function renderPrimitive(data: JsonValue) {
  const type = getJsonType(data)
  if (type === "string")
    return <span className="text-tool-research break-all">&quot;{String(data)}&quot;</span>
  if (type === "number") return <span className="text-tool-command">{String(data)}</span>
  if (type === "boolean") return <span className="text-tool-data">{String(data)}</span>
  return <span className="text-destructive">null</span>
}

function redact(v: JsonValue): JsonValue {
  if (v === null) return null
  if (typeof v === "boolean") return false
  if (typeof v === "number") return 0
  if (typeof v === "string") return "•".repeat(Math.max(4, v.length))
  if (Array.isArray(v)) return (v as JsonValue[]).map(redact)
  return Object.fromEntries(Object.entries(v as JsonObject).map(([k, val]) => [k, redact(val)]))
}

function JsonTreeNode({
  data,
  keyName = null,
  depth = 0,
  isLast = true,
  showOnlyKeys,
}: {
  data: JsonValue
  keyName?: string | null
  depth?: number
  isLast?: boolean
  showOnlyKeys?: ShowOnlyKeys
}) {
  const [collapsed, setCollapsed] = React.useState(depth > 1)
  const type = getJsonType(data)
  const isNode = type === "object" || type === "array"

  const isFiltered = keyName !== null && showOnlyKeys && !showOnlyKeys.keys.includes(keyName)
  const filterMode = showOnlyKeys?.mode ?? "blur"

  const redactedData: JsonValue = React.useMemo(() => {
    if (!isFiltered || filterMode !== "blur") return data
    return redact(data)
  }, [data, isFiltered, filterMode])

  const allEntries: [string, JsonValue][] = isNode
    ? (Object.entries(data as JsonObject | JsonValue[]) as [string, JsonValue][])
    : []

  const entries: [string, JsonValue][] =
    isNode && type === "object" && filterMode === "remove" && depth === 0 && showOnlyKeys
      ? allEntries.filter(([k]) => showOnlyKeys.keys.includes(k))
      : allEntries

  const isEmpty = entries.length === 0
  const comma = !isLast ? <span className="text-muted-foreground">,</span> : null
  const braces: [string, string] = type === "array" ? ["[", "]"] : ["{", "}"]

  if (!isNode) {
    if (isFiltered && filterMode === "remove") return null

    const displayData = isFiltered && filterMode === "blur" ? redactedData : data

    return (
      <div className="font-mono text-sm leading-6 select-none" style={{ paddingLeft: depth * 16 }}>
        {keyName !== null ? <span className="text-tool-json">&quot;{keyName}&quot;: </span> : null}
        {renderPrimitive(displayData)}
        {comma}
      </div>
    )
  }

  if (isFiltered && filterMode === "remove") return null

  return (
    <div
      className="font-mono text-sm leading-6"
      style={{ paddingLeft: keyName !== null ? depth * 16 : 0 }}
    >
      <div
        className={cn(
          "flex items-center gap-1.5",
          !isEmpty && !isFiltered && "hover:bg-muted/40 cursor-pointer rounded px-1",
          isFiltered && "pointer-events-none"
        )}
        onClick={() => {
          if (!isEmpty && !isFiltered) setCollapsed((v) => !v)
        }}
      >
        <span
          className={cn(
            "text-tool-json inline-flex w-4 items-center justify-center transition-transform",
            isEmpty && "invisible",
            collapsed ? "rotate-0" : "rotate-90"
          )}
        >
          <ChevronRight size={12} />
        </span>
        {keyName !== null ? <span className="text-tool-json">&quot;{keyName}&quot;: </span> : null}
        <span className="text-muted-foreground">{braces[0]}</span>
        {(collapsed || isEmpty) && !isEmpty ? (
          <Badge
            variant="outline"
            className="border-tool-json/25 bg-tool-json/10 text-tool-json h-5 rounded-sm px-1.5 text-[10px] font-normal"
          >
            {entries.length} {type === "array" ? "items" : "keys"}
          </Badge>
        ) : null}
        {collapsed || isEmpty ? <span className="text-muted-foreground">{braces[1]}</span> : null}
        {collapsed || isEmpty ? comma : null}
      </div>

      {!collapsed && !isEmpty ? (
        <>
          {entries.map(([entryKey, value], index) => (
            <JsonTreeNode
              key={`${depth}-${entryKey}-${index}`}
              data={
                isFiltered && filterMode === "blur" ? (redactedData as JsonObject)[entryKey] : value
              }
              keyName={type === "array" ? null : entryKey}
              depth={depth + 1}
              isLast={index === entries.length - 1}
              showOnlyKeys={isFiltered && filterMode === "blur" ? undefined : showOnlyKeys}
            />
          ))}
          <div className="font-mono text-sm leading-6" style={{ paddingLeft: depth * 16 }}>
            <span className="text-muted-foreground">{braces[1]}</span>
            {comma}
          </div>
        </>
      ) : null}
    </div>
  )
}

export function JsonTreeViewer({
  json,
  className,
  showOnlyKeys,
}: {
  json: JsonValue
  className?: string
  showOnlyKeys?: ShowOnlyKeys
}) {
  return (
    <div className={cn("min-w-0 p-4", className)}>
      <div className="from-background to-muted/40 overflow-x-auto rounded-lg border bg-gradient-to-br p-3 shadow-sm">
        <JsonTreeNode data={json} depth={0} showOnlyKeys={showOnlyKeys} />
      </div>
    </div>
  )
}
