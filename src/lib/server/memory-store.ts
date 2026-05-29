import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"

import { getWorkspaceRoot } from "./workspace"

const MEMORY_FILENAME = "memory.md"
const REKDIN_DIR = ".rekdin"

function memoryFilePath(): string {
  return path.join(getWorkspaceRoot(), REKDIN_DIR, MEMORY_FILENAME)
}

export async function readMemory(): Promise<string> {
  try {
    return await readFile(memoryFilePath(), "utf-8")
  } catch {
    return ""
  }
}

export async function appendMemory(fact: string): Promise<void> {
  const existing = await readMemory()
  const bullet = `- ${fact.trim()}`
  const updated = existing.trim()
    ? `${existing.trimEnd()}\n${bullet}\n`
    : `# Agent Memory\n\nFacts remembered for this workspace:\n\n${bullet}\n`
  await mkdir(path.dirname(memoryFilePath()), { recursive: true })
  await writeFile(memoryFilePath(), updated, "utf-8")
}

export async function clearMemory(): Promise<void> {
  try {
    await writeFile(memoryFilePath(), "", "utf-8")
  } catch {
    // ignore if the file doesn't exist yet
  }
}
