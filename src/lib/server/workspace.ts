import crypto from "crypto"
import { access, mkdir } from "fs/promises"
import os from "os"
import path from "path"

import { getToolExecutionContext } from "./tool-execution-context"

/**
 * Derives a stable temp data directory per checked-out workspace when REKDIN_DATA_DIR is not set.
 */
function getDefaultDataDir() {
  const hash = crypto.createHash("sha1").update(process.cwd()).digest("hex").slice(0, 10)
  return path.join(os.tmpdir(), `rekdin-data-${hash}`)
}

const DATA_DIR = process.env.REKDIN_DATA_DIR?.trim()
  ? path.resolve(process.env.REKDIN_DATA_DIR.trim())
  : getDefaultDataDir()
const DEFAULT_WORKSPACE_ROOT = process.cwd()
let activeWorkspaceRoot = DEFAULT_WORKSPACE_ROOT
const UPLOADS_DIR = path.join(DATA_DIR, "uploads")
const PDFS_DIR = path.join(DATA_DIR, "pdfs")
const ARTIFACTS_DIR = path.join(DATA_DIR, "artifacts")
const REPLAYS_DIR = path.join(DATA_DIR, "replays")
const TRACES_DIR = path.join(DATA_DIR, "traces")
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json")
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json")
const BACKGROUND_JOBS_FILE = path.join(DATA_DIR, "background-jobs.json")
export const BLOCKED_WORKSPACE_DIRECTORIES = [
  "node_modules",
  ".git",
  ".next",
  ".nuxt",
  ".turbo",
  ".cache",
  ".parcel-cache",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  "__pycache__",
  "coverage",
  "dist",
  "build",
  "out",
  "target",
  ".gradle",
  ".venv",
  "venv",
] as const

const BLOCKED_WORKSPACE_DIRECTORY_SET = new Set(
  BLOCKED_WORKSPACE_DIRECTORIES.map((name) => name.toLowerCase())
)
const HIGH_CONFIDENCE_FREEFORM_DIRECTORY_SET = new Set([
  "node_modules",
  ".git",
  ".next",
  ".nuxt",
  ".turbo",
  ".cache",
  ".parcel-cache",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  "__pycache__",
  ".gradle",
  ".venv",
  "venv",
])

/**
 * Tests whether a resolved path stays inside the configured workspace boundary.
 */
function isWithinDirectory(baseDir: string, target: string) {
  const relative = path.relative(baseDir, target)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

export function isBlockedWorkspaceDirectoryName(name: string) {
  return BLOCKED_WORKSPACE_DIRECTORY_SET.has(name.toLowerCase())
}

export function findBlockedWorkspacePathSegment(pathValue: string) {
  const normalized = pathValue.replace(/\\/g, "/")
  return normalized
    .split("/")
    .filter(Boolean)
    .find((segment) => isBlockedWorkspaceDirectoryName(segment))
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function findBlockedWorkspaceDirectoryReference(value: string) {
  const normalized = value.replace(/\\/g, "/")
  return BLOCKED_WORKSPACE_DIRECTORIES.find((directoryName) => {
    const escaped = escapeRegExp(directoryName)
    const bareTokenAllowed = HIGH_CONFIDENCE_FREEFORM_DIRECTORY_SET.has(directoryName.toLowerCase())
    const pattern = bareTokenAllowed
      ? `(^|[\\s"'=:;()])(?:\\./|\\.\\./|/)?${escaped}(/|$|[\\s"'=;()])`
      : `(^|[\\s"'=:;()])(?:\\./|\\.\\./|/)${escaped}(/|$|[\\s"'=;()])`
    return new RegExp(pattern, "i").test(normalized)
  })
}

export function protectedWorkspaceAccessAllowed() {
  return getToolExecutionContext()?.allowProtectedWorkspaceAccess === true
}

export function assertWorkspacePathAllowed(
  resolvedPath: string,
  workspaceRoot = getEffectiveWorkspaceRoot()
) {
  if (protectedWorkspaceAccessAllowed()) return
  const relative = path.relative(path.resolve(workspaceRoot), path.resolve(resolvedPath))
  if (relative === "") return
  const blockedSegment = findBlockedWorkspacePathSegment(relative)
  if (blockedSegment) {
    throw new Error(
      `Access to protected workspace directory "${blockedSegment}" is blocked. Choose a narrower source path outside generated dependency/build folders.`
    )
  }
}

async function ensureDir(dir: string) {
  try {
    await access(dir)
  } catch {
    await mkdir(dir, { recursive: true })
  }
}

/**
 * Creates all server-side data directories used for uploads, PDFs, artifacts, replay, and traces.
 */
export async function ensureWorkspaceDirs() {
  await ensureDir(DATA_DIR)
  await ensureDir(UPLOADS_DIR)
  await ensureDir(PDFS_DIR)
  await ensureDir(ARTIFACTS_DIR)
  await ensureDir(REPLAYS_DIR)
  await ensureDir(TRACES_DIR)
}

export function getWorkspaceRoot() {
  return getEffectiveWorkspaceRoot()
}

export function getDefaultWorkspaceRoot() {
  return DEFAULT_WORKSPACE_ROOT
}

export function setWorkspaceRoot(root: string) {
  const trimmed = root.trim()
  activeWorkspaceRoot = trimmed ? path.resolve(trimmed) : DEFAULT_WORKSPACE_ROOT
  return activeWorkspaceRoot
}

function getEffectiveWorkspaceRoot() {
  const contextRoot = getToolExecutionContext()?.workspaceRoot?.trim()
  return contextRoot ? path.resolve(contextRoot) : activeWorkspaceRoot
}

export function getUploadsDir() {
  return UPLOADS_DIR
}

export function getPdfsDir() {
  return PDFS_DIR
}

export function getArtifactsDir() {
  return ARTIFACTS_DIR
}

export function getReplaysDir() {
  return REPLAYS_DIR
}

export function getTracesDir() {
  return TRACES_DIR
}

export function getSessionsFilePath() {
  return SESSIONS_FILE
}

export function getSettingsFilePath() {
  return SETTINGS_FILE
}

export function getBackgroundJobsFilePath() {
  return BACKGROUND_JOBS_FILE
}

export function getReplayFilePath(sessionId: string) {
  const safeId = path.basename(sessionId).replace(/[^a-zA-Z0-9._-]/g, "_")
  return path.join(REPLAYS_DIR, `${safeId}.json`)
}

/**
 * Resolves user/model supplied workspace paths while preventing path traversal outside the project.
 */
export function resolveWorkspacePath(requestedPath: string) {
  const workspaceRoot = getEffectiveWorkspaceRoot()
  const normalized = path.normalize(requestedPath).replace(/^(\.\.(\/|\\|$))+/g, "")
  const target = path.resolve(workspaceRoot, normalized)
  if (!isWithinDirectory(workspaceRoot, target)) {
    throw new Error("Path escapes workspace boundaries")
  }
  assertWorkspacePathAllowed(target, workspaceRoot)
  return target
}
