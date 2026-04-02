import { mkdir, readFile, rename, writeFile } from "fs/promises"
import path from "path"

const writeQueues = new Map<string, Promise<unknown>>()

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf-8")
    return JSON.parse(raw) as T
  } catch (error) {
    const code = error && typeof error === "object" ? Reflect.get(error, "code") : undefined
    if (code === "ENOENT") return fallback
    throw error
  }
}

export async function writeJsonFileAtomic<T>(filePath: string, value: T): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf-8")
  await rename(tempPath, filePath)
}

export async function withFileWriteLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  const previous = writeQueues.get(filePath) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(fn)
  writeQueues.set(filePath, next)
  try {
    return await next
  } finally {
    if (writeQueues.get(filePath) === next) {
      writeQueues.delete(filePath)
    }
  }
}
