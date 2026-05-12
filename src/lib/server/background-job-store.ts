import crypto from "crypto"

import { BackgroundJob, BackgroundJobStatus } from "@/types/runtime"

import { readJsonFile, withFileWriteLock, writeJsonFileAtomic } from "./json-store"
import { ensureWorkspaceDirs, getBackgroundJobsFilePath } from "./workspace"

class BackgroundJobStore {
  private cache: BackgroundJob[] | null = null

  private async loadJobs() {
    if (this.cache) return this.cache
    await ensureWorkspaceDirs()
    const jobs = await readJsonFile<BackgroundJob[]>(getBackgroundJobsFilePath(), [])
    this.cache = jobs
    return jobs
  }

  private async saveJobs(next: BackgroundJob[]) {
    const filePath = getBackgroundJobsFilePath()
    return withFileWriteLock(filePath, async () => {
      await writeJsonFileAtomic(filePath, next)
      this.cache = next
      return next
    })
  }

  async create(
    input: Omit<BackgroundJob, "id" | "status" | "createdAt"> & { status?: BackgroundJobStatus }
  ) {
    const jobs = await this.loadJobs()
    const job: BackgroundJob = {
      id: crypto.randomUUID(),
      status: input.status ?? "queued",
      createdAt: new Date().toISOString(),
      ...input,
    }
    await this.saveJobs([job, ...jobs])
    return job
  }

  async update(jobId: string, patch: Partial<BackgroundJob>) {
    const jobs = await this.loadJobs()
    let updated: BackgroundJob | null = null
    const next = jobs.map((job) => {
      if (job.id !== jobId) return job
      updated = { ...job, ...patch, id: job.id }
      return updated
    })
    if (!updated) return null
    await this.saveJobs(next)
    return updated
  }

  async get(jobId: string) {
    const jobs = await this.loadJobs()
    return jobs.find((job) => job.id === jobId) ?? null
  }

  async listBySession(sessionId: string) {
    const jobs = await this.loadJobs()
    return jobs.filter((job) => job.sessionId === sessionId)
  }

  async list() {
    const jobs = await this.loadJobs()
    return [...jobs]
  }
}

declare global {
  var __REKDIN_BACKGROUND_JOB_STORE: BackgroundJobStore | undefined
}

export function getBackgroundJobStore() {
  if (!globalThis.__REKDIN_BACKGROUND_JOB_STORE) {
    globalThis.__REKDIN_BACKGROUND_JOB_STORE = new BackgroundJobStore()
  }
  return globalThis.__REKDIN_BACKGROUND_JOB_STORE
}
