import crypto from "crypto"
import { access, mkdir } from "fs/promises"
import os from "os"
import path from "path"

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
const WORKSPACE_ROOT = process.env.REKDIN_WORKSPACE_ROOT?.trim()
  ? path.resolve(process.env.REKDIN_WORKSPACE_ROOT.trim())
  : process.cwd()
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
  return WORKSPACE_ROOT
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
  const normalized = path.normalize(requestedPath).replace(/^(\.\.(\/|\\|$))+/g, "")
  const target = path.resolve(WORKSPACE_ROOT, normalized)
  if (!isWithinDirectory(WORKSPACE_ROOT, target)) {
    throw new Error("Path escapes workspace boundaries")
  }
  return target
}
