import crypto from "crypto"
import { access, mkdir } from "fs/promises"
import os from "os"
import path from "path"

function getDefaultDataDir() {
  const hash = crypto.createHash("sha1").update(process.cwd()).digest("hex").slice(0, 10)
  return path.join(os.tmpdir(), `rekdin-data-${hash}`)
}

const DATA_DIR = process.env.REKDIN_DATA_DIR?.trim()
  ? path.resolve(process.env.REKDIN_DATA_DIR.trim())
  : getDefaultDataDir()
const WORKSPACE_DIR = path.join(DATA_DIR, "workspace")
const UPLOADS_DIR = path.join(WORKSPACE_DIR, "uploads")
const PDFS_DIR = path.join(WORKSPACE_DIR, "pdfs")
const REPLAYS_DIR = path.join(DATA_DIR, "replays")
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json")
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json")

async function ensureDir(dir: string) {
  try {
    await access(dir)
  } catch {
    await mkdir(dir, { recursive: true })
  }
}

export async function ensureWorkspaceDirs() {
  await ensureDir(DATA_DIR)
  await ensureDir(WORKSPACE_DIR)
  await ensureDir(UPLOADS_DIR)
  await ensureDir(PDFS_DIR)
  await ensureDir(REPLAYS_DIR)
}

export function getWorkspaceRoot() {
  return WORKSPACE_DIR
}

export function getUploadsDir() {
  return UPLOADS_DIR
}

export function getPdfsDir() {
  return PDFS_DIR
}

export function getReplaysDir() {
  return REPLAYS_DIR
}

export function getSessionsFilePath() {
  return SESSIONS_FILE
}

export function getSettingsFilePath() {
  return SETTINGS_FILE
}

export function getReplayFilePath(sessionId: string) {
  const safeId = path.basename(sessionId).replace(/[^a-zA-Z0-9._-]/g, "_")
  return path.join(REPLAYS_DIR, `${safeId}.json`)
}

export function resolveWorkspacePath(requestedPath: string) {
  const normalized = path.normalize(requestedPath).replace(/^(\.\.(\/|\\|$))+/g, "")
  const target = path.resolve(WORKSPACE_DIR, normalized)
  if (!target.startsWith(WORKSPACE_DIR)) {
    throw new Error("Path escapes workspace boundaries")
  }
  return target
}
