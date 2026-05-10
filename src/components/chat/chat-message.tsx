"use client"

import { useState } from "react"

import { Markdown } from "@/components/markdown"
import { toolLabels } from "@/components/tools/tool-labels"
import { Check, ClipboardDocumentList as Copy, RekdinIcon, User } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { getWorkflowPreset, parseStructuredWorkflowContent } from "@/lib/workflows"
import { ChatMessage as ChatMessageType } from "@/types/chat"

interface ChatMessageProps {
  message: ChatMessageType
  showHeader?: boolean
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

/**
 * Renders a persisted chat message, including workflow-aware structured output blocks for
 * selected assistant responses.
 */
export function ChatMessage({ message, showHeader = true }: ChatMessageProps) {
  const isUser = message.role === "user"
  const [copied, setCopied] = useState(false)
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

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={cn("rk-msg-root group", isUser && "items-end")}>
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
        </div>
      )}

      {/* Message body */}
      <div className={cn("rk-msg-body", isUser ? "rk-msg-body--user" : "rk-msg-body--ai")}>
        <div className="flex min-w-0 flex-col gap-2 overflow-x-hidden">
          {isUser ? (
            <p className="text-left text-sm leading-relaxed wrap-anywhere whitespace-pre-wrap">
              {message.content}
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
      className="inline-block h-[5px] w-[5px] shrink-0 rounded-full"
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
