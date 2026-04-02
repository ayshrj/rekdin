"use client"

import { useState } from "react"

import { Markdown } from "@/components/markdown"
import { toolLabels } from "@/components/tools/tool-labels"
import { Badge } from "@/components/ui/badge"
import { Check, ClipboardDocumentList as Copy, RekdinIcon, User } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { parseStructuredWorkflowContent } from "@/lib/workflows"
import { ChatMessage as ChatMessageType } from "@/types/chat"

interface ChatMessageProps {
  message: ChatMessageType
  showHeader?: boolean
}

export function ChatMessage({ message, showHeader = true }: ChatMessageProps) {
  const isUser = message.role === "user"
  const [copied, setCopied] = useState(false)
  const workflowId = message.metadata?.workflowId
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

  const renderStructured = () => {
    if (!structuredContent || !workflowId) return null

    const asArray = (value: unknown) => (Array.isArray(value) ? value : [])

    if (workflowId === "research-plan") {
      return (
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs uppercase">Objective</p>
            <p>
              {String(structuredContent.objective ?? structuredContent.topic ?? "Research plan")}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase">Questions</p>
            <ul className="list-disc space-y-1 pl-5">
              {asArray(structuredContent.questions).map((item, index) => (
                <li key={`q-${index}`}>{String(item)}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase">Search Queries</p>
            <div className="flex flex-wrap gap-2">
              {asArray(structuredContent.searchQueries).map((item, index) => (
                <Badge key={`sq-${index}`} variant="secondary">
                  {String(item)}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase">Deliverables</p>
            <ul className="list-disc space-y-1 pl-5">
              {asArray(structuredContent.deliverables).map((item, index) => (
                <li key={`d-${index}`}>{String(item)}</li>
              ))}
            </ul>
          </div>
        </div>
      )
    }

    if (workflowId === "research-report") {
      const findings = asArray(structuredContent.keyFindings)
      const sources = asArray(structuredContent.sources)
      return (
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-base font-semibold">
              {String(structuredContent.title ?? "Research Report")}
            </p>
            <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
              {String(structuredContent.executiveSummary ?? "")}
            </p>
          </div>
          {findings.length > 0 ? (
            <div>
              <p className="text-muted-foreground text-xs uppercase">Key Findings</p>
              <div className="mt-2 space-y-2">
                {findings.map((item, index) => {
                  const finding = item as Record<string, unknown>
                  return (
                    <div key={`finding-${index}`} className="rounded-xl border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">
                          {String(finding.claim ?? `Finding ${index + 1}`)}
                        </p>
                        <Badge variant="outline">{String(finding.confidence ?? "unknown")}</Badge>
                      </div>
                      <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
                        {String(finding.evidence ?? "")}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
          {sources.length > 0 ? (
            <div>
              <p className="text-muted-foreground text-xs uppercase">Sources</p>
              <div className="mt-2 space-y-2">
                {sources.map((item, index) => {
                  const source = item as Record<string, unknown>
                  const url = String(source.url ?? "")
                  return (
                    <div key={`source-${index}`} className="rounded-xl border p-3">
                      <a
                        className="font-medium underline underline-offset-4"
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {String(source.title ?? url)}
                      </a>
                      <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
                        {String(source.whyItMatters ?? "")}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      )
    }

    if (workflowId === "repo-audit" || workflowId === "diff-review") {
      const findings = asArray(
        workflowId === "repo-audit" ? structuredContent.risks : structuredContent.findings
      )
      const nextSteps = asArray(
        workflowId === "repo-audit"
          ? structuredContent.recommendedNextSteps
          : structuredContent.validation
      )
      return (
        <div className="space-y-3 text-sm">
          <p className="whitespace-pre-wrap">
            {String(structuredContent.summary ?? "Structured workflow result")}
          </p>
          {asArray(structuredContent.entryPoints).length > 0 ? (
            <div>
              <p className="text-muted-foreground text-xs uppercase">Entry Points</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {asArray(structuredContent.entryPoints).map((item, index) => (
                  <Badge key={`ep-${index}`} variant="secondary">
                    {String(item)}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
          {findings.length > 0 ? (
            <div>
              <p className="text-muted-foreground text-xs uppercase">Findings</p>
              <div className="mt-2 space-y-2">
                {findings.map((item, index) => {
                  const finding = item as Record<string, unknown>
                  return (
                    <div key={`review-${index}`} className="rounded-xl border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">
                          {String(finding.title ?? `Item ${index + 1}`)}
                        </p>
                        <Badge variant="outline">
                          {String(finding.severity ?? finding.priority ?? "info")}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
                        {String(finding.reason ?? finding.detail ?? "")}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
          {nextSteps.length > 0 ? (
            <div>
              <p className="text-muted-foreground text-xs uppercase">
                {workflowId === "repo-audit" ? "Recommended Next Steps" : "Validation"}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {nextSteps.map((item, index) => (
                  <li key={`step-${index}`}>{String(item)}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )
    }

    return null
  }

  return (
    <div className={cn("group relative flex w-full flex-col gap-1.5", isUser && "items-end")}>
      {!isUser && (
        <button
          onClick={copyToClipboard}
          className="hover:bg-muted text-muted-foreground/40 hover:text-foreground absolute -top-1 right-0 rounded-md p-1.5 opacity-0 transition-all group-hover:opacity-100"
          aria-label="Copy message"
        >
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        </button>
      )}
      {showHeader ? (
        <div
          className={cn(
            "text-muted-foreground flex items-center gap-2 text-xs",
            isUser && "ml-auto w-fit flex-row-reverse text-right"
          )}
        >
          <div
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
              isUser ? "bg-primary/20" : "bg-primary/10"
            )}
          >
            {isUser ? (
              <User className="h-3 w-3" />
            ) : (
              <RekdinIcon className="text-primary h-3 w-3" />
            )}
          </div>
          <span className="text-[11px] font-medium">{isUser ? "You" : "Rekdin"}</span>
          {message.metadata?.agentType && !isUser ? (
            <Badge variant="outline" className="text-[0.65rem] tracking-wide uppercase">
              {message.metadata.agentType}
            </Badge>
          ) : null}
        </div>
      ) : null}
      <div
        className={cn(
          "overflow-hidden transition",
          isUser
            ? "bg-primary text-primary-foreground ml-auto max-w-[82%] rounded-2xl px-4 py-3 shadow-sm"
            : "w-full px-0 py-0"
        )}
      >
        <div className="flex min-w-0 flex-col gap-2 overflow-x-hidden">
          {isUser ? (
            <p className="text-left text-sm wrap-anywhere whitespace-pre-wrap">{message.content}</p>
          ) : (
            (renderStructured() ?? (
              <Markdown className="max-w-none text-sm wrap-anywhere">
                {message.content || "_(no response)_"}
              </Markdown>
            ))
          )}

          {message.attachments && message.attachments.length > 0 ? (
            <div className={cn("flex flex-wrap gap-2", isUser && "justify-end")}>
              {message.attachments.map((file) => (
                <a key={file} href={file} target="_blank" rel="noreferrer">
                  <Badge variant="secondary">{file}</Badge>
                </a>
              ))}
            </div>
          ) : null}

          {message.toolCalls && message.toolCalls.length > 0 && (
            <details className="mt-2">
              <summary className="border-primary/30 text-muted-foreground hover:text-foreground cursor-pointer list-none border-l-2 pl-2 text-[11px] font-medium select-none">
                {message.toolCalls.length} tool call
                {message.toolCalls.length > 1 ? "s" : ""}
              </summary>
              <div className="border-primary/15 mt-1 flex flex-wrap gap-1.5 border-l-2 pt-1 pl-2">
                {message.toolCalls.map((call) => (
                  <span
                    key={call.id ?? call.name}
                    className="bg-muted/60 text-muted-foreground rounded-md border px-2 py-0.5 text-[11px]"
                  >
                    {toolLabels[call.name] ?? call.name}
                  </span>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  )
}
