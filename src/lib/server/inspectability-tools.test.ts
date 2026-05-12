import { mkdtemp } from "fs/promises"
import os from "os"
import path from "path"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ChatMessage } from "@/types/chat"

const ORIGINAL_DATA_DIR = process.env.REKDIN_DATA_DIR

async function loadFresh(dataDir: string) {
  process.env.REKDIN_DATA_DIR = dataDir
  vi.resetModules()
  const stores = {
    session: await import("./session-store"),
    replay: await import("./replay-store"),
    trace: await import("./trace-store"),
    background: await import("./background-job-store"),
    settings: await import("./settings-store"),
  }
  const tools = await import("./tools")
  return { stores, tools }
}

function resetGlobals() {
  delete globalThis.__SESSION_STORE
  delete globalThis.__REPLAY_STORE
  delete globalThis.__REKDIN_TRACE_STORE
  delete globalThis.__REKDIN_BACKGROUND_JOB_STORE
  delete globalThis.__REKDIN_SETTINGS_STORE
}

describe("inspectability tools", () => {
  afterEach(() => {
    vi.resetModules()
    resetGlobals()
    if (ORIGINAL_DATA_DIR === undefined) {
      delete process.env.REKDIN_DATA_DIR
    } else {
      process.env.REKDIN_DATA_DIR = ORIGINAL_DATA_DIR
    }
  })

  it("summarizes sessions, replays, traces, jobs, tokens, and settings without leaking secrets", async () => {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), "rekdin-inspect-tools-"))
    const { stores, tools } = await loadFresh(dataDir)
    const sessionId = "inspect-session"
    const userMessage: ChatMessage = {
      id: "msg-user",
      sessionId,
      role: "user",
      content: "Please inspect this run. ".repeat(80),
      timestamp: "2026-05-12T00:00:00.000Z",
      attachments: ["artifact://one"],
      metadata: { tokens: 12, toolPolicy: "read_only" },
    }
    const assistantMessage: ChatMessage = {
      id: "msg-assistant",
      sessionId,
      role: "assistant",
      content: "Finished inspection. ".repeat(120),
      timestamp: "2026-05-12T00:00:05.000Z",
      toolCalls: [
        {
          id: "call-1",
          name: "file_read",
          arguments: { path: "src/app.ts" },
          result: { type: "file_read", path: "src/app.ts", content: "secret body".repeat(500) },
          timestamp: "2026-05-12T00:00:01.000Z",
          duration: 250,
          status: "success",
        },
      ],
      metadata: { tokens: 34, model: "gpt-test", agentType: "workspace" },
    }

    await stores.session.getSessionStore().saveMessage(sessionId, userMessage, "Inspect Session")
    await stores.session.getSessionStore().saveMessage(sessionId, assistantMessage)
    await stores.replay.getReplayStore().record(sessionId, "tool_call", {
      toolCall: {
        id: "call-1",
        name: "file_read",
        arguments: { path: "src/app.ts" },
        status: "running",
      },
    })
    await stores.replay.getReplayStore().record(sessionId, "tool_result", {
      toolCall: {
        id: "call-1",
        name: "file_read",
        arguments: { path: "src/app.ts" },
        result: { type: "file_read", content: "large replay body ".repeat(800) },
        status: "success",
        duration: 250,
      },
    })
    await stores.trace.getTraceStore().append(sessionId, {
      startedAt: "2026-05-12T00:00:00.000Z",
      completedAt: "2026-05-12T00:00:05.000Z",
      mode: "workspace",
      toolPolicy: "read_only",
      provider: "openai",
      model: "gpt-test",
      warnings: ["low confidence warning ".repeat(40)],
      toolCount: 1,
      totalToolDurationMs: 250,
      responseSchemaApplied: false,
      retryCount: 1,
      success: true,
      workflowId: "repo-audit",
      tokenUsageEstimate: {
        systemPromptTokens: 10,
        historyTokens: 20,
        toolSchemaTokens: 30,
        toolResultTokens: 40,
        originalToolResultTokens: 400,
        savedToolResultTokens: 360,
        completionTokens: 50,
        totalPromptTokens: 100,
        totalTokens: 150,
      },
    })
    await stores.background.getBackgroundJobStore().create({
      sessionId,
      prompt: "Run background inspection ".repeat(100),
      mode: "research",
      toolPolicy: "read_only",
      workflowId: "research-report",
      status: "completed",
      startedAt: "2026-05-12T00:00:02.000Z",
      completedAt: "2026-05-12T00:00:06.000Z",
    })
    await stores.settings.getSettingsStore().save({
      llmProvider: "openai",
      openAIApiKey: "sk-test-secret",
      openAIModel: "gpt-test",
      cloudinaryCloudName: "demo-cloud",
      cloudinaryApiKey: "cloudinary-key",
      cloudinaryApiSecret: "cloudinary-secret",
      customWorkflows: [
        {
          id: "custom-inspect",
          title: "Custom Inspect",
          description: "Inspect",
          prompt: "Do not leak secrets",
          mode: "workspace",
          category: "workspace",
          supportsBackground: true,
          custom: true,
        },
      ],
    })

    const sessions = (await tools.sessionListTool.invoke({ limit: 5 })) as {
      type: string
      sessions: Array<{ id: string; lastUserPromptPreview: string; toolCallCount: number }>
    }
    expect(sessions.type).toBe("session_list")
    expect(sessions.sessions[0]?.id).toBe(sessionId)
    expect(sessions.sessions[0]?.lastUserPromptPreview.length).toBeLessThan(390)
    expect(sessions.sessions[0]?.toolCallCount).toBe(1)

    const inspected = (await tools.sessionInspectTool.invoke({ sessionId, messageLimit: 1 })) as {
      messages: Array<{ contentPreview: string; contentChars: number }>
      omittedMessages: number
      toolCallNameCounts: Record<string, number>
    }
    expect(inspected.messages).toHaveLength(1)
    expect(inspected.messages[0]?.contentChars).toBeGreaterThan(
      inspected.messages[0]?.contentPreview.length ?? 0
    )
    expect(inspected.omittedMessages).toBe(1)
    expect(inspected.toolCallNameCounts.file_read).toBe(1)

    const replay = (await tools.replaySummaryTool.invoke({ sessionId })) as {
      found: boolean
      toolTimeline: Array<{ toolName?: string; dataPreview: string }>
    }
    expect(replay.found).toBe(true)
    expect(replay.toolTimeline[0]?.toolName).toBe("file_read")
    expect(replay.toolTimeline[0]?.dataPreview.length).toBeLessThan(750)

    const search = (await tools.replaySearchTool.invoke({
      sessionId,
      toolName: "file_read",
      limit: 1,
    })) as { totalMatches: number; matches: unknown[]; omittedMatches: number }
    expect(search.totalMatches).toBe(2)
    expect(search.matches).toHaveLength(1)
    expect(search.omittedMatches).toBe(1)

    const traces = (await tools.traceSummaryTool.invoke({ sessionId })) as {
      traceCount: number
      tokenUsage: { totalTokens: number }
      warnings: string[]
    }
    expect(traces.traceCount).toBe(1)
    expect(traces.tokenUsage.totalTokens).toBe(150)
    expect(traces.warnings[0]?.length).toBeLessThan(260)

    const tokens = (await tools.tokenUsageReportTool.invoke({ sessionId })) as {
      sessionCount: number
      traceTokenUsage: { originalToolResultTokens: number }
    }
    expect(tokens.sessionCount).toBe(1)
    expect(tokens.traceTokenUsage.originalToolResultTokens).toBe(400)

    const jobs = (await tools.backgroundJobsSummaryTool.invoke({ sessionId })) as {
      totalJobs: number
      jobs: Array<{ promptPreview: string; promptChars: number }>
    }
    expect(jobs.totalJobs).toBe(1)
    expect(jobs.jobs[0]?.promptChars).toBeGreaterThan(jobs.jobs[0]?.promptPreview.length ?? 0)

    const settings = await tools.settingsSummaryTool.invoke({})
    const settingsJson = JSON.stringify(settings)
    expect(settingsJson).not.toContain("sk-test-secret")
    expect(settingsJson).not.toContain("cloudinary-secret")
    expect(settingsJson).not.toContain("cloudinary-key")
    expect(settingsJson).toContain('"selectedProvider":"openai"')
    expect(settingsJson).toContain('"selectedProviderReady":true')
  })
})
