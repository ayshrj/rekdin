import path from "path"
import { afterEach, describe, expect, it, vi } from "vitest"

const ORIGINAL_DATA_DIR = process.env.REKDIN_DATA_DIR
const ORIGINAL_WORKSPACE_ROOT = process.env.REKDIN_WORKSPACE_ROOT

async function loadWorkspaceModule() {
  vi.resetModules()
  return await import("./workspace")
}

describe("workspace paths", () => {
  afterEach(() => {
    if (ORIGINAL_DATA_DIR === undefined) {
      delete process.env.REKDIN_DATA_DIR
    } else {
      process.env.REKDIN_DATA_DIR = ORIGINAL_DATA_DIR
    }

    if (ORIGINAL_WORKSPACE_ROOT === undefined) {
      delete process.env.REKDIN_WORKSPACE_ROOT
    } else {
      process.env.REKDIN_WORKSPACE_ROOT = ORIGINAL_WORKSPACE_ROOT
    }
  })

  it("defaults the workspace root to the current project and keeps uploads in the data dir", async () => {
    delete process.env.REKDIN_DATA_DIR
    delete process.env.REKDIN_WORKSPACE_ROOT

    const workspace = await loadWorkspaceModule()
    const dataDir = path.dirname(workspace.getArtifactsDir())

    expect(workspace.getWorkspaceRoot()).toBe(process.cwd())
    expect(workspace.getUploadsDir()).toBe(path.join(dataDir, "uploads"))
    expect(workspace.getPdfsDir()).toBe(path.join(dataDir, "pdfs"))
  })

  it("honors an explicit workspace root override", async () => {
    process.env.REKDIN_WORKSPACE_ROOT = "/tmp/rekdin-custom-root"

    const workspace = await loadWorkspaceModule()

    expect(workspace.getWorkspaceRoot()).toBe(path.resolve("/tmp/rekdin-custom-root"))
    expect(workspace.resolveWorkspacePath("src/index.ts")).toBe(
      path.resolve("/tmp/rekdin-custom-root", "src/index.ts")
    )
  })
})
