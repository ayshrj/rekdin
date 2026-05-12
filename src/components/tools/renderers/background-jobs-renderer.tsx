"use client"

import {
  EmptyState,
  RawPayloadDisclosure,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

function statusVariant(status: string | undefined) {
  if (!status) return "neutral" as const
  if (status === "completed" || status === "success") return "success" as const
  if (status === "failed" || status === "error") return "error" as const
  if (status === "running") return "info" as const
  return "neutral" as const
}

function fmtDuration(start: string | undefined, end: string | undefined): string {
  if (!start || !end) return ""
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (isNaN(ms) || ms < 0) return ""
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function BackgroundJobsRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined

  const totalJobs = typeof result?.totalJobs === "number" ? result.totalJobs : 0
  const omittedJobs = typeof result?.omittedJobs === "number" ? result.omittedJobs : 0

  const statusCounts =
    result?.statusCounts &&
    typeof result.statusCounts === "object" &&
    !Array.isArray(result.statusCounts)
      ? (result.statusCounts as Record<string, number>)
      : {}

  const jobs = Array.isArray(result?.jobs) ? (result.jobs as Record<string, unknown>[]) : []

  const completedCount = statusCounts["completed"] ?? 0
  const runningCount = statusCounts["running"] ?? 0
  const failedCount = statusCounts["failed"] ?? statusCounts["error"] ?? 0
  const pendingCount = statusCounts["pending"] ?? statusCounts["queued"] ?? 0

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">
            Background Jobs
          </span>
          <ToolStatusBadge variant="neutral">{totalJobs}</ToolStatusBadge>
          {completedCount > 0 && (
            <ToolStatusBadge variant="success">{completedCount} done</ToolStatusBadge>
          )}
          {runningCount > 0 && (
            <ToolStatusBadge variant="info">{runningCount} running</ToolStatusBadge>
          )}
          {failedCount > 0 && (
            <ToolStatusBadge variant="error">{failedCount} failed</ToolStatusBadge>
          )}
          {pendingCount > 0 && (
            <ToolStatusBadge variant="neutral">{pendingCount} pending</ToolStatusBadge>
          )}
          {omittedJobs > 0 && (
            <span className="text-muted-foreground font-mono text-[10px]">
              +{omittedJobs} omitted
            </span>
          )}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {jobs.length === 0 ? (
        <EmptyState>No jobs</EmptyState>
      ) : (
        <div className="rk-scrollbar max-h-[50vh] divide-y overflow-auto">
          {jobs.map((job, i) => {
            const status = job.status ? String(job.status) : undefined
            const workflow = job.workflowId ? String(job.workflowId) : undefined
            const mode = job.mode ? String(job.mode) : undefined
            const promptPreview = job.promptPreview ? String(job.promptPreview) : ""
            const truncatedPrompt =
              promptPreview.length > 80 ? promptPreview.slice(0, 80) + "…" : promptPreview
            const errorPreview = job.errorPreview ? String(job.errorPreview) : undefined
            const dur = fmtDuration(
              job.startedAt as string | undefined,
              job.completedAt as string | undefined
            )

            return (
              <div key={i} className="hover:bg-surface-4 px-3 py-2">
                <div className="flex items-center gap-2">
                  {status && (
                    <ToolStatusBadge variant={statusVariant(status)} className="shrink-0">
                      {status}
                    </ToolStatusBadge>
                  )}
                  {(workflow ?? mode) && (
                    <span className="rk-path-chip max-w-32 min-w-0 truncate">
                      {workflow ?? mode}
                    </span>
                  )}
                  {dur && (
                    <span className="text-muted-foreground ml-auto shrink-0 font-mono text-[10px]">
                      {dur}
                    </span>
                  )}
                </div>
                {truncatedPrompt && (
                  <p className="text-foreground/70 mt-1 font-mono text-[11px] leading-relaxed">
                    {truncatedPrompt}
                  </p>
                )}
                {errorPreview && (
                  <p className="text-destructive mt-0.5 font-mono text-[10px] leading-relaxed whitespace-pre-wrap">
                    {errorPreview}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </ToolRendererShell>
  )
}
