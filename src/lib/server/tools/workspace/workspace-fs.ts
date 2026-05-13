import { readdir, readFile, stat, writeFile } from "fs/promises"
import path from "path"

import {
  assertWorkspacePathAllowed,
  ensureWorkspaceDirs,
  findBlockedWorkspaceDirectoryReference,
  getWorkspaceRoot,
  isBlockedWorkspaceDirectoryName,
  protectedWorkspaceAccessAllowed,
  resolveWorkspacePath,
} from "../../workspace"

export function assertNoBlockedDirectoryReference(value: string) {
  if (protectedWorkspaceAccessAllowed()) return
  const blockedDirectory = findBlockedWorkspaceDirectoryReference(value)
  if (!blockedDirectory) return
  throw new Error(
    `Access to protected workspace directory "${blockedDirectory}" is blocked. Use a narrower project path and never inspect generated dependency/build folders.`
  )
}

/**
 * Reads a UTF-8 file after resolving it against the Rekdin workspace root.
 */
export async function readWorkspaceText(filePath: string) {
  await ensureWorkspaceDirs()
  const resolved = resolveWorkspacePath(filePath)
  return await readFile(resolved, "utf-8")
}

/**
 * Writes UTF-8 content after resolving the path against the Rekdin workspace root.
 */
export async function writeWorkspaceText(filePath: string, content: string) {
  await ensureWorkspaceDirs()
  const resolved = resolveWorkspacePath(filePath)
  await writeFile(resolved, content, "utf-8")
  return resolved
}

/**
 * Checks whether a generated or referenced file exists.
 */
export async function fileExists(filePath: string) {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

export async function readPackageJson() {
  try {
    return JSON.parse(await readWorkspaceText("package.json")) as Record<string, unknown>
  } catch {
    return {}
  }
}

export async function collectWorkspaceFiles(options?: {
  path?: string
  maxFiles?: number
  extensions?: string[]
  includeHidden?: boolean
}) {
  const root = options?.path ? resolveWorkspacePath(options.path) : getWorkspaceRoot()
  const relRoot = options?.path?.replace(/^\.\//, "") ?? ""
  const maxFiles = Math.min(Math.max(options?.maxFiles ?? 500, 1), 5000)
  const extensions = options?.extensions
    ? new Set(options.extensions.map((ext) => ext.toLowerCase()))
    : null
  const files: Array<{ path: string; abs: string; size: number; modified: string }> = []
  const skipped: Array<{ path: string; reason: string }> = []

  async function visit(absPath: string, relPath: string) {
    if (files.length >= maxFiles) return
    assertWorkspacePathAllowed(absPath)
    const info = await stat(absPath)
    if (info.isDirectory()) {
      const entries = await readdir(absPath, { withFileTypes: true })
      for (const entry of entries) {
        if (files.length >= maxFiles) break
        if (!options?.includeHidden && entry.name.startsWith(".") && entry.name !== ".env") {
          continue
        }
        const childRel = relPath ? `${relPath}/${entry.name}` : entry.name
        if (entry.isDirectory() && isBlockedWorkspaceDirectoryName(entry.name)) {
          skipped.push({ path: childRel, reason: "Protected generated dependency/build directory" })
          continue
        }
        if (entry.isSymbolicLink()) {
          skipped.push({ path: childRel, reason: "Symlink skipped" })
          continue
        }
        await visit(path.join(absPath, entry.name), childRel)
      }
      return
    }
    if (!info.isFile()) return
    const ext = path.extname(absPath).toLowerCase()
    if (extensions && !extensions.has(ext)) return
    files.push({
      path: relPath || path.basename(absPath),
      abs: absPath,
      size: info.size,
      modified: info.mtime.toISOString(),
    })
  }

  await visit(root, relRoot)
  return { files, skipped, truncated: files.length >= maxFiles }
}
