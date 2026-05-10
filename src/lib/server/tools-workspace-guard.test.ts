import { mkdir, mkdtemp, writeFile } from "fs/promises"
import os from "os"
import path from "path"
import { afterEach, describe, expect, it, vi } from "vitest"

describe("workspace directory guard", () => {
  afterEach(() => {
    vi.resetModules()
  })

  it("shows protected generated directories during recursive listing but does not expand them", async () => {
    const repo = await mkdtemp(path.join(os.tmpdir(), "rekdin-guard-"))
    await mkdir(path.join(repo, "src"), { recursive: true })
    await mkdir(path.join(repo, "node_modules", "huge-package"), { recursive: true })
    await mkdir(path.join(repo, ".next", "server"), { recursive: true })
    await writeFile(path.join(repo, "src", "app.ts"), "const marker = 'audit-needle'\n", "utf-8")
    await writeFile(
      path.join(repo, "node_modules", "huge-package", "index.js"),
      "const marker = 'audit-needle'\n",
      "utf-8"
    )
    await writeFile(
      path.join(repo, ".next", "server", "bundle.js"),
      "const marker = 'audit-needle'\n",
      "utf-8"
    )

    const { setWorkspaceRoot } = await import("./workspace")
    setWorkspaceRoot(repo)
    const { fileSearchTool, listFilesTool } = await import("./tools")

    const result = (await listFilesTool.invoke({ recursive: true })) as unknown as {
      files: Array<{ path: string; protected?: boolean; skipped?: boolean; reason?: string }>
    }

    expect(result.files.map((file) => file.path)).toContain("src/app.ts")
    expect(result.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "node_modules",
          protected: true,
          skipped: true,
        }),
        expect.objectContaining({
          path: ".next",
          protected: true,
          skipped: true,
        }),
      ])
    )
    expect(result.files.some((file) => file.path.includes("node_modules/"))).toBe(false)
    expect(result.files.some((file) => file.path.includes(".next/"))).toBe(false)

    const searchResult = (await fileSearchTool.invoke({ query: "audit-needle" })) as unknown as {
      matches: Array<{ file: string }>
    }
    expect(searchResult.matches.some((match) => match.file.endsWith("src/app.ts"))).toBe(true)
    expect(searchResult.matches.some((match) => match.file.includes("node_modules"))).toBe(false)
    expect(searchResult.matches.some((match) => match.file.includes(".next"))).toBe(false)
  })

  it("rejects direct protected-directory access unless the agent has approval context", async () => {
    const repo = await mkdtemp(path.join(os.tmpdir(), "rekdin-guard-"))
    await mkdir(path.join(repo, "node_modules", "huge-package"), { recursive: true })
    await writeFile(
      path.join(repo, "node_modules", "huge-package", "index.js"),
      "module.exports = 1\n",
      "utf-8"
    )

    const { setWorkspaceRoot } = await import("./workspace")
    const { runWithToolExecutionContext } = await import("./tool-execution-context")
    setWorkspaceRoot(repo)
    const { executeCommandTool, fileSearchTool, readFileTool } = await import("./tools")

    await expect(
      readFileTool.invoke({ path: "node_modules/huge-package/index.js" })
    ).rejects.toThrow(/protected workspace directory "node_modules"/i)
    await expect(executeCommandTool.invoke({ command: "ls node_modules" })).rejects.toThrow(
      /protected workspace directory "node_modules"/i
    )
    const safeCommand = (await executeCommandTool.invoke({ command: "echo build" })) as {
      stdout: string
    }
    expect(safeCommand.stdout.trim()).toBe("build")

    await runWithToolExecutionContext(
      { workspaceRoot: repo, allowProtectedWorkspaceAccess: true },
      async () => {
        const readResult = (await readFileTool.invoke({
          path: "node_modules/huge-package/index.js",
        })) as { content: string }
        expect(readResult.content).toContain("module.exports")

        const searchResult = (await fileSearchTool.invoke({
          path: "node_modules",
          query: "module.exports",
        })) as unknown as { matches: Array<{ file: string }> }
        expect(searchResult.matches.some((match) => match.file.includes("node_modules"))).toBe(true)
      }
    )
  })
})
