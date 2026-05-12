"use client"

import { useState } from "react"

import {
  EmptyState,
  ErrorBanner,
  RawPayloadDisclosure,
  RendererTab,
  RendererTabBar,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

function fmtTime(ts: string | undefined): string {
  if (!ts) return ""
  const d = new Date(ts)
  return isNaN(d.getTime()) ? ts : d.toLocaleString()
}

function roleBadgeVariant(role: string) {
  if (role === "user") return "info" as const
  if (role === "assistant") return "success" as const
  return "neutral" as const
}

// ── SessionListRenderer ────────────────────────────────────────────────────────

export function SessionListRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined
  const totalSessions = typeof result?.totalSessions === "number" ? result.totalSessions : 0
  const omittedSessions = typeof result?.omittedSessions === "number" ? result.omittedSessions : 0
  const sessions = Array.isArray(result?.sessions)
    ? (result.sessions as Record<string, unknown>[])
    : []

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Sessions</span>
          <ToolStatusBadge variant="neutral">{totalSessions}</ToolStatusBadge>
          {omittedSessions > 0 && (
            <span className="text-muted-foreground font-mono text-[10px]">
              +{omittedSessions} omitted
            </span>
          )}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {sessions.length === 0 ? (
        <EmptyState>No sessions</EmptyState>
      ) : (
        <div className="rk-scrollbar max-h-[50vh] divide-y overflow-auto">
          {sessions.map((session, i) => {
            const title = String(session.title ?? session.id ?? `Session ${i + 1}`)
            const messageCount = typeof session.messageCount === "number" ? session.messageCount : 0
            const toolCallCount =
              typeof session.toolCallCount === "number" ? session.toolCallCount : 0
            const failedCount =
              typeof session.failedToolCallCount === "number" ? session.failedToolCallCount : 0
            const model = session.model ? String(session.model) : undefined
            const updatedAt = String(session.updatedAt ?? "")

            return (
              <div key={i} className="hover:bg-surface-4 flex items-start gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <span className="text-foreground/90 block truncate font-mono text-[11px] font-medium">
                    {title}
                  </span>
                  {updatedAt && (
                    <span className="text-muted-foreground font-mono text-[10px]">
                      {fmtTime(updatedAt)}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {messageCount > 0 && (
                    <span className="text-muted-foreground font-mono text-[10px]">
                      {messageCount} msgs
                    </span>
                  )}
                  {toolCallCount > 0 && (
                    <span className="text-muted-foreground font-mono text-[10px]">
                      {toolCallCount} tools
                    </span>
                  )}
                  {failedCount > 0 && (
                    <ToolStatusBadge variant="error">{failedCount} failed</ToolStatusBadge>
                  )}
                  {model && <span className="rk-path-chip max-w-28 min-w-0 truncate">{model}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </ToolRendererShell>
  )
}

// ── SessionInspectRenderer ────────────────────────────────────────────────────

export function SessionInspectRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined
  const [tab, setTab] = useState<"messages" | "toolcalls">("messages")

  const found = result?.found !== false
  if (!found) {
    return (
      <ToolRendererShell
        header={
          <span className="text-foreground font-mono text-[11px] font-semibold">
            Session Inspect
          </span>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        <ErrorBanner>{String(result?.error ?? "Session not found.")}</ErrorBanner>
      </ToolRendererShell>
    )
  }

  const title = String(result?.title ?? result?.sessionId ?? "Session")
  const messageCount = typeof result?.messageCount === "number" ? result.messageCount : 0
  const omittedMessages = typeof result?.omittedMessages === "number" ? result.omittedMessages : 0
  const toolCallCount = typeof result?.toolCallCount === "number" ? result.toolCallCount : 0
  const model = result?.model ? String(result.model) : undefined
  const finalAnswerPreview = result?.finalAnswerPreview
    ? String(result.finalAnswerPreview)
    : undefined

  const messages = Array.isArray(result?.messages)
    ? (result.messages as Record<string, unknown>[])
    : []

  const toolCallNameCounts =
    result?.toolCallNameCounts &&
    typeof result.toolCallNameCounts === "object" &&
    !Array.isArray(result.toolCallNameCounts)
      ? (result.toolCallNameCounts as Record<string, number>)
      : {}
  const toolCallStatusCounts =
    result?.toolCallStatusCounts &&
    typeof result.toolCallStatusCounts === "object" &&
    !Array.isArray(result.toolCallStatusCounts)
      ? (result.toolCallStatusCounts as Record<string, number>)
      : {}

  const hasToolCalls = toolCallCount > 0

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground max-w-48 min-w-0 truncate font-mono text-[11px] font-semibold">
            {title}
          </span>
          <ToolStatusBadge variant="neutral">{messageCount} msgs</ToolStatusBadge>
          {toolCallCount > 0 && (
            <ToolStatusBadge variant="neutral">{toolCallCount} tools</ToolStatusBadge>
          )}
          {model && <span className="rk-path-chip max-w-28 min-w-0 truncate">{model}</span>}
          {omittedMessages > 0 && (
            <span className="text-muted-foreground font-mono text-[10px]">
              +{omittedMessages} omitted
            </span>
          )}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {hasToolCalls && (
        <RendererTabBar>
          <RendererTab active={tab === "messages"} onClick={() => setTab("messages")}>
            Messages
          </RendererTab>
          <RendererTab active={tab === "toolcalls"} onClick={() => setTab("toolcalls")}>
            Tool Calls
          </RendererTab>
        </RendererTabBar>
      )}

      {tab === "messages" && (
        <div className="rk-scrollbar max-h-[50vh] divide-y overflow-auto">
          {messages.length === 0 ? (
            <EmptyState>No messages</EmptyState>
          ) : (
            messages.map((msg, i) => {
              const role = String(msg.role ?? "unknown")
              const preview = String(msg.contentPreview ?? "")
              const chars = typeof msg.contentChars === "number" ? msg.contentChars : 0
              const truncated = preview.length > 200 ? preview.slice(0, 200) + "…" : preview
              const extra = chars > preview.length ? chars - preview.length : 0
              const ts = String(msg.timestamp ?? "")

              return (
                <div key={i} className="hover:bg-surface-4 px-3 py-2">
                  <div className="mb-1 flex items-center gap-2">
                    <ToolStatusBadge variant={roleBadgeVariant(role)}>{role}</ToolStatusBadge>
                    {ts && (
                      <span className="text-muted-foreground font-mono text-[10px]">
                        {fmtTime(ts)}
                      </span>
                    )}
                    {extra > 0 && (
                      <span className="text-muted-foreground font-mono text-[10px]">
                        +{extra} chars
                      </span>
                    )}
                  </div>
                  {truncated && (
                    <p className="text-foreground/70 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                      {truncated}
                    </p>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {tab === "toolcalls" && (
        <div className="rk-scrollbar max-h-[50vh] overflow-auto">
          {Object.keys(toolCallNameCounts).length > 0 && (
            <div className="divide-y">
              <div className="px-3 py-1.5">
                <span className="rk-section-label">By name</span>
              </div>
              {Object.entries(toolCallNameCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([name, count], i) => (
                  <div key={i} className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
                    <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
                      {name}
                    </span>
                    <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                      ×{count}
                    </span>
                  </div>
                ))}
            </div>
          )}
          {Object.keys(toolCallStatusCounts).length > 0 && (
            <div className="divide-y">
              <div className="border-t px-3 py-1.5">
                <span className="rk-section-label">By status</span>
              </div>
              {Object.entries(toolCallStatusCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([status, count], i) => (
                  <div key={i} className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
                    <span className="text-foreground/80 min-w-0 flex-1 font-mono text-[11px]">
                      {status}
                    </span>
                    <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                      ×{count}
                    </span>
                  </div>
                ))}
            </div>
          )}
          {finalAnswerPreview && (
            <div className="border-t px-3 py-2">
              <div className="rk-section-label mb-1.5">Final answer preview</div>
              <pre className="text-foreground/70 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                {finalAnswerPreview.length > 500
                  ? finalAnswerPreview.slice(0, 500) + "…"
                  : finalAnswerPreview}
              </pre>
            </div>
          )}
          {Object.keys(toolCallNameCounts).length === 0 && !finalAnswerPreview && (
            <EmptyState>No tool call data</EmptyState>
          )}
        </div>
      )}
    </ToolRendererShell>
  )
}
