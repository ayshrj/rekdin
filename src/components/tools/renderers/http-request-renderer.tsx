"use client"

import { useState } from "react"

import { ArrowDownTray, Globe } from "@/lib/icons"

import {
  CopyButton,
  EmptyState,
  ErrorBanner,
  RawPayloadDisclosure,
  RendererTab,
  RendererTabBar,
  ToolMetaRow,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { SimpleCodeEditor } from "./simple-code-editor"
import { ToolResultContentPart } from "./tool-result-renderer"

type Tab = "overview" | "headers" | "body"

function httpStatusVariant(status: number): "success" | "warning" | "error" {
  if (status >= 200 && status < 300) return "success"
  if (status >= 300 && status < 400) return "warning"
  return "error"
}

function detectBodyLanguage(
  bodyText: string,
  json: unknown,
  headers: Record<string, string>
): "json" | "html" | "xml" | "text" {
  if (json !== undefined) return "json"
  const ct = headers["content-type"] ?? headers["Content-Type"] ?? ""
  if (ct.includes("json")) return "json"
  if (ct.includes("html")) return "html"
  if (ct.includes("xml")) return "xml"
  const t = bodyText.trimStart()
  if (t.startsWith("{") || t.startsWith("[")) return "json"
  if (t.startsWith("<")) return "html"
  return "text"
}

export function HttpRequestRenderer({ part }: { part: ToolResultContentPart }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (part.toolResult || {}) as Record<string, any>
  const url = result.url || part.url || ""
  const method = (result.method || part.method || "GET").toUpperCase()
  const status = result.status as number | undefined
  const ok = Boolean(result.ok)
  const headers = (result.headers as Record<string, string>) || {}
  const bodyText: string = result.bodyText ?? result.body ?? ""
  const json = result.json
  const error = result.error
  const [tab, setTab] = useState<Tab>("overview")

  const hasBody = Boolean(bodyText || json !== undefined)
  const hasHeaders = Object.keys(headers).length > 0
  const bodyLanguage = detectBodyLanguage(bodyText, json, headers)
  const bodyContent = json !== undefined ? JSON.stringify(json, null, 2) : bodyText

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "overview", label: "Overview", show: true },
    {
      id: "headers",
      label: `Headers${hasHeaders ? ` (${Object.keys(headers).length})` : ""}`,
      show: true,
    },
    { id: "body", label: "Body", show: hasBody },
  ]

  return (
    <ToolRendererShell
      header={
        <>
          <Globe className="text-tool-browser h-3.5 w-3.5 shrink-0" />
          <span className="text-tool-browser rounded bg-[color-mix(in_srgb,var(--tool-browser)_15%,transparent)] px-1.5 py-0.5 font-mono text-[10px] font-semibold">
            {method}
          </span>
          {status !== undefined && (
            <ToolStatusBadge variant={httpStatusVariant(status)}>{status}</ToolStatusBadge>
          )}
          <span
            className="text-foreground/60 min-w-0 flex-1 truncate font-mono text-[11px]"
            title={url}
          >
            {url}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {result.duration && (
              <span className="text-muted-foreground font-mono text-[10px]">
                {(result.duration / 1000).toFixed(2)}s
              </span>
            )}
            <CopyButton text={url} />
          </div>
        </>
      }
      footer={<RawPayloadDisclosure payload={part.toolResult} />}
    >
      {error && <ErrorBanner>{String(error)}</ErrorBanner>}

      <RendererTabBar>
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <RendererTab key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </RendererTab>
          ))}
      </RendererTabBar>

      {/* Overview */}
      {tab === "overview" && (
        <div className="divide-y">
          <ToolMetaRow label="URL" mono>
            {url || "—"}
          </ToolMetaRow>
          <ToolMetaRow label="Method" mono>
            {method}
          </ToolMetaRow>
          <ToolMetaRow label="Status" mono>
            {status !== undefined ? `${status}${ok ? " OK" : ""}` : "—"}
          </ToolMetaRow>
          {result.duration && (
            <ToolMetaRow label="Duration" mono>
              {(result.duration / 1000).toFixed(3)}s
            </ToolMetaRow>
          )}
          {result.size && (
            <ToolMetaRow label="Size" mono>
              {result.size}&nbsp;B
            </ToolMetaRow>
          )}
        </div>
      )}

      {/* Headers */}
      {tab === "headers" && (
        <div className="rk-scrollbar max-h-[50vh] divide-y overflow-auto">
          {!hasHeaders ? (
            <EmptyState>No headers</EmptyState>
          ) : (
            Object.entries(headers).map(([key, val]) => (
              <div key={key} className="group flex items-start gap-2 px-3 py-1.5">
                <span className="text-muted-foreground w-40 shrink-0 truncate pt-px font-mono text-[10px]">
                  {key}
                </span>
                <span className="text-foreground/80 min-w-0 flex-1 font-mono text-[11px] break-all">
                  {val}
                </span>
                <CopyButton
                  text={`${key}: ${val}`}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                />
              </div>
            ))
          )}
        </div>
      )}

      {/* Body */}
      {tab === "body" &&
        (!hasBody ? (
          <EmptyState>No body</EmptyState>
        ) : bodyLanguage === "text" ? (
          <pre className="rk-scrollbar text-foreground/80 max-h-[60vh] overflow-auto px-3 py-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
            {bodyContent}
          </pre>
        ) : (
          <SimpleCodeEditor
            code={bodyContent}
            language={bodyLanguage}
            fileName={`response.${bodyLanguage}`}
            showHeader={false}
            maxHeight="60vh"
            fontSize={12}
          />
        ))}

      {result.downloadUrl && (
        <div className="border-t px-3 py-2">
          <a
            href={result.downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="rk-flat-button inline-flex h-7 items-center gap-1.5 px-2 font-mono text-[10px]"
          >
            <ArrowDownTray className="h-3 w-3" />
            Download
          </a>
        </div>
      )}
    </ToolRendererShell>
  )
}
