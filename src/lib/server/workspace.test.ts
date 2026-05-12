import path from "path"
import { afterEach, describe, expect, it, vi } from "vitest"

const ORIGINAL_DATA_DIR = process.env.REKDIN_DATA_DIR

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
  })

  it("defaults the workspace root to the current project and keeps uploads in the data dir", async () => {
    delete process.env.REKDIN_DATA_DIR

    const workspace = await loadWorkspaceModule()
    const dataDir = path.dirname(workspace.getArtifactsDir())

    expect(workspace.getWorkspaceRoot()).toBe(process.cwd())
    expect(workspace.getUploadsDir()).toBe(path.join(dataDir, "uploads"))
    expect(workspace.getPdfsDir()).toBe(path.join(dataDir, "pdfs"))
  })

  it("honors a runtime workspace root selection", async () => {
    const workspace = await loadWorkspaceModule()
    workspace.setWorkspaceRoot("/tmp/rekdin-custom-root")

    expect(workspace.getWorkspaceRoot()).toBe(path.resolve("/tmp/rekdin-custom-root"))
    expect(workspace.resolveWorkspacePath("src/index.ts")).toBe(
      path.resolve("/tmp/rekdin-custom-root", "src/index.ts")
    )
  })

  it("prefers the per-turn workspace root while resolving tool paths", async () => {
    vi.resetModules()
    const workspace = await import("./workspace")
    const { runWithToolExecutionContext } = await import("./tool-execution-context")
    const selectedWorkspace = path.resolve("/tmp/rekdin-selected-root")

    workspace.setWorkspaceRoot("/tmp/rekdin-app-root")

    await runWithToolExecutionContext({ workspaceRoot: selectedWorkspace }, async () => {
      expect(workspace.getWorkspaceRoot()).toBe(selectedWorkspace)
      expect(workspace.resolveWorkspacePath("demo.md")).toBe(
        path.join(selectedWorkspace, "demo.md")
      )
    })

    expect(workspace.getWorkspaceRoot()).toBe(path.resolve("/tmp/rekdin-app-root"))
  })

  it("blocks direct access to generated dependency and build folders", async () => {
    const workspace = await loadWorkspaceModule()
    workspace.setWorkspaceRoot("/tmp/rekdin-custom-root")

    expect(() => workspace.resolveWorkspacePath("node_modules/react/index.js")).toThrow(
      /protected workspace directory "node_modules"/i
    )
    expect(() => workspace.resolveWorkspacePath("packages/app/.next/server/app.js")).toThrow(
      /protected workspace directory ".next"/i
    )
    expect(workspace.resolveWorkspacePath("src/index.ts")).toBe(
      path.resolve("/tmp/rekdin-custom-root", "src/index.ts")
    )
  })
})
