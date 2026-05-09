import path from "path"
import { describe, expect, it } from "vitest"

import { ChatMessage } from "@/types/chat"

import { withCurrentWorkspaceContext } from "./agent-runtime"

describe("agent runtime context preparation", () => {
  it("inserts the authoritative workspace before the latest user message", () => {
    const workspaceRoot = path.resolve("/tmp/rekdin-selected-workspace")

    const messages: ChatMessage[] = [
      {
        id: "old-user",
        sessionId: "session-1",
        role: "user",
        content: "what is the current workspace?",
        timestamp: new Date().toISOString(),
      },
      {
        id: "old-assistant",
        sessionId: "session-1",
        role: "assistant",
        content: `The current workspace is ${process.cwd()}`,
        timestamp: new Date().toISOString(),
      },
      {
        id: "new-user",
        sessionId: "session-1",
        role: "user",
        content: "what is the current workspace?",
        timestamp: new Date().toISOString(),
      },
    ]

    const prepared = withCurrentWorkspaceContext(messages, workspaceRoot)
    const latestUserIndex = prepared.findLastIndex((message) => message.role === "user")
    const workspaceMessage = prepared[latestUserIndex - 1]

    expect(workspaceMessage.role).toBe("system")
    expect(workspaceMessage.content).toContain(`Current workspace root: ${workspaceRoot}`)
    expect(workspaceMessage.content).toContain("Ignore older assistant messages")
    expect(prepared[latestUserIndex].id).toBe("new-user")
  })
})
