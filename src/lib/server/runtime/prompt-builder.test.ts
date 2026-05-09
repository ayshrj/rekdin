import path from "path"
import { describe, expect, it } from "vitest"

import { buildSystemPrompt } from "./prompt-builder"

describe("buildSystemPrompt", () => {
  it("builds a sectioned prompt with mode and schema guidance", async () => {
    const prompt = await buildSystemPrompt({
      mode: "research",
      toolPolicy: "balanced",
      responseSchema: {
        type: "object",
        properties: {
          answer: { type: "string" },
        },
      },
    })

    expect(prompt).toContain("## Identity")
    expect(prompt).toContain("## Tool Policy")
    expect(prompt).toContain("## Workflow Rules")
    expect(prompt).toContain("## Workspace Context")
    expect(prompt).toContain("source-grounded")
    expect(prompt).toContain("recent or external facts")
    expect(prompt).toContain("JSON schema exactly")
    expect(prompt).toContain("Do not claim the task is complete")
  })

  it("anchors workspace mode to the current repository", async () => {
    const prompt = await buildSystemPrompt({
      mode: "workspace",
      toolPolicy: "balanced",
      workspaceRoot: process.cwd(),
    })

    expect(prompt).toContain("current local project repository")
    expect(prompt).toContain(`Current workspace root: ${process.cwd()}`)
    expect(prompt).toContain("Do not ask the user to confirm the workspace path")
  })

  it("uses the explicit selected workspace when provided", async () => {
    const selectedWorkspace = path.resolve("/tmp/rekdin-selected-workspace")
    const prompt = await buildSystemPrompt({
      mode: "workspace",
      toolPolicy: "balanced",
      workspaceRoot: selectedWorkspace,
    })

    expect(prompt).toContain(`Current workspace root: ${selectedWorkspace}`)
  })
})
