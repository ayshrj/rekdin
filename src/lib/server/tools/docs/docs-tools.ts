import { tool } from "@langchain/core/tools"
import { createPatch } from "diff"
import path from "path"
import { z } from "zod"

import { getWorkspaceRoot, resolveWorkspacePath } from "../../workspace"
import { runCommandUnsafe } from "../shared/command"
import { truncateString } from "../shared/formatting"
import {
  collectWorkspaceFiles,
  fileExists,
  readWorkspaceText,
  writeWorkspaceText,
} from "../workspace/workspace-fs"

const DOC_EXTENSIONS = [".md", ".mdx", ".rst", ".txt", ".adoc"]

const EXPECTED_DOCS: Array<{ file: string; severity: string; hint: string }> = [
  {
    file: "README.md",
    severity: "error",
    hint: "Create a README.md with project overview, setup instructions, and usage examples.",
  },
  {
    file: "CHANGELOG.md",
    severity: "warning",
    hint: "Add a CHANGELOG.md to track version history and breaking changes.",
  },
  {
    file: "CONTRIBUTING.md",
    severity: "info",
    hint: "Add CONTRIBUTING.md to guide contributors on setup, workflow, and conventions.",
  },
  {
    file: "LICENSE",
    severity: "warning",
    hint: "Add a LICENSE file to clarify usage terms for consumers of this project.",
  },
  {
    file: "AGENTS.md",
    severity: "info",
    hint: "Add AGENTS.md to document AI agent working rules, file map, and engineering standards.",
  },
]

/**
 * Scans the workspace for documentation files and returns a structured index.
 * Matches the ListFilesRenderer expected shape.
 */
export const docsIndexTool = tool(
  async ({ subPath }) => {
    const collected = await collectWorkspaceFiles({
      path: subPath,
      extensions: DOC_EXTENSIONS,
      maxFiles: 300,
      includeHidden: false,
    })

    const files = collected.files.map((f) => ({
      name: path.basename(f.path),
      path: f.path,
      type: "file" as const,
      size: f.size,
      modified: f.modified,
    }))

    return {
      type: "docs_index",
      files,
      skipped: collected.skipped,
      total: files.length,
      extensions: DOC_EXTENSIONS,
      root: subPath ?? ".",
    }
  },
  {
    name: "docs_index",
    description:
      "Scan the workspace for documentation files (.md, .mdx, .rst, .txt, .adoc) and return a structured index.",
    schema: z.object({
      subPath: z
        .string()
        .optional()
        .describe("Relative sub-path to scan (e.g. 'docs'). Defaults to workspace root."),
    }),
  }
)

/**
 * Checks for missing or stale standard documentation files.
 * Returns findings in the AuditFindingsRenderer shape.
 */
export const docsMissingReportTool = tool(
  async ({ extraExpected }) => {
    const expected = [
      ...EXPECTED_DOCS,
      ...(extraExpected ?? []).map((f) => ({
        file: f,
        severity: "info",
        hint: `Expected documentation file '${f}' not found.`,
      })),
    ]

    const findings: Array<{ severity: string; message: string; hint: string; file?: string }> = []

    for (const doc of expected) {
      const exists = await fileExists(resolveWorkspacePath(doc.file))
      if (!exists) {
        findings.push({
          severity: doc.severity,
          message: `Missing: ${doc.file}`,
          hint: doc.hint,
          file: doc.file,
        })
        continue
      }

      // Check for suspiciously small files (likely empty stubs)
      const text = await readWorkspaceText(doc.file).catch(() => "")
      const meaningful = text.trim().replace(/#+/g, "").trim()
      if (meaningful.length < 80) {
        findings.push({
          severity: "warning",
          message: `Stub: ${doc.file} exists but has minimal content (${meaningful.length} chars)`,
          hint: `Expand ${doc.file} with meaningful content.`,
          file: doc.file,
        })
      }
    }

    if (findings.length === 0) {
      findings.push({
        severity: "info",
        message: "All expected documentation files are present.",
        hint: "Consider reviewing content quality and keeping docs up to date.",
      })
    }

    return {
      type: "docs_missing_report",
      findings,
      checkedFiles: expected.map((d) => d.file),
      total: findings.length,
    }
  },
  {
    name: "docs_missing_report",
    description:
      "Check which standard documentation files (README, CHANGELOG, CONTRIBUTING, LICENSE, AGENTS.md) are missing or are stub files.",
    schema: z.object({
      extraExpected: z
        .array(z.string())
        .optional()
        .describe("Additional filenames to check for, e.g. ['SECURITY.md', 'CODE_OF_CONDUCT.md']"),
    }),
  }
)

/**
 * Writes or updates a documentation file (README, docs page, etc.) and returns a unified diff.
 * Matches the PatchPreviewRenderer shape.
 */
export const readmeGenerateOrUpdateTool = tool(
  async ({ filePath, content, dryRun }) => {
    const target = filePath ?? "README.md"
    const existing = await readWorkspaceText(target).catch(() => "")
    const patch = createPatch(target, existing, content, "current", "updated")

    if (!dryRun) {
      await writeWorkspaceText(target, content)
    }

    return {
      type: "readme_generate_or_update",
      filePath: target,
      patch,
      dryRun: dryRun ?? true,
      applied: !dryRun,
      linesAdded: patch.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).length,
      linesRemoved: patch.split("\n").filter((l) => l.startsWith("-") && !l.startsWith("---"))
        .length,
    }
  },
  {
    name: "readme_generate_or_update",
    description:
      "Write or replace a documentation file (default: README.md) with new content and return a unified diff. Set dryRun: true to preview without writing.",
    schema: z.object({
      filePath: z
        .string()
        .optional()
        .describe("Relative path of the file to write. Defaults to 'README.md'."),
      content: z.string().min(1).describe("Full file content to write."),
      dryRun: z
        .boolean()
        .optional()
        .describe("If true (default), return the diff without writing. Set false to apply."),
    }),
  }
)

/**
 * Checks AGENTS.md against the current codebase structure and flags discrepancies.
 * Returns findings in the AuditFindingsRenderer shape.
 */
export const agentsMdSyncTool = tool(
  async ({ issues }) => {
    const findings: Array<{ severity: string; message: string; hint: string; file?: string }> = []

    // If the caller already diagnosed issues, surface them directly
    if (issues && issues.length > 0) {
      for (const issue of issues) {
        findings.push({
          severity: issue.severity ?? "warning",
          message: issue.message,
          hint: issue.hint ?? "Update AGENTS.md to reflect current project state.",
          file: issue.file,
        })
      }
      return { type: "agents_md_sync", findings, total: findings.length }
    }

    // Otherwise, do a basic structural check
    const agentsExists = await fileExists(resolveWorkspacePath("AGENTS.md"))
    if (!agentsExists) {
      findings.push({
        severity: "error",
        message: "AGENTS.md not found",
        hint: "Create an AGENTS.md with project map, runtime flow, engineering standards, and AI agent working rules.",
        file: "AGENTS.md",
      })
      return { type: "agents_md_sync", findings, total: findings.length }
    }

    const content = await readWorkspaceText("AGENTS.md").catch(() => "")

    // Check for key AGENTS.md sections
    const expectedSections = [
      {
        heading: "Project Map",
        hint: "Add a ## Project Map section describing directory structure.",
      },
      {
        heading: "Runtime Flow",
        hint: "Add a ## Runtime Flow section showing the end-to-end execution path.",
      },
      {
        heading: "Engineering Standards",
        hint: "Add a ## Engineering Standards section with coding conventions.",
      },
    ]

    for (const section of expectedSections) {
      if (!content.includes(section.heading)) {
        findings.push({
          severity: "warning",
          message: `AGENTS.md is missing '${section.heading}' section`,
          hint: section.hint,
          file: "AGENTS.md",
        })
      }
    }

    // Check that key source directories in Project Map match actual dirs
    const srcDirs = ["src/app", "src/components", "src/lib", "src/types", "src/contexts"]
    for (const dir of srcDirs) {
      const resolvedDir = resolveWorkspacePath(dir)
      const dirExists = await fileExists(resolvedDir).catch(() => false)
      if (dirExists && !content.includes(dir)) {
        findings.push({
          severity: "info",
          message: `Directory '${dir}' exists but is not mentioned in AGENTS.md`,
          hint: `Add '${dir}' to the Project Map section of AGENTS.md.`,
          file: "AGENTS.md",
        })
      }
    }

    if (findings.length === 0) {
      findings.push({
        severity: "info",
        message: "AGENTS.md structure looks consistent with the project layout.",
        hint: "Review the file manually to ensure descriptions match the current code.",
        file: "AGENTS.md",
      })
    }

    return { type: "agents_md_sync", findings, total: findings.length }
  },
  {
    name: "agents_md_sync",
    description:
      "Check AGENTS.md for missing sections or stale references and report discrepancies. Pass pre-diagnosed issues to surface them as structured findings.",
    schema: z.object({
      issues: z
        .array(
          z.object({
            severity: z.enum(["error", "warning", "info"]).optional(),
            message: z.string(),
            hint: z.string().optional(),
            file: z.string().optional(),
          })
        )
        .optional()
        .describe(
          "Pre-diagnosed issues to report. If omitted, the tool performs a structural check."
        ),
    }),
  }
)

/**
 * Reads recent git history and generates a changelog entry as a unified diff.
 * Matches the PatchPreviewRenderer shape.
 */
export const changelogGenerateTool = tool(
  async ({ content, since, dryRun }) => {
    const root = getWorkspaceRoot()

    // Get recent git log for context (used when content is not provided)
    const logResult = await runCommandUnsafe(
      since ? `git log ${since}..HEAD --oneline --no-merges` : `git log --oneline --no-merges -30`,
      root,
      10000
    )
    const gitLog = truncateString(logResult.stdout.trim(), 3000)

    const changelogPath = "CHANGELOG.md"
    const existing = await readWorkspaceText(changelogPath).catch(() => "")

    // Use provided content or scaffold a stub entry from git log
    const newContent =
      content ??
      `## [Unreleased]\n\n### Changes\n\n${gitLog
        .split("\n")
        .map((line) => `- ${line}`)
        .join("\n")}\n\n`

    const updated = `${newContent}\n${existing}`
    const patch = createPatch(changelogPath, existing, updated, "current", "updated")

    if (!dryRun) {
      await writeWorkspaceText(changelogPath, updated)
    }

    return {
      type: "changelog_generate",
      filePath: changelogPath,
      patch,
      dryRun: dryRun ?? true,
      applied: !dryRun,
      gitLog,
      since: since ?? "last 30 commits",
      linesAdded: patch.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).length,
      linesRemoved: patch.split("\n").filter((l) => l.startsWith("-") && !l.startsWith("---"))
        .length,
    }
  },
  {
    name: "changelog_generate",
    description:
      "Generate a changelog entry from recent git history and prepend it to CHANGELOG.md. Returns a unified diff. Set dryRun: true (default) to preview without writing.",
    schema: z.object({
      content: z
        .string()
        .optional()
        .describe(
          "Formatted changelog entry to prepend. If omitted, a stub is generated from git log."
        ),
      since: z
        .string()
        .optional()
        .describe(
          "Git ref to use as the lower bound (e.g. 'v1.2.0', 'HEAD~10'). Defaults to last 30 commits."
        ),
      dryRun: z
        .boolean()
        .optional()
        .describe("If true (default), return the diff without writing. Set false to apply."),
    }),
  }
)

/**
 * Generates human-readable release notes from git history between two refs.
 * Matches the TextOutputRenderer shape.
 */
export const releaseNotesGenerateTool = tool(
  async ({ from, to, style }) => {
    const root = getWorkspaceRoot()
    const range = from ? `${from}..${to ?? "HEAD"}` : `${to ?? "HEAD"}~20..${to ?? "HEAD"}`
    const format = style === "markdown" ? "--format=format:- %s (%h)" : "--format=format:* %s"

    const logResult = await runCommandUnsafe(`git log ${range} --no-merges ${format}`, root, 10000)
    const tagResult = await runCommandUnsafe(
      `git tag --sort=-version:refname | head -5`,
      root,
      5000
    )

    const commits = logResult.stdout.trim()
    const recentTags = tagResult.stdout.trim()
    const toRef = to ?? "HEAD"

    const markdown =
      style === "markdown" || !style
        ? [
            `## Release Notes — ${toRef}`,
            "",
            commits || "_No commits found in the specified range._",
            "",
            recentTags ? `**Recent tags:** ${recentTags.split("\n").join(", ")}` : "",
          ]
            .filter((line) => line !== undefined)
            .join("\n")
        : commits || "No commits found."

    return {
      type: "release_notes_generate",
      title: `Release Notes — ${toRef}`,
      text: truncateString(markdown, 8000),
      from: from ?? "(20 commits ago)",
      to: toRef,
      style: style ?? "markdown",
      commitCount: commits ? commits.split("\n").filter(Boolean).length : 0,
    }
  },
  {
    name: "release_notes_generate",
    description:
      "Generate release notes from git history between two refs. Returns formatted markdown suitable for a GitHub release or CHANGELOG entry.",
    schema: z.object({
      from: z
        .string()
        .optional()
        .describe(
          "Git ref for the start of the range (e.g. 'v1.1.0'). Defaults to 20 commits ago."
        ),
      to: z.string().optional().describe("Git ref for the end of the range. Defaults to HEAD."),
      style: z
        .enum(["markdown", "plain"])
        .optional()
        .describe("Output format. Defaults to 'markdown'."),
    }),
  }
)
