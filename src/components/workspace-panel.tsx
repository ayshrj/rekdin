"use client"

import * as React from "react"
import { Globe } from "lucide-react"

import { useToolResults, ToolResultEntry } from "@/contexts/chat-context"
import { cn } from "@/lib/utils"
import { Markdown } from "./markdown"

type WebSearchPayload = {
  results?: Array<{ title?: string; url?: string; snippet?: string }>
}

type VisitLinkPayload = {
  markdown?: string
  url?: string
}

type CommandPayload = {
  command?: string
  stdout?: string
  stderr?: string
}

type BrowserNavigatePayload = {
  url?: string
  title?: string
  status?: number | null
  duration?: number
  steps?: Array<Record<string, unknown>>
}

type BrowserMarkdownPayload = {
  url?: string
  title?: string
  markdown?: string
  steps?: Array<Record<string, unknown>>
}

type BrowserScreenshotPayload = {
  url?: string
  title?: string
  screenshot?: string
  steps?: Array<Record<string, unknown>>
}

function renderResult(entry: ToolResultEntry) {
  const result = entry.result ?? {}
  const webResult = result as WebSearchPayload
  if (entry.toolName === "web_search" && Array.isArray(webResult.results)) {
    const items = webResult.results
    return (
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={`${item.url}-${index}`} className="rounded-xl border bg-muted/30 p-3 text-sm">
            <p className="font-semibold">{item.title ?? item.url}</p>
            <p className="text-muted-foreground">{item.snippet}</p>
            {item.url ? (
              <a
                className="text-primary underline"
                href={String(item.url)}
                target="_blank"
                rel="noreferrer"
              >
                {item.url}
              </a>
            ) : null}
          </div>
        ))}
      </div>
    )
  }

  const visitResult = result as VisitLinkPayload
  if (entry.toolName === "visit_link" && typeof visitResult.markdown === "string") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{visitResult.url}</p>
        <Markdown>{visitResult.markdown}</Markdown>
      </div>
    )
  }

  const commandResult = result as CommandPayload
  if (entry.toolName === "execute_command") {
    return (
      <div className="text-sm">
        <p className="font-mono text-xs text-muted-foreground">{commandResult.command ?? ""}</p>
        <pre className="mt-2 max-h-60 overflow-auto rounded-lg bg-muted p-3 text-xs">
          {commandResult.stdout ? commandResult.stdout : "(no output)"}
        </pre>
        {commandResult.stderr ? (
          <pre className="mt-2 max-h-60 overflow-auto rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
            {commandResult.stderr}
          </pre>
        ) : null}
      </div>
    )
  }

  const navResult = result as BrowserNavigatePayload
  if (entry.toolName === "browser_navigate") {
    return (
      <div className="space-y-2 text-sm">
        <p className="font-semibold">{navResult.title ?? navResult.url}</p>
        <p className="text-muted-foreground">{navResult.url}</p>
        <div className="flex gap-3 text-xs text-muted-foreground">
          {navResult.status ? <span>Status: {navResult.status}</span> : null}
          {navResult.duration ? <span>Load: {navResult.duration}ms</span> : null}
        </div>
        {Array.isArray(navResult.steps) && navResult.steps.length ? (
          <div className="mt-2 space-y-1 rounded-lg border bg-muted/30 p-2 text-xs text-muted-foreground">
            {navResult.steps.map((step, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="font-medium text-foreground">{String(step.label ?? "Step")}</span>
                <span>{String(step.detail ?? "")}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  const mdResult = result as BrowserMarkdownPayload
  if (entry.toolName === "browser_get_markdown" && typeof mdResult.markdown === "string") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{mdResult.url}</p>
        {Array.isArray(mdResult.steps) && mdResult.steps.length ? (
          <div className="rounded-lg border bg-muted/30 p-2 text-xs text-muted-foreground">
            {mdResult.steps.map((step, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="font-medium text-foreground">{String(step.label ?? "Step")}</span>
                <span>{String(step.detail ?? "")}</span>
              </div>
            ))}
          </div>
        ) : null}
        <Markdown>{mdResult.markdown}</Markdown>
      </div>
    )
  }

  const shotResult = result as BrowserScreenshotPayload
  if (entry.toolName === "browser_screenshot" && typeof shotResult.screenshot === "string") {
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold">{shotResult.title ?? "Screenshot"}</p>
        <p className="text-xs text-muted-foreground">{shotResult.url}</p>
        {Array.isArray(shotResult.steps) && shotResult.steps.length ? (
          <div className="rounded-lg border bg-muted/30 p-2 text-xs text-muted-foreground">
            {shotResult.steps.map((step, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="font-medium text-foreground">{String(step.label ?? "Step")}</span>
                <span>{String(step.detail ?? "")}</span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="overflow-hidden rounded-xl border bg-muted/30">
          <img src={shotResult.screenshot} alt="Page screenshot" className="w-full" />
        </div>
      </div>
    )
  }

  return (
    <pre className="max-h-72 overflow-auto rounded-lg bg-muted p-3 text-xs">
      {JSON.stringify(result, null, 2)}
    </pre>
  )
}

export function WorkspacePanel() {
  const { toolResults } = useToolResults()
  const [selectedIndex, setSelectedIndex] = React.useState(0)

  React.useEffect(() => {
    if (toolResults.length > 0) {
      setSelectedIndex(toolResults.length - 1)
    }
  }, [toolResults])

  if (toolResults.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-2xl border bg-card text-center text-muted-foreground shadow-sm">
        <Globe className="mb-3 h-6 w-6" />
        Tool calls will appear here as the agent researches or executes commands.
      </div>
    )
  }

  const entry = toolResults[selectedIndex]

  return (
    <div className="flex h-full gap-3 rounded-2xl border bg-card shadow-sm">
      <div className="w-1/3 border-r p-4">
        <p className="text-xs uppercase text-muted-foreground">Tool timeline</p>
        <div className="mt-3 space-y-2">
          {toolResults.map((result, index) => (
            <button
              key={result.id}
              type="button"
              className={cn(
                "w-full rounded-xl border px-3 py-2 text-left text-sm transition",
                index === selectedIndex
                  ? "border-primary/40 bg-primary/5"
                  : "border-transparent hover:border-border hover:bg-muted/50"
              )}
              onClick={() => setSelectedIndex(index)}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{result.toolName}</span>
                <span className="text-xs text-muted-foreground">{result.status}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(result.timestamp).toLocaleTimeString()}
              </p>
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 p-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Active tool</p>
            <h3 className="text-lg font-semibold">{entry.toolName}</h3>
          </div>
          <div className="rounded-full border px-3 py-1 text-xs">{entry.status}</div>
        </div>
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Arguments</p>
            <pre className="mt-1 rounded-lg bg-muted p-3 text-xs">
              {JSON.stringify(entry.arguments, null, 2)}
            </pre>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Result</p>
            {renderResult(entry)}
          </div>
        </div>
      </div>
    </div>
  )
}
