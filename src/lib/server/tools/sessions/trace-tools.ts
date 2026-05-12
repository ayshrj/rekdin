import { tool } from "@langchain/core/tools"
import { z } from "zod"

import { BackgroundJob, TurnTrace } from "@/types/runtime"

import { getBackgroundJobStore } from "../../background-job-store"
import { getSessionStore } from "../../session-store"
import { getTraceStore } from "../../trace-store"
import { boundedLimit, previewString } from "../shared/formatting"

function compactTrace(trace: TurnTrace) {
  return {
    id: trace.id,
    startedAt: trace.startedAt,
    completedAt: trace.completedAt,
    mode: trace.mode,
    toolPolicy: trace.toolPolicy,
    provider: trace.provider,
    model: trace.model,
    workflowId: trace.workflowId,
    success: trace.success,
    toolCount: trace.toolCount,
    totalToolDurationMs: trace.totalToolDurationMs,
    retryCount: trace.retryCount,
    responseSchemaApplied: trace.responseSchemaApplied,
    warnings: trace.warnings.slice(0, 8).map((warning) => previewString(warning, 240)),
    omittedWarnings: Math.max(trace.warnings.length - 8, 0),
    error: trace.error ? previewString(trace.error, 300) : undefined,
    tokenUsageEstimate: trace.tokenUsageEstimate,
  }
}

function aggregateTokenUsage(traces: TurnTrace[]) {
  return traces.reduce(
    (total, trace) => {
      const usage = trace.tokenUsageEstimate
      if (!usage) return total
      total.systemPromptTokens += usage.systemPromptTokens
      total.historyTokens += usage.historyTokens
      total.toolSchemaTokens += usage.toolSchemaTokens
      total.toolResultTokens += usage.toolResultTokens
      total.originalToolResultTokens += usage.originalToolResultTokens
      total.savedToolResultTokens += usage.savedToolResultTokens
      total.completionTokens += usage.completionTokens
      total.totalPromptTokens += usage.totalPromptTokens
      total.totalTokens += usage.totalTokens
      total.tracesWithUsage += 1
      return total
    },
    {
      tracesWithUsage: 0,
      systemPromptTokens: 0,
      historyTokens: 0,
      toolSchemaTokens: 0,
      toolResultTokens: 0,
      originalToolResultTokens: 0,
      savedToolResultTokens: 0,
      completionTokens: 0,
      totalPromptTokens: 0,
      totalTokens: 0,
    }
  )
}

function compactBackgroundJob(job: BackgroundJob) {
  return {
    id: job.id,
    sessionId: job.sessionId,
    status: job.status,
    mode: job.mode,
    toolPolicy: job.toolPolicy,
    workflowId: job.workflowId,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    resultMessageId: job.resultMessageId,
    promptPreview: previewString(job.prompt, 360),
    promptChars: job.prompt.length,
    responseSchemaApplied: Boolean(job.responseSchema),
    errorPreview: job.error ? previewString(job.error, 360) : undefined,
  }
}

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1
    return counts
  }, {})
}

export const traceSummaryTool = tool(
  async ({ sessionId, limit }: { sessionId: string; limit?: number }) => {
    const limitValue = boundedLimit(limit, 20, 100)
    const traces = await getTraceStore().list(sessionId)
    const selected = traces.slice(-limitValue)
    const warnings = traces.flatMap((trace) => trace.warnings)
    return {
      type: "trace_summary",
      sessionId,
      traceCount: traces.length,
      returnedTraceCount: selected.length,
      omittedTraces: Math.max(traces.length - selected.length, 0),
      successCount: traces.filter((trace) => trace.success).length,
      failureCount: traces.filter((trace) => !trace.success).length,
      providerCounts: countBy(traces.map((trace) => trace.provider)),
      modelCounts: countBy(traces.map((trace) => trace.model)),
      workflowCounts: countBy(traces.map((trace) => trace.workflowId ?? "none")),
      totalToolCount: traces.reduce((total, trace) => total + trace.toolCount, 0),
      totalToolDurationMs: traces.reduce(
        (total, trace) => total + (trace.totalToolDurationMs ?? 0),
        0
      ),
      totalRetries: traces.reduce((total, trace) => total + trace.retryCount, 0),
      warnings: warnings.slice(0, 20).map((warning) => previewString(warning, 240)),
      omittedWarnings: Math.max(warnings.length - 20, 0),
      errors: traces
        .filter((trace) => trace.error)
        .slice(0, 20)
        .map((trace) => ({
          traceId: trace.id,
          startedAt: trace.startedAt,
          error: previewString(trace.error, 360),
        })),
      tokenUsage: aggregateTokenUsage(traces),
      traces: selected.map(compactTrace),
    }
  },
  {
    name: "trace_summary",
    description:
      "Summarize runtime traces for one session with provider/model, duration, tools, token estimates, retries, warnings, and errors.",
    schema: z.object({
      sessionId: z.string().min(1),
      limit: z.number().int().positive().max(100).optional(),
    }),
  }
)

export const tokenUsageReportTool = tool(
  async ({ sessionId, limit }: { sessionId?: string; limit?: number }) => {
    const limitValue = boundedLimit(limit, 20, 100)
    const sessions = sessionId
      ? [await getSessionStore().getSession(sessionId)].filter((session) => Boolean(session))
      : (await getSessionStore().listSessions()).slice(0, limitValue)
    const allTraces: TurnTrace[] = []
    const bySession = []

    for (const session of sessions) {
      if (!session) continue
      const traces = await getTraceStore().list(session.id)
      allTraces.push(...traces)
      bySession.push({
        sessionId: session.id,
        title: session.title,
        updatedAt: session.updatedAt,
        sessionTotalTokens: session.metadata?.totalTokens ?? 0,
        messageCount: session.metadata?.messageCount ?? session.messages.length,
        traceCount: traces.length,
        traceTokenUsage: aggregateTokenUsage(traces),
      })
    }

    return {
      type: "token_usage_report",
      sessionId: sessionId ?? null,
      sessionCount: bySession.length,
      traceCount: allTraces.length,
      totalSessionTokens: bySession.reduce(
        (total, session) => total + session.sessionTotalTokens,
        0
      ),
      traceTokenUsage: aggregateTokenUsage(allTraces),
      bySession,
    }
  },
  {
    name: "token_usage_report",
    description:
      "Aggregate trace/session token metadata across recent sessions or one session without dumping message bodies.",
    schema: z.object({
      sessionId: z.string().min(1).optional(),
      limit: z.number().int().positive().max(100).optional(),
    }),
  }
)

export const backgroundJobsSummaryTool = tool(
  async ({ sessionId, limit }: { sessionId?: string; limit?: number }) => {
    const limitValue = boundedLimit(limit, 20, 100)
    const jobs = sessionId
      ? await getBackgroundJobStore().listBySession(sessionId)
      : await getBackgroundJobStore().list()
    const selected = jobs.slice(0, limitValue)
    return {
      type: "background_jobs_summary",
      sessionId: sessionId ?? null,
      totalJobs: jobs.length,
      statusCounts: countBy(jobs.map((job) => job.status)),
      workflowCounts: countBy(jobs.map((job) => job.workflowId ?? "none")),
      jobs: selected.map(compactBackgroundJob),
      omittedJobs: Math.max(jobs.length - selected.length, 0),
    }
  },
  {
    name: "background_jobs_summary",
    description:
      "List Rekdin background jobs globally or by session with status, workflow, timestamps, error preview, and prompt preview.",
    schema: z.object({
      sessionId: z.string().min(1).optional(),
      limit: z.number().int().positive().max(100).optional(),
    }),
  }
)
