"use client"

import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { ChevronRight } from "@/lib/icons"
import { cn } from "@/lib/utils"

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
export type JsonObject = { [key: string]: JsonValue }
type JsonType = "null" | "array" | "object" | "string" | "number" | "boolean"

function getJsonType(value: JsonValue): JsonType {
  if (value === null) return "null"
  if (Array.isArray(value)) return "array"
  if (typeof value === "object") return "object"
  if (typeof value === "string") return "string"
  if (typeof value === "number") return "number"
  return "boolean"
}

function JsonTreeNode({
  data,
  keyName = null,
  depth = 0,
  isLast = true,
}: {
  data: JsonValue
  keyName?: string | null
  depth?: number
  isLast?: boolean
}) {
  const [collapsed, setCollapsed] = React.useState(depth > 1)
  const type = getJsonType(data)
  const isNode = type === "object" || type === "array"
  const entries: [string, JsonValue][] = isNode
    ? (Object.entries(data as JsonObject | JsonValue[]) as [string, JsonValue][])
    : []
  const isEmpty = entries.length === 0
  const comma = !isLast ? <span className="text-muted-foreground">,</span> : null
  const braces: [string, string] = type === "array" ? ["[", "]"] : ["{", "}"]

  const renderPrimitive = () => {
    if (type === "string") {
      return <span className="text-tool-research break-all">&quot;{String(data)}&quot;</span>
    }
    if (type === "number") {
      return <span className="text-tool-command">{String(data)}</span>
    }
    if (type === "boolean") {
      return <span className="text-tool-data">{String(data)}</span>
    }
    return <span className="text-destructive">null</span>
  }

  if (!isNode) {
    return (
      <div className="font-mono text-sm leading-6" style={{ paddingLeft: depth * 16 }}>
        {keyName !== null ? <span className="text-tool-json">&quot;{keyName}&quot;: </span> : null}
        {renderPrimitive()}
        {comma}
      </div>
    )
  }

  return (
    <div
      className="font-mono text-sm leading-6"
      style={{ paddingLeft: keyName !== null ? depth * 16 : 0 }}
    >
      <div
        className={cn(
          "flex items-center gap-1.5",
          !isEmpty && "hover:bg-muted/40 cursor-pointer rounded px-1"
        )}
        onClick={() => {
          if (!isEmpty) setCollapsed((value) => !value)
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
              data={value}
              keyName={type === "array" ? null : entryKey}
              depth={depth + 1}
              isLast={index === entries.length - 1}
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

export function JsonTreeViewer({ json, className }: { json: JsonValue; className?: string }) {
  return (
    <div className={cn("min-w-0 p-4", className)}>
      <div className="from-background to-muted/40 overflow-x-auto rounded-lg border bg-gradient-to-br p-3 shadow-sm">
        <JsonTreeNode data={json} depth={0} />
      </div>
    </div>
  )
}
