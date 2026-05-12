import { tool } from "@langchain/core/tools"
import { z } from "zod"

import { getWorkspaceRoot } from "../../workspace"
import { runCommandUnsafe } from "../shared/command"
import { truncateString } from "../shared/formatting"
import { readWorkspaceText } from "../workspace/workspace-fs"

async function readPackageJson() {
  try {
    return JSON.parse(await readWorkspaceText("package.json")) as Record<string, unknown>
  } catch {
    return null
  }
}

async function runPackageCommand(script: string, timeoutMs = 120000) {
  const pkg = await readPackageJson()
  const scripts =
    pkg?.scripts && typeof pkg.scripts === "object" ? (pkg.scripts as Record<string, string>) : {}
  if (!scripts[script]) throw new Error(`package.json script not found: ${script}`)
  if (!/^[\w:.-]+$/.test(script)) throw new Error("Script name contains unsupported characters")
  return runCommandUnsafe(`npm run ${script}`, getWorkspaceRoot(), timeoutMs)
}

function createScriptWrapperTool(
  name: string,
  scriptCandidates: string[],
  description: string,
  timeoutMs: number
) {
  return tool(
    async () => {
      const scripts =
        ((await readPackageJson())?.scripts as Record<string, string> | undefined) ?? {}
      const script = scriptCandidates.find((candidate) => scripts[candidate])
      if (!script)
        return { type: name, error: `No matching script found: ${scriptCandidates.join(", ")}` }
      const res = await runPackageCommand(script, timeoutMs)
      return {
        type: name,
        script,
        exitCode: res.exitCode,
        stdout: truncateString(res.stdout, 12000),
        stderr: truncateString(res.stderr, 8000),
        duration: res.duration,
      }
    },
    { name, description, schema: z.object({}) }
  )
}

export const npmScriptsTool = tool(
  async () => {
    const pkg = await readPackageJson()
    return {
      type: "npm_scripts",
      scripts: (pkg?.scripts as Record<string, string> | undefined) ?? {},
    }
  },
  { name: "npm_scripts", description: "List package.json scripts.", schema: z.object({}) }
)

export const runNpmScriptTool = tool(
  async ({ script, timeoutMs }) => {
    const res = await runPackageCommand(script, timeoutMs ?? 120000)
    return {
      type: "run_npm_script",
      script,
      exitCode: res.exitCode,
      stdout: truncateString(res.stdout, 12000),
      stderr: truncateString(res.stderr, 8000),
      duration: res.duration,
    }
  },
  {
    name: "run_npm_script",
    description: "Run a package.json script in the workspace.",
    schema: z.object({
      script: z.string().min(1),
      timeoutMs: z.number().int().min(1000).max(300000).optional(),
    }),
  }
)

export const typecheckProjectTool = createScriptWrapperTool(
  "typecheck_project",
  ["typecheck", "tsc"],
  "Run the project typecheck script.",
  180000
)
export const lintProjectTool = createScriptWrapperTool(
  "lint_project",
  ["lint"],
  "Run the project lint script.",
  180000
)
export const testProjectTool = createScriptWrapperTool(
  "test_project",
  ["test"],
  "Run the project test script.",
  180000
)
export const formatCheckTool = createScriptWrapperTool(
  "format_check",
  ["format:check", "prettier:check"],
  "Run the project formatting check script.",
  180000
)
export const buildProjectTool = createScriptWrapperTool(
  "build_project",
  ["build"],
  "Run the project production build script.",
  300000
)
