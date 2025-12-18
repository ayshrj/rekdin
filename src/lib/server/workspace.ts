import { mkdir, access } from "fs/promises"
import path from "path"

const DATA_DIR = path.resolve(process.cwd(), "data")
const WORKSPACE_DIR = path.join(DATA_DIR, "workspace")
const UPLOADS_DIR = path.join(WORKSPACE_DIR, "uploads")
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
}

export function getWorkspaceRoot() {
  return WORKSPACE_DIR
}

export function getUploadsDir() {
  return UPLOADS_DIR
}

export function getSessionsFilePath() {
  return SESSIONS_FILE
}

export function resolveWorkspacePath(requestedPath: string) {
  const normalized = path.normalize(requestedPath).replace(/^(\.\.(\/|\\|$))+/g, "")
  const target = path.resolve(WORKSPACE_DIR, normalized)
  if (!target.startsWith(WORKSPACE_DIR)) {
    throw new Error("Path escapes workspace boundaries")
  }
  return target
}
