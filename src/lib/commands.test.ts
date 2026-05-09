import { describe, expect, it } from "vitest"

import { buildWorkflowPrompt, parseSlashCommand } from "./commands"
import { getAllWorkflowPresets, WORKFLOW_PRESETS } from "./workflows"

describe("slash commands", () => {
  it("parses supported slash commands with arguments", () => {
    const parsed = parseSlashCommand("/research Next.js 16 changes")

    expect(parsed?.command.id).toBe("research")
    expect(parsed?.command.workflowId).toBe("research-report")
    expect(parsed?.args).toBe("Next.js 16 changes")
  })

  it("ignores normal messages and unknown commands", () => {
    expect(parseSlashCommand("research Next.js")).toBeNull()
    expect(parseSlashCommand("/unknown thing")).toBeNull()
  })

  it("injects command arguments into workflow prompts", () => {
    const workflow = WORKFLOW_PRESETS.find((entry) => entry.id === "research-report")

    expect(buildWorkflowPrompt(workflow!, "AI agents")).toContain("Research AI agents carefully")
  })

  it("merges custom workflows without overriding built-in ids", () => {
    const workflows = getAllWorkflowPresets([
      {
        id: "repo-audit",
        title: "Should not override",
        description: "",
        prompt: "bad",
        mode: "workspace",
      },
      {
        id: "security-review",
        title: "Security Review",
        description: "Review security posture",
        prompt: "Inspect auth and secrets",
        mode: "workspace",
      },
    ])

    expect(workflows.some((workflow) => workflow.id === "security-review")).toBe(true)
    expect(workflows.find((workflow) => workflow.id === "repo-audit")?.title).toBe("Repo Audit")
  })
})
