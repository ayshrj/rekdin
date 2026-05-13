import { stat } from "fs/promises"
import { z } from "zod"

import { resolveWorkspacePath } from "../../workspace"
import { gitOutput } from "../shared/command"
import { previewString, truncateString } from "../shared/formatting"
import { emptySchema, type Finding, finding, toolDefinition } from "../shared/tool-base"

export const agentPlanCreateTool = toolDefinition(
  "agent_plan_create",
  "Create a structured implementation plan from a user request.",
  z.object({ request: z.string().min(1) }),
  async ({ request }) => ({
    type: "agent_plan_create",
    goal: previewString(request, 300),
    filesToInspect: ["src/lib/server/tools/index.ts", "src/lib/server/runtime/tool-policy.ts"],
    filesToModify: [],
    risks: ["Scope may cross runtime, policy, renderer, and tests."],
    steps: [
      { status: "pending", step: "Inspect existing implementation and ownership boundaries." },
      { status: "pending", step: "Make the smallest coherent code change." },
      { status: "pending", step: "Run targeted validation and summarize residual risk." },
    ],
  })
)

export const agentPlanCheckTool = toolDefinition(
  "agent_plan_check",
  "Validate whether a plan references existing files and feasible paths.",
  z.object({ plan: z.string().min(1) }),
  async ({ plan }) => {
    const paths = Array.from(plan.matchAll(/(?:src|docs|app|lib)\/[A-Za-z0-9_./-]+/g)).map(
      (m) => m[0]
    )
    const findings: Finding[] = []
    for (const pathName of paths.slice(0, 100)) {
      const exists = await stat(resolveWorkspacePath(pathName))
        .then(() => true)
        .catch(() => false)
      if (!exists)
        findings.push(
          finding("warning", pathName, undefined, "Plan references a file that does not exist.")
        )
    }
    return { type: "agent_plan_check", checkedPaths: paths, findings }
  }
)

export const agentWorklogTool = toolDefinition(
  "agent_worklog",
  "Summarize current git worklog signals for resumability.",
  emptySchema,
  async () => {
    const status = await gitOutput("git status --short")
    return {
      type: "agent_worklog",
      changedFiles: status.stdout.split(/\r?\n/).filter(Boolean).slice(0, 200),
      completed: [],
      pending: [],
      blocked: status.exitCode === 0 ? [] : [status.stderr],
    }
  }
)

export const agentSelfCheckTool = toolDefinition(
  "agent_self_check",
  "Check current diff and validation state before a final response.",
  emptySchema,
  async () => {
    const status = await gitOutput("git status --short")
    const findings: Finding[] = []
    if (!status.stdout.trim())
      findings.push(finding("info", "git", undefined, "No changed files detected."))
    if (/\.env/.test(status.stdout))
      findings.push(
        finding(
          "error",
          ".env",
          undefined,
          "Environment file appears in git status; verify secrets are not committed."
        )
      )
    return {
      type: "agent_self_check",
      findings,
      changedFiles: status.stdout.split(/\r?\n/).filter(Boolean),
    }
  }
)

export const agentDiffReviewTool = toolDefinition(
  "agent_diff_review",
  "Review the current git diff and return senior-engineer risk findings.",
  emptySchema,
  async () => {
    const diff = await gitOutput("git diff --stat && git diff -- src package.json", 30_000)
    const findings: Finding[] = []
    if (/tool-policy|tools\/index|runtime/.test(diff.stdout))
      findings.push(
        finding(
          "warning",
          "runtime/tools",
          undefined,
          "Runtime or tool registry changed; verify policy, approval, and replay visibility."
        )
      )
    if (/TODO|FIXME|console\.log/.test(diff.stdout))
      findings.push(
        finding("info", "diff", undefined, "Diff includes TODO/FIXME/console.log markers.")
      )
    return { type: "agent_diff_review", findings, diffPreview: truncateString(diff.stdout, 12_000) }
  }
)

export const agentRegressionRiskTool = toolDefinition(
  "agent_regression_risk",
  "Predict features that might regress from changed files.",
  emptySchema,
  async () => {
    const status = await gitOutput("git status --short")
    const risks = status.stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const file = line.slice(3)
        const features = [
          file.includes("chat") ? "chat streaming/rendering" : "",
          file.includes("tools") ? "tool execution/rendering" : "",
          file.includes("runtime") ? "agent runtime/policy" : "",
          file.includes("settings") ? "settings persistence" : "",
        ].filter(Boolean)
        return {
          file,
          severity: features.length ? "medium" : "low",
          reason: features.join(", ") || "localized file change",
        }
      })
    return { type: "agent_regression_risk", risks }
  }
)
