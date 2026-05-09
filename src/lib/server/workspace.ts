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

/**
 * Tests whether a resolved path stays inside the configured workspace boundary.
 */
function isWithinDirectory(baseDir: string, target: string) {
  const relative = path.relative(baseDir, target)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
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
  return target
}
