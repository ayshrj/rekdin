import { stat } from "fs/promises"

import { resolveWorkspacePath } from "../../workspace"
import { architectureSummaryTool } from "../code/architecture-tools"
import { envUsageAuditTool } from "../security/security-tools"
import { collectTextFiles, linesOf, readBounded } from "../shared/code-utils"
import { gitOutput } from "../shared/command"
import { boundedLimit } from "../shared/formatting"
import { unifiedPatch } from "../shared/patching"
import { dryRunSchema, emptySchema, pathLimitSchema, toolDefinition } from "../shared/tool-base"
import { readPackageJson } from "../workspace/workspace-fs"

export const todoToIssuesTool = toolDefinition(
  "todo_to_issues",
  "Convert TODO/FIXME comments into structured issue drafts.",
  pathLimitSchema,
  async ({ path: pathName, limit }) => {
    const { files } = await collectTextFiles({
      path: pathName,
      maxFiles: boundedLimit(limit, 1000, 3000),
    })
    const issues: Array<{ title: string; body: string; labels: string[] }> = []
    for (const file of files) {
      const content = await readBounded(file)
      linesOf(content).forEach((line, index) => {
        const match = line.match(/\b(TODO|FIXME):?\s*(.+)$/i)
        if (match)
          issues.push({
            title: match[2].trim(),
            body: `${file.path}:${index + 1}\n\n${line.trim()}`,
            labels: [match[1].toLowerCase()],
          })
      })
    }
    return { type: "todo_to_issues", issues: issues.slice(0, 200) }
  }
)

export const envExampleGenerateTool = toolDefinition(
  "env_example_generate",
  "Generate .env.example from env usage as a dry-run patch.",
  dryRunSchema,
  async ({ dryRun }) => {
    const audit = (await envUsageAuditTool.invoke({})) as { used?: string[] }
    const body = (audit.used ?? []).map((name) => `${name}=`).join("\n") + "\n"
    return { type: "env_example_generate", dryRun, patch: unifiedPatch(".env.example", "", body) }
  }
)

export const setupHealthCheckTool = toolDefinition(
  "setup_health_check",
  "Check whether the project is ready to run locally.",
  emptySchema,
  async () => {
    const pkg = await readPackageJson()
    const node = await gitOutput("node --version")
    const lockfiles = []
    for (const file of ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"]) {
      const exists = await stat(resolveWorkspacePath(file))
        .then(() => true)
        .catch(() => false)
      if (exists) lockfiles.push(file)
    }
    return {
      type: "setup_health_check",
      platform: process.platform,
      nodeVersion: node.stdout.trim(),
      scripts: pkg.scripts ?? {},
      lockfiles,
    }
  }
)

export const onboardingSummaryTool = toolDefinition(
  "onboarding_summary",
  "Generate a new developer onboarding summary from repo structure.",
  emptySchema,
  async () => {
    const arch = (await architectureSummaryTool.invoke({})) as Record<string, unknown>
    return {
      type: "onboarding_summary",
      title: "Onboarding Summary",
      text: `This is a ${arch.appType ?? "project"} with ${(arch.domains as unknown[] | undefined)?.length ?? 0} major domains. Start with AGENTS.md, package scripts, src/app routes, and src/lib/server tools.`,
    }
  }
)
