"use client"

import * as React from "react"
import { useState } from "react"

import { Markdown } from "@/components/markdown"
import { toolLabels } from "@/components/tools/tool-labels"
import {
  ArrowRight,
  Check,
  ClipboardDocumentList as Copy,
  PencilSquare,
  Plus,
  RekdinIcon,
  User,
} from "@/lib/icons"
import { cn } from "@/lib/utils"
import { getWorkflowPreset, parseStructuredWorkflowContent } from "@/lib/workflows"
import { ChatMessage as ChatMessageType } from "@/types/chat"

interface ChatMessageProps {
  message: ChatMessageType
  showHeader?: boolean
  searchQuery?: string
  searchActive?: boolean
  onEdit?: (messageId: string) => void
  onToggleStar?: (messageId: string) => void
  onFork?: (messageId: string) => void
}

function looksLikeJsonDraft(content: string) {
  const trimmed = content.trimStart()
  return trimmed.startsWith("{") || trimmed.startsWith("[")
}

/** Maps workflow ids to a display label shown in the agent-mode badge */
const workflowBadgeLabel: Record<string, string> = {
  "research-plan": "research-plan",
  "research-report": "research-report",
  "repo-audit": "repo-audit",
  "diff-review": "diff-review",
}

/** Color variant for the agent-mode badge */
function workflowBadgeVariant(
  workflowId: string | undefined
): "blue" | "purple" | "green" | "default" {
  if (!workflowId) return "default"
  if (workflowId === "research-plan" || workflowId === "research-report") return "blue"
  if (workflowId === "repo-audit" || workflowId === "diff-review") return "purple"
  return "default"
}

function CompactionBanner({ summary }: { summary: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="border-tool-data/25 bg-surface-3/60 my-2 rounded-lg border px-3 py-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
        aria-expanded={expanded}
      >
        <span className="text-tool-data shrink-0 font-mono text-[10px] font-semibold tracking-wider uppercase">
          Context compacted
        </span>
        <span className="text-muted-foreground ml-auto shrink-0 font-mono text-[10px]">
          {expanded ? "hide" : "show"}
        </span>
      </button>
      {expanded && (
        <p className="text-muted-foreground mt-1.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
          {summary}
        </p>
      )}
    </div>
  )
}

function highlightText(text: string, query?: string) {
  const q = query?.trim()
  if (!q) return text
  const lower = text.toLowerCase()
  const needle = q.toLowerCase()
  const parts: React.ReactNode[] = []
  let cursor = 0
  let index = lower.indexOf(needle)
  while (index !== -1) {
    if (index > cursor) parts.push(text.slice(cursor, index))
    parts.push(
      <mark key={`${index}-${needle}`} className="bg-status-warning/35 rounded-sm px-0.5">
        {text.slice(index, index + needle.length)}
      </mark>
    )
    cursor = index + needle.length
    index = lower.indexOf(needle, cursor)
  }
  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}

/**
 * Renders a persisted chat message, including workflow-aware structured output blocks for
 * selected assistant responses.
 */
export function ChatMessage({
  message,
  showHeader = true,
  searchQuery,
  searchActive,
  onEdit,
  onToggleStar,
  onFork,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === "user"
  const workflowId = message.metadata?.workflowId
  const workflow = getWorkflowPreset(workflowId)
  const isStructuredDraft =
    !isUser && Boolean(message.metadata?.thinking) && Boolean(workflowId) && Boolean(workflow)
  const structuredContent =
    !isUser && workflowId ? parseStructuredWorkflowContent(message.content || "") : null

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(message.content || "")
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  // ─── Structured renderers ───────────────────────────────────────────────────

  const renderStructured = () => {
    if (!structuredContent || !workflowId) return null
    const asArray = (value: unknown) => (Array.isArray(value) ? value : [])

    // ── Research Plan ──────────────────────────────────────────────────────────
    if (workflowId === "research-plan") {
      return (
        <div className="rk-structured-card">
          <div className="rk-structured-card-header">
            <span className="rk-structured-eyebrow">Research plan</span>
            <p className="rk-structured-title">
              {String(structuredContent.objective ?? structuredContent.topic ?? "Research plan")}
            </p>
          </div>

          <div className="rk-structured-card-body">
            {/* Questions */}
            <div>
              <p className="rk-section-label">Questions</p>
              <ul className="rk-list">
                {asArray(structuredContent.questions).map((item, i) => (
                  <li key={`q-${i}`}>{String(item)}</li>
                ))}
              </ul>
            </div>

            {/* Search queries */}
            <div>
              <p className="rk-section-label">Search queries</p>
              <div className="rk-chip-group">
                {asArray(structuredContent.searchQueries).map((item, i) => (
                  <span key={`sq-${i}`} className="rk-mono-chip">
                    {String(item)}
                  </span>
                ))}
              </div>
            </div>

            {/* Deliverables */}
            <div>
              <p className="rk-section-label">Deliverables</p>
              <ul className="rk-list">
                {asArray(structuredContent.deliverables).map((item, i) => (
                  <li key={`d-${i}`}>{String(item)}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )
    }

    // ── Research Report ────────────────────────────────────────────────────────
    if (workflowId === "research-report") {
      const findings = asArray(structuredContent.keyFindings)
      const sources = asArray(structuredContent.sources)
      return (
        <div className="rk-structured-card">
          <div className="rk-structured-card-header">
            <span className="rk-structured-eyebrow">Research report</span>
            <p className="rk-structured-title">
              {String(structuredContent.title ?? "Research Report")}
            </p>
            <p className="rk-structured-summary">
              {String(structuredContent.executiveSummary ?? "")}
            </p>
          </div>

          <div className="rk-structured-card-body">
            {findings.length > 0 && (
              <div>
                <p className="rk-section-label">Key findings</p>
                <div className="rk-finding-list">
                  {findings.map((item, i) => {
                    const f = item as Record<string, unknown>
                    return (
                      <div key={`f-${i}`} className="rk-finding-row">
                        <div className="rk-finding-meta">
                          <p className="rk-finding-claim">
                            {String(f.claim ?? `Finding ${i + 1}`)}
                          </p>
                          <ConfidenceBadge value={String(f.confidence ?? "unknown")} />
                        </div>
                        <p className="rk-finding-evidence">{String(f.evidence ?? "")}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {sources.length > 0 && (
              <div>
                <p className="rk-section-label">Sources</p>
                <div className="rk-finding-list">
                  {sources.map((item, i) => {
                    const s = item as Record<string, unknown>
                    const url = String(s.url ?? "")
                    return (
                      <div key={`s-${i}`} className="rk-finding-row">
                        <a className="rk-source-link" href={url} target="_blank" rel="noreferrer">
                          {String(s.title ?? url)}
                        </a>
                        <p className="rk-finding-evidence">{String(s.whyItMatters ?? "")}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )
    }

    // ── Repo Audit / Diff Review ───────────────────────────────────────────────
    if (workflowId === "repo-audit" || workflowId === "diff-review") {
      const isAudit = workflowId === "repo-audit"
      const findings = asArray(isAudit ? structuredContent.risks : structuredContent.findings)
      const nextSteps = asArray(
        isAudit ? structuredContent.recommendedNextSteps : structuredContent.validation
      )
      const entryPoints = asArray(structuredContent.entryPoints)

      return (
        <div className="rk-structured-card">
          <div className="rk-structured-card-header">
            <span className="rk-structured-eyebrow">{isAudit ? "Repo audit" : "Diff review"}</span>
            {Boolean(structuredContent.title) && (
              <p className="rk-structured-title">{String(structuredContent.title)}</p>
            )}
            <p className="rk-structured-summary">
              {String(structuredContent.summary ?? "Structured workflow result")}
            </p>
          </div>

          <div className="rk-structured-card-body">
            {entryPoints.length > 0 && (
              <div>
                <p className="rk-section-label">Entry points</p>
                <div className="rk-chip-group">
                  {entryPoints.map((item, i) => (
                    <span key={`ep-${i}`} className="rk-mono-chip">
                      {String(item)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {findings.length > 0 && (
              <div>
                <p className="rk-section-label">Findings</p>
                <div className="rk-finding-list">
                  {findings.map((item, i) => {
                    const f = item as Record<string, unknown>
                    return (
                      <div key={`rv-${i}`} className="rk-finding-row">
                        <div className="rk-finding-meta">
                          <p className="rk-finding-claim">{String(f.title ?? `Item ${i + 1}`)}</p>
                          <SeverityBadge value={String(f.severity ?? f.priority ?? "info")} />
                        </div>
                        <p className="rk-finding-evidence">{String(f.reason ?? f.detail ?? "")}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {nextSteps.length > 0 && (
              <div>
                <p className="rk-section-label">
                  {isAudit ? "Recommended next steps" : "Validation"}
                </p>
                <ul className="rk-arrow-list">
                  {nextSteps.map((item, i) => (
                    <li key={`ns-${i}`}>{String(item)}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )
    }

    return null
  }

  // ── Building-result draft state ──────────────────────────────────────────────
  const renderStructuredDraft = () => {
    if (!isStructuredDraft || !looksLikeJsonDraft(message.content || "")) return null
    return (
      <div className="rk-draft-state">
        <span className="rk-draft-pulse" />
        <div className="min-w-0">
          <p className="rk-draft-title">Building structured result</p>
          <p className="rk-draft-sub">
            {workflow?.title ?? "Workflow"} is generating validated JSON. The formatted result will
            appear here when the stream completes.
          </p>
          <div className="rk-skeleton-lines">
            <span className="rk-skeleton" style={{ width: "78%" }} />
            <span className="rk-skeleton" style={{ width: "52%" }} />
          </div>
        </div>
      </div>
    )
  }

  // ─── Badge helpers ──────────────────────────────────────────────────────────
  const badgeVariant = workflowBadgeVariant(workflowId)

  // ─── Compaction banner ───────────────────────────────────────────────────────
  if (message.metadata?.compactionMarker) {
    return <CompactionBanner summary={message.content} />
  }

  if (message.metadata?.statusMarker) {
    return (
      <div className="border-tool-data/30 bg-surface-3/70 my-2 rounded-lg border px-3 py-2">
        <p className="text-tool-data mb-1 font-mono text-[10px] font-semibold tracking-wider uppercase">
          Status
        </p>
        <Markdown className="rk-markdown max-w-none text-xs wrap-anywhere">
          {message.content}
        </Markdown>
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className={cn(
        "rk-msg-root group",
        isUser && "items-end",
        searchActive && "ring-status-warning/40 rounded-lg ring-1"
      )}
    >
      {/* Copy button — AI messages only */}
      {!isUser && (
        <button
          onClick={copyToClipboard}
          className={cn("rk-copy-btn", copied && "rk-copy-btn--copied")}
          aria-label="Copy message"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      )}

      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {isUser && onEdit ? (
          <button
            type="button"
            onClick={() => onEdit(message.id)}
            className="rk-copy-btn"
            aria-label="Edit and rerun message"
          >
            <PencilSquare className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {onToggleStar ? (
          <button
            type="button"
            onClick={() => onToggleStar(message.id)}
            className={cn("rk-copy-btn", message.metadata?.starred && "rk-copy-btn--copied")}
            aria-label={message.metadata?.starred ? "Unpin message" : "Pin message"}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {onFork ? (
          <button
            type="button"
            onClick={() => onFork(message.id)}
            className="rk-copy-btn"
            aria-label="Fork conversation from here"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {/* Message header */}
      {showHeader && (
        <div className={cn("rk-msg-header", isUser && "rk-msg-header--user")}>
          {/* Avatar */}
          <div
            className={cn("rk-msg-avatar", isUser ? "rk-msg-avatar--user" : "rk-msg-avatar--ai")}
          >
            {isUser ? (
              <User className="h-3 w-3" />
            ) : (
              <RekdinIcon className="text-primary h-3 w-3" />
            )}
          </div>

          <span className="rk-msg-name">{isUser ? "You" : "Rekdin"}</span>

          {/* Agent/workflow badge — AI only */}
          {!isUser && workflowId && (
            <span
              className={cn(
                "rk-agent-badge",
                badgeVariant === "blue" && "rk-agent-badge--blue",
                badgeVariant === "purple" && "rk-agent-badge--purple"
              )}
            >
              {workflowBadgeLabel[workflowId] ?? message.metadata?.agentType ?? workflowId}
            </span>
          )}

          {/* Fallback agent type badge when no workflowId */}
          {!isUser && !workflowId && message.metadata?.agentType && (
            <span className="rk-agent-badge">{message.metadata.agentType}</span>
          )}
          {!isUser && message.metadata?.tokens ? (
            <span
              className="text-muted-foreground font-mono text-[10px] opacity-0 transition-opacity group-hover:opacity-100"
              title={
                message.metadata.estimatedCostUsd
                  ? `Estimated cost $${message.metadata.estimatedCostUsd.toFixed(4)}`
                  : undefined
              }
            >
              ~{message.metadata.tokens.toLocaleString()} tok
              {message.metadata.estimatedCostUsd
                ? ` · $${message.metadata.estimatedCostUsd.toFixed(4)}`
                : ""}
            </span>
          ) : null}
        </div>
      )}

      {/* Message body */}
      <div className={cn("rk-msg-body", isUser ? "rk-msg-body--user" : "rk-msg-body--ai")}>
        <div className="flex min-w-0 flex-col gap-2 overflow-x-hidden">
          {isUser ? (
            <p className="text-left text-sm leading-relaxed wrap-anywhere whitespace-pre-wrap">
              {highlightText(message.content, searchQuery)}
            </p>
          ) : (
            (renderStructuredDraft() ??
            renderStructured() ?? (
              <Markdown className="rk-markdown max-w-none text-sm wrap-anywhere">
                {message.content || "_(no response)_"}
              </Markdown>
            ))
          )}

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className={cn("rk-attach-chips", isUser && "justify-end")}>
              {message.attachments.map((file) => (
                <a
                  key={file}
                  href={file}
                  target="_blank"
                  rel="noreferrer"
                  className="rk-attach-chip"
                >
                  <span className="rk-attach-icon">⊡</span>
                  <span className="font-mono text-[10px]">{file}</span>
                </a>
              ))}
            </div>
          )}

          {/* Tool call chips */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="rk-tool-chips">
              {message.toolCalls.slice(0, 4).map((call) => (
                <span key={call.id ?? call.name} className="rk-tool-chip">
                  <ToolDot name={call.name} />
                  {toolLabels[call.name] ?? call.name}
                </span>
              ))}
              {message.toolCalls.length > 4 && (
                <span className="rk-tool-chip rk-tool-chip--overflow">
                  +{message.toolCalls.length - 4} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Small helper components ─────────────────────────────────────────────────

/** Colored dot that maps tool category to the design-system tool color variables */
function ToolDot({ name }: { name: string }) {
  const colorVar = toolCategoryColor(name)
  return (
    <span
      className="inline-block h-1.25 w-1.25 shrink-0 rounded-full"
      style={{ background: colorVar }}
    />
  )
}

function toolCategoryColor(name: string): string {
  if (/read|write|list|file|search_files/.test(name)) return "var(--tool-code)"
  if (/browser|navigate|screenshot|click|hover|drag|scroll|type|extract/.test(name))
    return "var(--tool-browser)"
  if (/web_search|search/.test(name)) return "var(--tool-search)"
  if (/shell|exec|run|command|script/.test(name)) return "var(--tool-command)"
  if (/git|diff|blame|log|branch/.test(name)) return "var(--tool-json)"
  if (/pdf|doc|archive|artifact/.test(name)) return "var(--tool-doc)"
  if (/json|hash|base64|text/.test(name)) return "var(--tool-data)"
  return "var(--tool-generic)"
}

/** Badge for research-report confidence levels */
function ConfidenceBadge({ value }: { value: string }) {
  const v = value.toLowerCase()
  const cls =
    v === "high"
      ? "rk-severity-badge rk-severity-badge--green"
      : v === "medium"
        ? "rk-severity-badge rk-severity-badge--amber"
        : "rk-severity-badge rk-severity-badge--neutral"
  return <span className={cls}>{value}</span>
}

/** Badge for repo-audit / diff-review severity levels */
function SeverityBadge({ value }: { value: string }) {
  const v = value.toLowerCase()
  const cls =
    v === "high" || v === "critical"
      ? "rk-severity-badge rk-severity-badge--red"
      : v === "medium"
        ? "rk-severity-badge rk-severity-badge--amber"
        : v === "low"
          ? "rk-severity-badge rk-severity-badge--green"
          : "rk-severity-badge rk-severity-badge--neutral"
  return <span className={cls}>{value}</span>
}
