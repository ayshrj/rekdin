import { tool } from "@langchain/core/tools"
import { spawn } from "child_process"
import { createPatch } from "diff"
import { readdir, readFile, stat, writeFile } from "fs/promises"
import os from "os"
import path from "path"
import { z } from "zod"

import {
  assertWorkspacePathAllowed,
  BLOCKED_WORKSPACE_DIRECTORIES,
  ensureWorkspaceDirs,
  findBlockedWorkspacePathSegment,
  getWorkspaceRoot,
  isBlockedWorkspaceDirectoryName,
  protectedWorkspaceAccessAllowed,
  resolveWorkspacePath,
} from "../../workspace"
import { runCommand } from "../shared/command"
import {
  assertNoBlockedDirectoryReference,
  collectWorkspaceFiles,
  readWorkspaceText,
} from "./workspace-fs"

export const fileStatTool = tool(
  async ({ path: filePath }) => {
    await ensureWorkspaceDirs()
    const resolved = resolveWorkspacePath(filePath)
    const info = await stat(resolved)
    return {
      type: "file_stat",
      path: filePath,
      kind: info.isDirectory() ? "directory" : info.isFile() ? "file" : "other",
      size: info.size,
      modified: info.mtime.toISOString(),
      created: info.birthtime.toISOString(),
    }
  },
  {
    name: "file_stat",
    description: "Return metadata for a workspace file or directory.",
    schema: z.object({ path: z.string().min(1) }),
  }
)

export const workspaceStatsTool = tool(
  async ({ path: inputPath, maxFiles }) => {
    const { files, skipped, truncated } = await collectWorkspaceFiles({
      path: inputPath,
      maxFiles: maxFiles ?? 2000,
      includeHidden: true,
    })
    const byExtension: Record<string, number> = {}
    let totalBytes = 0
    for (const file of files) {
      totalBytes += file.size
      const ext = path.extname(file.path).toLowerCase() || "(none)"
      byExtension[ext] = (byExtension[ext] ?? 0) + 1
    }
    return {
      type: "workspace_stats",
      path: inputPath ?? ".",
      fileCount: files.length,
      totalBytes,
      byExtension,
      largestFiles: files
        .slice()
        .sort((a, b) => b.size - a.size)
        .slice(0, 25)
        .map(({ path, size }) => ({ path, size })),
      skipped,
      truncated,
    }
  },
  {
    name: "workspace_stats",
    description: "Summarize workspace file counts, sizes, extensions, and largest files.",
    schema: z.object({
      path: z.string().optional(),
      maxFiles: z.number().int().min(1).max(5000).optional(),
    }),
  }
)

export const fileHeadTailTool = tool(
  async ({ path: filePath, head, tail }) => {
    const content = await readWorkspaceText(filePath)
    const lines = content.split(/\r?\n/)
    const headCount = Math.min(Math.max(head ?? 40, 0), 500)
    const tailCount = Math.min(Math.max(tail ?? 40, 0), 500)
    return {
      type: "file_head_tail",
      path: filePath,
      lineCount: lines.length,
      head: lines.slice(0, headCount).map((text, index) => ({ line: index + 1, text })),
      tail: lines
        .slice(Math.max(lines.length - tailCount, 0))
        .map((text, index) => ({ line: Math.max(lines.length - tailCount, 0) + index + 1, text })),
    }
  },
  {
    name: "file_head_tail",
    description: "Read only the beginning and end of a workspace text file.",
    schema: z.object({
      path: z.string().min(1),
      head: z.number().int().min(0).max(500).optional(),
      tail: z.number().int().min(0).max(500).optional(),
    }),
  }
)

/**
 * Searches workspace files with ripgrep, falling back to grep when rg is unavailable.
 */
export const fileSearchTool = tool(
  async ({ query, path: searchPath, maxResults }) => {
    await ensureWorkspaceDirs()
    if (searchPath) resolveWorkspacePath(searchPath)
    const escapedQuery = query.replace(/'/g, "'\"'\"'")
    const targetPath = searchPath ? searchPath.replace(/'/g, "'\"'\"'") : "."
    const limit = Math.min(Math.max(maxResults ?? 200, 1), 1000)
    const searchTargetsProtectedDirectory =
      Boolean(searchPath && findBlockedWorkspacePathSegment(searchPath)) &&
      protectedWorkspaceAccessAllowed()
    const rgExcludes = searchTargetsProtectedDirectory
      ? ""
      : BLOCKED_WORKSPACE_DIRECTORIES.flatMap((directoryName) => [
          `--glob '!${directoryName}/**'`,
          `--glob '!**/${directoryName}/**'`,
        ]).join(" ")
    const grepExcludes = searchTargetsProtectedDirectory
      ? ""
      : BLOCKED_WORKSPACE_DIRECTORIES.map(
          (directoryName) => `--exclude-dir='${directoryName}'`
        ).join(" ")
    let res = await runCommand(
      `rg ${rgExcludes} --line-number --no-heading --color=never -m ${limit} '${escapedQuery}' '${targetPath}'`,
      undefined,
      20000
    )
    // Fall back to grep when rg is not installed (exit code 127 = command not found)
    if (res.exitCode === 127) {
      res = await runCommand(
        `grep -rn ${grepExcludes} --color=never -m ${limit} '${escapedQuery}' '${targetPath}'`,
        undefined,
        20000
      )
    }
    if (res.exitCode !== 0 && res.stdout.trim().length === 0) {
      return {
        type: "file_search",
        query,
        path: searchPath ?? ".",
        matches: [],
        exitCode: res.exitCode,
        error: res.stderr.trim() || "Search failed. Check that the path and pattern are valid.",
      }
    }
    const matches = res.stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const firstColon = line.indexOf(":")
        const secondColon = line.indexOf(":", firstColon + 1)
        const file = line.slice(0, firstColon)
        const lineNumber = Number(line.slice(firstColon + 1, secondColon))
        const text = line.slice(secondColon + 1)
        return { file, line: lineNumber, text }
      })
    return {
      type: "file_search",
      query,
      path: searchPath ?? ".",
      matches,
      exitCode: res.exitCode,
    }
  },
  {
    name: "file_search",
    description: "Search within workspace files using ripgrep (rg) or grep as a fallback.",
    schema: z.object({
      query: z.string().min(1),
      path: z.string().optional(),
      maxResults: z.number().int().min(1).max(1000).optional(),
    }),
  }
)

/**
 * Reads a UTF-8 text file from the workspace.
 */
export const readFileTool = tool(
  async ({ path: filePath }) => {
    await ensureWorkspaceDirs()
    const resolved = resolveWorkspacePath(filePath)
    const content = await readFile(resolved, "utf-8")
    return { path: filePath, content, type: "file_read" }
  },
  {
    name: "file_read",
    description: "Read a UTF-8 text file from the AI workspace.",
    schema: z.object({ path: z.string() }),
  }
)

/**
 * Lists files and directories inside the workspace, optionally recursively.
 */
export const listFilesTool = tool(
  async ({ path: dirPath, recursive }) => {
    await ensureWorkspaceDirs()
    const gather = async (target: string, relative: string) => {
      assertWorkspacePathAllowed(target)
      const entries = await readdir(target, { withFileTypes: true })
      const output: Array<Record<string, unknown>> = []
      for (const entry of entries) {
        const relPath = relative ? `${relative}/${entry.name}` : entry.name
        const isProtectedDirectory =
          entry.isDirectory() &&
          isBlockedWorkspaceDirectoryName(entry.name) &&
          !protectedWorkspaceAccessAllowed()
        const abs = isProtectedDirectory
          ? path.join(target, entry.name)
          : resolveWorkspacePath(relPath)
        const info = await stat(abs)
        output.push({
          name: entry.name,
          path: relPath,
          type: entry.isDirectory() ? "directory" : "file",
          size: info.size,
          modified: info.mtime.toISOString(),
          protected: isProtectedDirectory,
          skipped: isProtectedDirectory,
          reason: isProtectedDirectory
            ? "Skipped by default because this generated dependency/build folder is expected to be large. Ask explicitly to inspect it and Rekdin will request approval."
            : undefined,
        })
        if (recursive && entry.isDirectory() && !isProtectedDirectory) {
          const nested = await gather(abs, relPath)
          output.push(...nested)
        }
      }
      return output
    }
    const base = dirPath ? resolveWorkspacePath(dirPath) : getWorkspaceRoot()
    const rel = dirPath?.replace(/^\.\//, "") ?? ""
    const files = await gather(base, rel)
    return { path: dirPath ?? ".", files, type: "list_files" }
  },
  {
    name: "list_files",
    description: "List files and folders inside the AI workspace.",
    schema: z.object({
      path: z.string().optional(),
      recursive: z.boolean().optional(),
    }),
  }
)

/**
 * Writes UTF-8 text to a workspace file and returns a diff when replacing content.
 */
export const writeFileTool = tool(
  async ({ path: filePath, content }) => {
    await ensureWorkspaceDirs()
    const resolved = resolveWorkspacePath(filePath)
    const oldContent = await readFile(resolved, "utf-8").catch(() => null)
    await writeFile(resolved, content, "utf-8")
    const diff =
      oldContent !== null
        ? createPatch(filePath, oldContent, content, "before", "after")
        : undefined
    return {
      path: filePath,
      bytes: Buffer.byteLength(content),
      downloadUrl: `/api/workspace/file?path=${encodeURIComponent(filePath)}`,
      diff,
      type: "write_file",
    }
  },
  {
    name: "write_file",
    description: "Write UTF-8 content to a file within the workspace.",
    schema: z.object({
      path: z.string(),
      content: z.string(),
    }),
  }
)

/**
 * Executes a shell command inside the workspace and returns stdout, stderr, and exit code.
 */
export const executeCommandTool = tool(
  async ({ command, cwd, timeout }) => {
    await ensureWorkspaceDirs()
    assertNoBlockedDirectoryReference(command)
    const workingDir = cwd ? resolveWorkspacePath(cwd) : getWorkspaceRoot()
    return await new Promise((resolve) => {
      const child = spawn(command, {
        shell: os.platform() === "win32" ? "powershell.exe" : "bash",
        cwd: workingDir,
        env: process.env,
      })
      const start = Date.now()
      let stdout = ""
      let stderr = ""
      let finished = false
      child.stdout.on("data", (chunk) => (stdout += chunk.toString()))
      child.stderr.on("data", (chunk) => (stderr += chunk.toString()))

      const timer = setTimeout(() => {
        if (finished) return
        child.kill("SIGTERM")
      }, timeout ?? 30000)

      child.on("close", (code) => {
        finished = true
        clearTimeout(timer)
        resolve({
          command,
          cwd: workingDir,
          exitCode: code ?? 0,
          stdout,
          stderr,
          duration: Date.now() - start,
          type: "execute_command",
        })
      })
    })
  },
  {
    name: "execute_command",
    description: "Execute a shell command inside the workspace.",
    schema: z.object({
      command: z.string(),
      cwd: z.string().optional(),
      timeout: z.number().optional(),
    }),
  }
)
