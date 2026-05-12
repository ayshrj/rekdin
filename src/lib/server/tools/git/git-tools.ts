import { tool } from "@langchain/core/tools"
import { createPatch } from "diff"
import { mkdtemp, rm, writeFile } from "fs/promises"
import os from "os"
import path from "path"
import { z } from "zod"

import { getWorkspaceRoot, resolveWorkspacePath } from "../../workspace"
import { runCommand, runCommandUnsafe, safeShellArg } from "../shared/command"
import { truncateString } from "../shared/formatting"
import { readWorkspaceText } from "../workspace/workspace-fs"

/**
 * Returns recent git commits in compact one-line form.
 */
export const gitLogSummaryTool = tool(
  async ({ limit }) => {
    const count = Math.min(Math.max(limit ?? 10, 1), 50)
    const res = await runCommandUnsafe(`git log -${count} --oneline`, getWorkspaceRoot(), 10000)
    return {
      type: "git_log_summary",
      limit: count,
      output: res.stdout.trim(),
      exitCode: res.exitCode,
    }
  },
  {
    name: "git_log_summary",
    description: "Show recent git commits (oneline).",
    schema: z.object({ limit: z.number().int().min(1).max(50).optional() }),
  }
)

/**
 * Lists local and remote git branches for repository inspection.
 */
export const gitBranchesTool = tool(
  async () => {
    const res = await runCommandUnsafe("git branch --all", getWorkspaceRoot(), 10000)
    return { type: "git_branches", output: res.stdout.trim(), exitCode: res.exitCode }
  },
  {
    name: "git_branches",
    description: "List local and remote git branches.",
    schema: z.object({}),
  }
)

/**
 * Returns git status and diff, or the patch for a specific commit/ref.
 */
export const gitDiffSummaryTool = tool(
  async ({ path: filePath, commit }) => {
    if (commit) {
      // Show a specific commit's changes with full diff
      const safeCommit = commit.replace(/[^a-zA-Z0-9_.~^-]/g, "")
      const show = await runCommandUnsafe(
        `git show ${safeCommit} --stat --patch`,
        getWorkspaceRoot(),
        15000
      )
      const firstLine = show.stdout.indexOf("\n")
      return {
        type: "git_diff_summary",
        status: show.stdout.slice(0, firstLine).trim(), // commit header as status
        diff: show.stdout.slice(firstLine + 1).trim(),
        commit: safeCommit,
      }
    }
    const safePath = filePath
      ? path.relative(getWorkspaceRoot(), resolveWorkspacePath(filePath))
      : ""
    const escapedPath = safePath.replace(/'/g, "'\"'\"'")
    const pathArg = escapedPath ? ` -- '${escapedPath}'` : ""
    const status = await runCommandUnsafe("git status --short" + pathArg, getWorkspaceRoot(), 10000)
    const diff = await runCommandUnsafe("git diff" + pathArg, getWorkspaceRoot(), 10000)
    return {
      type: "git_diff_summary",
      status: status.stdout.trim(),
      diff: diff.stdout.trim(),
    }
  },
  {
    name: "git_diff_summary",
    description:
      "Show git status and diff for the working directory. Pass `path` to scope to a file. Pass `commit` (hash or ref) to show a specific commit's changes via git show.",
    schema: z.object({
      path: z.string().optional(),
      commit: z.string().optional(),
    }),
  }
)

/**
 * Parses git blame porcelain output into structured per-line authorship data.
 */
export const gitBlameTool = tool(
  async ({ path: filePath }) => {
    const safe = path
      .relative(getWorkspaceRoot(), resolveWorkspacePath(filePath))
      .replace(/'/g, "'\"'\"'")
    const res = await runCommandUnsafe(
      `git blame --line-porcelain -- '${safe}'`,
      getWorkspaceRoot(),
      15000
    )
    if (res.exitCode !== 0) {
      return { type: "git_blame", path: filePath, lines: [], error: res.stderr.trim() }
    }
    // Parse porcelain output into structured lines
    const lines: { hash: string; author: string; date: string; lineNo: number; text: string }[] = []
    const chunks = res.stdout.split(/^([0-9a-f]{40}) /m).slice(1)
    for (let i = 0; i < chunks.length; i += 2) {
      const hash = chunks[i]?.trim().slice(0, 7) ?? ""
      const block = chunks[i + 1] ?? ""
      const blockLines = block.split("\n")
      const author = blockLines.find((l) => l.startsWith("author "))?.slice(7) ?? ""
      const epoch = blockLines.find((l) => l.startsWith("author-time "))?.slice(12) ?? ""
      const date = epoch ? new Date(Number(epoch) * 1000).toISOString().slice(0, 10) : ""
      const lineNoLine = blockLines.find((l) => /^\d+ \d+ \d+/.test(l)) ?? ""
      const lineNo = Number(lineNoLine.split(" ")[1] ?? "0")
      const text = blockLines.find((l) => l.startsWith("\t"))?.slice(1) ?? ""
      lines.push({ hash, author, date, lineNo, text })
    }
    return { type: "git_blame", path: filePath, lines }
  },
  {
    name: "git_blame",
    description: "Show who last modified each line of a file (git blame).",
    schema: z.object({ path: z.string().min(1) }),
  }
)

/**
 * Shows the commit history for a file, following renames.
 */
export const gitFileHistoryTool = tool(
  async ({ path: filePath, limit }) => {
    const safe = path
      .relative(getWorkspaceRoot(), resolveWorkspacePath(filePath))
      .replace(/'/g, "'\"'\"'")
    const n = Math.min(Math.max(limit ?? 20, 1), 100)
    const res = await runCommandUnsafe(
      `git log --follow --oneline -n ${n} -- '${safe}'`,
      getWorkspaceRoot(),
      10000
    )
    return {
      type: "git_file_history",
      path: filePath,
      output: res.stdout.trim(),
      exitCode: res.exitCode,
    }
  },
  {
    name: "git_file_history",
    description:
      "Show the commit history for a specific file, following renames (git log --follow).",
    schema: z.object({
      path: z.string().min(1),
      limit: z.number().int().min(1).max(100).optional(),
    }),
  }
)

export const gitStatusTool = tool(
  async () => {
    const res = await runCommandUnsafe("git status --short --branch", getWorkspaceRoot(), 10000)
    return { type: "git_status", output: res.stdout.trim(), exitCode: res.exitCode }
  },
  {
    name: "git_status",
    description: "Show compact git branch and working tree status.",
    schema: z.object({}),
  }
)

export const gitChangedFilesTool = tool(
  async () => {
    const res = await runCommandUnsafe("git status --porcelain=v1", getWorkspaceRoot(), 10000)
    const files = res.stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => ({ status: line.slice(0, 2), path: line.slice(3).trim() }))
    return { type: "git_changed_files", files, exitCode: res.exitCode }
  },
  {
    name: "git_changed_files",
    description: "List changed files with porcelain status codes.",
    schema: z.object({}),
  }
)

export const gitStagedDiffTool = tool(
  async ({ path: filePath }) => {
    const safePath = filePath
      ? path.relative(getWorkspaceRoot(), resolveWorkspacePath(filePath))
      : ""
    const pathArg = safePath ? ` -- ${safeShellArg(safePath)}` : ""
    const res = await runCommandUnsafe(`git diff --cached${pathArg}`, getWorkspaceRoot(), 15000)
    return {
      type: "git_staged_diff",
      path: filePath,
      diff: truncateString(res.stdout, 12000),
      exitCode: res.exitCode,
    }
  },
  {
    name: "git_staged_diff",
    description: "Show staged git diff, optionally scoped to a file.",
    schema: z.object({ path: z.string().optional() }),
  }
)

export const gitShowTool = tool(
  async ({ ref, path: filePath }) => {
    const safeRef = ref.replace(/[^a-zA-Z0-9_.~^:/-]/g, "")
    const safePath = filePath
      ? path.relative(getWorkspaceRoot(), resolveWorkspacePath(filePath))
      : ""
    const pathArg = safePath ? ` -- ${safeShellArg(safePath)}` : ""
    const res = await runCommandUnsafe(
      `git show --stat --patch ${safeRef}${pathArg}`,
      getWorkspaceRoot(),
      15000
    )
    return {
      type: "git_show",
      ref: safeRef,
      path: filePath,
      output: truncateString(res.stdout, 16000),
      exitCode: res.exitCode,
      error: res.stderr.trim(),
    }
  },
  {
    name: "git_show",
    description: "Show a git ref/commit with stat and patch.",
    schema: z.object({ ref: z.string().min(1), path: z.string().optional() }),
  }
)

export const gitCompareRefsTool = tool(
  async ({ base, head }) => {
    const safeBase = base.replace(/[^a-zA-Z0-9_.~^:/-]/g, "")
    const safeHead = head.replace(/[^a-zA-Z0-9_.~^:/-]/g, "")
    const res = await runCommandUnsafe(
      `git diff --stat --patch ${safeBase}..${safeHead}`,
      getWorkspaceRoot(),
      20000
    )
    return {
      type: "git_compare_refs",
      base: safeBase,
      head: safeHead,
      diff: truncateString(res.stdout, 20000),
      exitCode: res.exitCode,
      error: res.stderr.trim(),
    }
  },
  {
    name: "git_compare_refs",
    description: "Compare two git refs with stat and patch.",
    schema: z.object({ base: z.string().min(1), head: z.string().min(1) }),
  }
)

export const gitConflictsTool = tool(
  async () => {
    const res = await runCommandUnsafe(
      "git diff --name-only --diff-filter=U",
      getWorkspaceRoot(),
      10000
    )
    return {
      type: "git_conflicts",
      files: res.stdout.split(/\r?\n/).filter(Boolean),
      exitCode: res.exitCode,
    }
  },
  {
    name: "git_conflicts",
    description: "List files with unresolved git merge conflicts.",
    schema: z.object({}),
  }
)

export const gitTagsTool = tool(
  async ({ limit }) => {
    const n = Math.min(Math.max(limit ?? 50, 1), 200)
    const res = await runCommandUnsafe(
      `git tag --sort=-creatordate | head -n ${n}`,
      getWorkspaceRoot(),
      10000
    )
    return {
      type: "git_tags",
      tags: res.stdout.split(/\r?\n/).filter(Boolean),
      exitCode: res.exitCode,
    }
  },
  {
    name: "git_tags",
    description: "List recent git tags.",
    schema: z.object({ limit: z.number().int().min(1).max(200).optional() }),
  }
)

export const gitRemoteInfoTool = tool(
  async () => {
    const remotes = await runCommandUnsafe("git remote -v", getWorkspaceRoot(), 10000)
    const branch = await runCommandUnsafe("git branch -vv", getWorkspaceRoot(), 10000)
    return {
      type: "git_remote_info",
      remotes: remotes.stdout.trim(),
      branches: branch.stdout.trim(),
      exitCode: remotes.exitCode || branch.exitCode,
    }
  },
  {
    name: "git_remote_info",
    description: "Show git remotes and branch tracking info.",
    schema: z.object({}),
  }
)

export const gitCommitSearchTool = tool(
  async ({ query, limit }) => {
    const n = Math.min(Math.max(limit ?? 20, 1), 100)
    const res = await runCommandUnsafe(
      `git log --all --grep=${safeShellArg(query)} --oneline -n ${n}`,
      getWorkspaceRoot(),
      10000
    )
    return {
      type: "git_commit_search",
      query,
      commits: res.stdout.split(/\r?\n/).filter(Boolean),
      exitCode: res.exitCode,
    }
  },
  {
    name: "git_commit_search",
    description: "Search git commit messages.",
    schema: z.object({
      query: z.string().min(1),
      limit: z.number().int().min(1).max(100).optional(),
    }),
  }
)

export const gitPatchPreviewTool = tool(
  async ({ path: filePath, newContent }) => {
    const oldContent = await readWorkspaceText(filePath)
    return {
      type: "git_patch_preview",
      path: filePath,
      diff: createPatch(filePath, oldContent, newContent, "before", "after"),
    }
  },
  {
    name: "git_patch_preview",
    description: "Create a unified diff preview for replacing one workspace file.",
    schema: z.object({ path: z.string().min(1), newContent: z.string() }),
  }
)

export const gitApplyPatchTool = tool(
  async ({ patch, checkOnly }) => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "rekdin-patch-"))
    const patchPath = path.join(tempDir, "change.patch")
    try {
      await writeFile(patchPath, patch, "utf-8")
      const command = `git apply ${checkOnly ? "--check " : ""}${safeShellArg(patchPath)}`
      const res = await runCommandUnsafe(command, getWorkspaceRoot(), 20000)
      return {
        type: "git_apply_patch",
        checkOnly: checkOnly ?? false,
        applied: !checkOnly && res.exitCode === 0,
        exitCode: res.exitCode,
        stdout: truncateString(res.stdout, 4000),
        stderr: truncateString(res.stderr, 4000),
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {})
    }
  },
  {
    name: "git_apply_patch",
    description:
      "Apply or validate a unified patch with git apply. Mutates files when checkOnly is false.",
    schema: z.object({ patch: z.string().min(1), checkOnly: z.boolean().optional() }),
  }
)

export const gitCommitTool = tool(
  async ({ message, files, all = false }: { message: string; files?: string[]; all?: boolean }) => {
    const addCmd = all
      ? "git add -A"
      : files && files.length > 0
        ? `git add ${files.map((f) => `"${f}"`).join(" ")}`
        : "git add -u"
    const addResult = await runCommand(addCmd)
    if (addResult.exitCode !== 0) {
      return {
        type: "git_commit",
        error: addResult.stderr || addResult.stdout,
        exitCode: addResult.exitCode,
      }
    }
    const commitResult = await runCommand(`git commit -m ${JSON.stringify(message)}`)
    const hashLine = commitResult.stdout.match(/^\[.+\s([0-9a-f]{7,})\]/)
    const hash = hashLine ? hashLine[1] : undefined
    return {
      type: "git_commit",
      message,
      hash,
      stdout: truncateString(commitResult.stdout, 2000),
      stderr: truncateString(commitResult.stderr, 500),
      exitCode: commitResult.exitCode,
      success: commitResult.exitCode === 0,
    }
  },
  {
    name: "git_commit",
    description:
      "Stage files and create a git commit. Specify `files` for selective staging, `all: true` to stage all changes, or leave both empty to stage only tracked modifications.",
    schema: z.object({
      message: z.string().min(1).max(500),
      files: z.array(z.string()).optional(),
      all: z.boolean().optional(),
    }),
  }
)

export const gitCheckoutTool = tool(
  async ({ branch, create = false }: { branch: string; create?: boolean }) => {
    const cmd = create
      ? `git checkout -b ${JSON.stringify(branch)}`
      : `git checkout ${JSON.stringify(branch)}`
    const result = await runCommand(cmd)
    return {
      type: "git_checkout",
      branch,
      created: create,
      stdout: truncateString(result.stdout, 1000),
      stderr: truncateString(result.stderr, 500),
      exitCode: result.exitCode,
      success: result.exitCode === 0,
    }
  },
  {
    name: "git_checkout",
    description: "Switch to an existing branch or create a new one (`create: true`).",
    schema: z.object({
      branch: z.string().min(1),
      create: z.boolean().optional(),
    }),
  }
)

export const gitStashTool = tool(
  async ({
    action = "push",
    message,
    index,
  }: {
    action?: "push" | "pop" | "list" | "drop"
    message?: string
    index?: number
  }) => {
    let cmd: string
    if (action === "push") {
      cmd = message ? `git stash push -m ${JSON.stringify(message)}` : "git stash push"
    } else if (action === "pop") {
      cmd = index != null ? `git stash pop stash@{${index}}` : "git stash pop"
    } else if (action === "drop") {
      cmd = index != null ? `git stash drop stash@{${index}}` : "git stash drop"
    } else {
      cmd = "git stash list"
    }
    const result = await runCommand(cmd)
    return {
      type: "git_stash",
      action,
      stdout: truncateString(result.stdout, 2000),
      stderr: truncateString(result.stderr, 500),
      exitCode: result.exitCode,
      success: result.exitCode === 0,
    }
  },
  {
    name: "git_stash",
    description: "Stash or restore changes: push (save), pop (restore), list, or drop.",
    schema: z.object({
      action: z.enum(["push", "pop", "list", "drop"]).optional(),
      message: z.string().optional(),
      index: z.number().int().min(0).optional(),
    }),
  }
)

export const gitPushTool = tool(
  async ({
    remote = "origin",
    branch,
    force = false,
    setUpstream = false,
  }: {
    remote?: string
    branch?: string
    force?: boolean
    setUpstream?: boolean
  }) => {
    const currentBranch =
      branch ?? (await runCommand("git rev-parse --abbrev-ref HEAD")).stdout.trim()
    const flags = [setUpstream ? "--set-upstream" : null, force ? "--force-with-lease" : null]
      .filter(Boolean)
      .join(" ")
    const cmd = `git push ${flags} ${remote} ${currentBranch}`.trim().replace(/\s+/g, " ")
    const result = await runCommand(cmd)
    return {
      type: "git_push",
      remote,
      branch: currentBranch,
      force,
      stdout: truncateString(result.stdout, 2000),
      stderr: truncateString(result.stderr, 1000),
      exitCode: result.exitCode,
      success: result.exitCode === 0,
    }
  },
  {
    name: "git_push",
    description:
      "Push the current branch (or specified branch) to a remote. Uses --force-with-lease when force is true.",
    schema: z.object({
      remote: z.string().optional(),
      branch: z.string().optional(),
      force: z.boolean().optional(),
      setUpstream: z.boolean().optional(),
    }),
  }
)
