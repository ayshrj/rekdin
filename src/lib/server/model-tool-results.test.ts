import { describe, expect, it } from "vitest"

import { createModelToolMessageContent } from "./model-tool-results"

describe("model-facing tool result compaction", () => {
  it("preserves exact small file reads", () => {
    const result = createModelToolMessageContent(
      "file_read",
      { type: "file_read", path: "src/a.ts", content: "export const a = 1" },
      "current"
    )

    expect(JSON.parse(result.content)).toEqual({
      type: "file_read",
      path: "src/a.ts",
      content: "export const a = 1",
    })
    expect(result.tokens).toBe(result.originalTokens)
  })

  it("compacts large file reads with metadata and a preview", () => {
    const result = createModelToolMessageContent(
      "file_read",
      { type: "file_read", path: "src/large.ts", content: "const value = 1\n".repeat(5000) },
      "history"
    )
    const parsed = JSON.parse(result.content) as Record<string, unknown>

    expect(result.tokens).toBeLessThan(result.originalTokens)
    expect(parsed.path).toBe("src/large.ts")
    expect(parsed.contentPreview).toBeTypeOf("string")
    expect(parsed.contentSha256).toBeTypeOf("string")
  })

  it("summarizes broad list and search outputs", () => {
    const files = Array.from({ length: 120 }, (_, index) => ({
      path: `src/file-${index}.ts`,
      type: "file",
      size: index,
    }))
    const list = JSON.parse(
      createModelToolMessageContent("list_files", { type: "list_files", files }, "history").content
    )
    expect(list.totalEntries).toBe(120)
    expect(list.entries.length).toBeLessThan(120)
    expect(list.omittedEntries).toBeGreaterThan(0)

    const matches = Array.from({ length: 60 }, (_, index) => ({
      file: `src/file-${index}.ts`,
      line: index + 1,
      text: "TODO: inspect",
    }))
    const search = JSON.parse(
      createModelToolMessageContent(
        "file_search",
        { type: "file_search", query: "TODO", matches },
        "history"
      ).content
    )
    expect(search.totalMatches).toBe(60)
    expect(search.matches.length).toBeLessThan(60)
  })

  it("omits base64 and screenshot payloads", () => {
    const download = JSON.parse(
      createModelToolMessageContent(
        "download_fetch",
        { type: "download_fetch", url: "https://example.com/a.png", base64: "a".repeat(20_000) },
        "current"
      ).content
    )
    expect(download.base64Omitted).toContain("chars")
    expect(download.base64).toBeUndefined()

    const browser = JSON.parse(
      createModelToolMessageContent(
        "browser_screenshot",
        { type: "browser_screenshot", screenshot: "data:image/png;base64," + "a".repeat(20_000) },
        "current"
      ).content
    )
    expect(browser.screenshot).toContain("omitted")
  })

  it("summarizes HTTP bodies and command output", () => {
    const http = JSON.parse(
      createModelToolMessageContent(
        "http_request",
        {
          type: "http_request",
          status: 200,
          headers: { "content-type": "application/json", server: "hidden" },
          bodyText: '{"items":[' + '"x",'.repeat(5000) + "]}",
        },
        "history"
      ).content
    )
    expect(http.headers.server).toBeUndefined()
    expect(http.bodyPreview).toBeTypeOf("string")

    const command = JSON.parse(
      createModelToolMessageContent(
        "execute_command",
        { type: "execute_command", command: "npm test", stdout: "ok\n".repeat(5000), stderr: "" },
        "history"
      ).content
    )
    expect(command.stdout.preview).toBeTypeOf("string")
    expect(command.stdout.truncated).toBe(true)
  })

  it("summarizes new high-volume structured tool outputs", () => {
    const graph = JSON.parse(
      createModelToolMessageContent(
        "dependency_graph",
        {
          type: "dependency_graph",
          nodes: Array.from({ length: 200 }, (_, index) => `src/${index}.ts`),
          edges: Array.from({ length: 500 }, (_, index) => ({
            from: `src/${index}.ts`,
            to: `src/${index + 1}.ts`,
          })),
        },
        "history"
      ).content
    )
    expect(graph.nodes.length).toBeLessThan(200)
    expect(graph.edges.length).toBeLessThan(500)

    const pdf = JSON.parse(
      createModelToolMessageContent(
        "pdf_extract_text",
        { type: "pdf_extract_text", text: "long pdf text\n".repeat(5000), pages: 5 },
        "history"
      ).content
    )
    expect(pdf.text).toBeUndefined()
    expect(pdf.textPreview).toBeTypeOf("string")

    const ocr = JSON.parse(
      createModelToolMessageContent(
        "image_ocr",
        { type: "image_ocr", text: "recognized image text\n".repeat(5000), confidence: 91 },
        "history"
      ).content
    )
    expect(ocr.text).toBeUndefined()
    expect(ocr.textPreview).toBeTypeOf("string")

    const browserLogs = JSON.parse(
      createModelToolMessageContent(
        "browser_console_logs",
        {
          type: "browser_console_logs",
          logs: Array.from({ length: 100 }, (_, index) => ({ type: "log", text: `line ${index}` })),
        },
        "history"
      ).content
    )
    expect(browserLogs.logs.length).toBeLessThan(100)
    expect(browserLogs.omittedLogs).toBeGreaterThan(0)
  })

  it("compacts inspectability tool outputs for model context", () => {
    const replay = JSON.parse(
      createModelToolMessageContent(
        "replay_summary",
        {
          type: "replay_summary",
          sessionId: "s1",
          toolTimeline: Array.from({ length: 80 }, (_, index) => ({
            id: `evt-${index}`,
            toolName: "file_read",
            dataPreview: "large event preview ".repeat(400),
          })),
          slowestSteps: Array.from({ length: 20 }, (_, index) => ({ id: `slow-${index}` })),
        },
        "history"
      ).content
    )
    expect(replay.toolTimeline.length).toBeLessThan(80)
    expect(replay.omittedToolTimeline).toBeGreaterThan(0)
    expect(replay.slowestSteps.length).toBeLessThanOrEqual(8)

    const trace = JSON.parse(
      createModelToolMessageContent(
        "trace_summary",
        {
          type: "trace_summary",
          sessionId: "s1",
          traces: Array.from({ length: 60 }, (_, index) => ({
            id: `trace-${index}`,
            warnings: ["warning ".repeat(500)],
          })),
          tokenUsage: { totalTokens: 123 },
        },
        "history"
      ).content
    )
    expect(trace.traces.length).toBeLessThan(60)
    expect(trace.omittedTraces).toBeGreaterThan(0)
    expect(trace.tokenUsage.totalTokens).toBe(123)

    const tokens = JSON.parse(
      createModelToolMessageContent(
        "token_usage_report",
        {
          type: "token_usage_report",
          bySession: Array.from({ length: 60 }, (_, index) => ({
            sessionId: `s-${index}`,
            title: "Session ".repeat(400),
          })),
        },
        "history"
      ).content
    )
    expect(tokens.bySession.length).toBeLessThan(60)
    expect(tokens.omittedBySession).toBeGreaterThan(0)
  })
})
