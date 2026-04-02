import crypto from "crypto"
import path from "path"

import { TurnTrace } from "@/types/runtime"

import { readJsonFile, withFileWriteLock, writeJsonFileAtomic } from "./json-store"
import { ensureWorkspaceDirs, getTracesDir } from "./workspace"

function getTraceFilePath(sessionId: string) {
  const safe = path.basename(sessionId).replace(/[^a-zA-Z0-9._-]/g, "_")
  return path.join(getTracesDir(), `${safe}.json`)
}

class TraceStore {
  async append(sessionId: string, trace: Omit<TurnTrace, "id" | "sessionId">) {
    await ensureWorkspaceDirs()
    const filePath = getTraceFilePath(sessionId)
    return withFileWriteLock(filePath, async () => {
      const existing = await readJsonFile<TurnTrace[]>(filePath, [])
      const nextTrace: TurnTrace = {
        id: crypto.randomUUID(),
        sessionId,
        ...trace,
      }
      await writeJsonFileAtomic(filePath, [...existing, nextTrace])
      return nextTrace
    })
  }

  async list(sessionId: string) {
    await ensureWorkspaceDirs()
    return readJsonFile<TurnTrace[]>(getTraceFilePath(sessionId), [])
  }
}

declare global {
  var __REKDIN_TRACE_STORE: TraceStore | undefined
}

export function getTraceStore() {
  if (!globalThis.__REKDIN_TRACE_STORE) {
    globalThis.__REKDIN_TRACE_STORE = new TraceStore()
  }
  return globalThis.__REKDIN_TRACE_STORE
}
