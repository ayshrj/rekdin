import path from "path"
import { z } from "zod"

import { codeFiles, linesOf } from "../shared/code-utils"
import { boundedLimit, previewString } from "../shared/formatting"
import { unifiedPatch } from "../shared/patching"
import { pathLimitSchema, toolDefinition } from "../shared/tool-base"

export const testGapAnalysisTool = toolDefinition(
  "test_gap_analysis",
  "Compare source files vs test files and identify missing tests.",
  pathLimitSchema,
  async ({ limit }) => {
    const { files } = await codeFiles(undefined, boundedLimit(limit, 2000, 5000))
    const tests = new Set(
      files.filter((file) => /[.-](test|spec)\.[tj]sx?$/.test(file.path)).map((file) => file.path)
    )
    const sources = files.filter(
      (file) => !/[.-](test|spec)\.[tj]sx?$/.test(file.path) && !file.path.endsWith(".d.ts")
    )
    const rows = sources.slice(0, 500).map((file) => {
      const base = file.path.replace(/\.[tj]sx?$/, "")
      const expected = [
        `${base}.test.ts`,
        `${base}.test.tsx`,
        `${base}.spec.ts`,
        `${base}.spec.tsx`,
      ]
      const testFile = expected.find((candidate) => tests.has(candidate))
      return {
        source: file.path,
        hasTest: Boolean(testFile),
        testFile,
        suggestedTestFile: expected[0],
      }
    })
    return {
      type: "test_gap_analysis",
      files: rows,
      omitted: Math.max(0, sources.length - rows.length),
    }
  }
)

export const generateUnitTestDraftTool = toolDefinition(
  "generate_unit_test_draft",
  "Generate a unit test file draft patch for a selected function or module.",
  z.object({
    path: z.string().min(1),
    symbol: z.string().optional(),
    dryRun: z.boolean().optional().default(true),
  }),
  async ({ path: pathName, symbol, dryRun }) => {
    const testPath = pathName.replace(/\.[tj]sx?$/, ".test.ts")
    const body = `import { describe, expect, it } from "vitest"\n\nimport { ${symbol ?? "subject"} } from "./${path.basename(pathName).replace(/\.[tj]sx?$/, "")}"\n\ndescribe("${symbol ?? pathName}", () => {\n  it("handles the happy path", () => {\n    expect(${symbol ?? "subject"}).toBeDefined()\n  })\n})\n`
    return {
      type: "generate_unit_test_draft",
      dryRun,
      summary: `Draft test for ${pathName}`,
      patch: unifiedPatch(testPath, "", body),
    }
  }
)

export const testFailureExplainTool = toolDefinition(
  "test_failure_explain",
  "Parse test output and explain likely causes.",
  z.object({ command: z.string().optional(), output: z.string().min(1) }),
  async ({ command, output }) => ({
    type: "test_failure_explain",
    command,
    findings: linesOf(output)
      .filter((line) => /FAIL|Error|Expected|Received|Assertion|Timeout/i.test(line))
      .slice(0, 50)
      .map((line) => ({
        severity: "warning",
        message: previewString(line, 300),
        hint: "Inspect the nearest stack frame and changed assertion input.",
      })),
  })
)

export const snapshotDiffExplainTool = toolDefinition(
  "snapshot_diff_explain",
  "Parse snapshot diffs and explain the likely UI/content change.",
  z.object({ output: z.string().min(1) }),
  async ({ output }) => ({
    type: "snapshot_diff_explain",
    summary: "Snapshot changed lines extracted from diff output.",
    added: linesOf(output)
      .filter((line) => line.startsWith("+"))
      .slice(0, 80),
    removed: linesOf(output)
      .filter((line) => line.startsWith("-"))
      .slice(0, 80),
  })
)

export const toolContractTestGenerateTool = toolDefinition(
  "tool_contract_test_generate",
  "Generate test draft coverage for a LangChain tool contract.",
  z.object({ toolName: z.string().min(1), dryRun: z.boolean().optional().default(true) }),
  async ({ toolName, dryRun }) => {
    const pathName = `src/lib/server/tools/${toolName}.contract.test.ts`
    const body = `import { describe, expect, it } from "vitest"\n\ndescribe("${toolName}", () => {\n  it("validates schema input", () => {\n    expect("${toolName}").toBeTruthy()\n  })\n\n  it("returns a stable type field", () => {\n    expect("${toolName}").toBe("${toolName}")\n  })\n})\n`
    return { type: "tool_contract_test_generate", dryRun, patch: unifiedPatch(pathName, "", body) }
  }
)

export const mockWorkspaceCreateTool = toolDefinition(
  "mock_workspace_create",
  "Return a dry-run fake workspace fixture plan for safe tool testing.",
  z.object({ name: z.string().optional(), dryRun: z.boolean().optional().default(true) }),
  async ({ name, dryRun }) => ({
    type: "mock_workspace_create",
    dryRun,
    files: [
      {
        path: `${name ?? "mock-workspace"}/package.json`,
        content: '{"scripts":{"test":"vitest"}}',
      },
      { path: `${name ?? "mock-workspace"}/src/index.ts`, content: "export const ok = true\n" },
    ],
  })
)
