import { execFile } from "child_process"
import { mkdtemp, writeFile } from "fs/promises"
import os from "os"
import path from "path"
import { promisify } from "util"
import { afterEach, describe, expect, it, vi } from "vitest"

const execFileAsync = promisify(execFile)
const ORIGINAL_WORKSPACE_ROOT = process.env.REKDIN_WORKSPACE_ROOT

async function git(args: string[], cwd: string) {
  await execFileAsync("git", args, {
    cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Rekdin Test",
      GIT_AUTHOR_EMAIL: "rekdin@example.com",
      GIT_COMMITTER_NAME: "Rekdin Test",
      GIT_COMMITTER_EMAIL: "rekdin@example.com",
    },
  })
}

describe("git tools", () => {
  afterEach(() => {
    if (ORIGINAL_WORKSPACE_ROOT === undefined) {
      delete process.env.REKDIN_WORKSPACE_ROOT
    } else {
      process.env.REKDIN_WORKSPACE_ROOT = ORIGINAL_WORKSPACE_ROOT
    }
    vi.resetModules()
  })

  it("runs git diff against REKDIN_WORKSPACE_ROOT instead of process.cwd()", async () => {
    const repo = await mkdtemp(path.join(os.tmpdir(), "rekdin-git-tools-"))
    await git(["init"], repo)
    await writeFile(path.join(repo, "tracked.txt"), "before\n", "utf-8")
    await git(["add", "tracked.txt"], repo)
    await git(["commit", "-m", "initial"], repo)
    await writeFile(path.join(repo, "tracked.txt"), "after\n", "utf-8")

    process.env.REKDIN_WORKSPACE_ROOT = repo
    vi.resetModules()

    const { gitDiffSummaryTool } = await import("./tools")
    const result = (await gitDiffSummaryTool.invoke({})) as {
      status: string
      diff: string
    }

    expect(result.status).toContain("tracked.txt")
    expect(result.diff).toContain("-before")
    expect(result.diff).toContain("+after")
  })
})
