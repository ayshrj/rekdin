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

  it("maps code structure without reading protected generated directories", async () => {
    const repo = await mkdtemp(path.join(os.tmpdir(), "rekdin-code-map-"))
    await mkdir(path.join(repo, "src"), { recursive: true })
    await mkdir(path.join(repo, "node_modules", "pkg"), { recursive: true })
    await writeFile(
      path.join(repo, "package.json"),
      JSON.stringify({
        name: "demo",
        scripts: { test: "vitest" },
        dependencies: { next: "1.0.0" },
      }),
      "utf-8"
    )
    await writeFile(
      path.join(repo, "src", "widget.tsx"),
      [
        'import React from "react"',
        "export function Widget() { return <div /> }",
        "export const useWidget = () => Widget",
      ].join("\n"),
      "utf-8"
    )
    await writeFile(
      path.join(repo, "node_modules", "pkg", "index.ts"),
      "export const hidden = 1",
      "utf-8"
    )

    const { setWorkspaceRoot } = await import("./workspace")
    setWorkspaceRoot(repo)
    const { codeMapTool } = await import("./tools")
    const result = (await codeMapTool.invoke({})) as unknown as {
      type: string
      fileCount: number
      package: { name: string; scripts: Record<string, string>; dependencies: string[] }
      skipped: Array<{ path: string }>
      files: Array<{
        path: string
        imports: string[]
        exports: string[]
        reactComponents: string[]
      }>
    }

    expect(result.type).toBe("code_map")
    expect(result.package.name).toBe("demo")
    expect(result.package.scripts.test).toBe("vitest")
    expect(result.package.dependencies).toContain("next")
    expect(result.skipped.some((entry) => entry.path === "node_modules")).toBe(true)
    expect(result.files.some((file) => file.path.includes("node_modules"))).toBe(false)
    expect(result.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "src/widget.tsx",
          imports: ["react"],
          exports: expect.arrayContaining(["Widget", "useWidget"]),
          reactComponents: expect.arrayContaining(["Widget"]),
        }),
      ])
    )
  })

  it("runs deterministic workspace intelligence and data tools", async () => {
    const repo = await mkdtemp(path.join(os.tmpdir(), "rekdin-expanded-tools-"))
    await mkdir(path.join(repo, "src", "app", "api", "hello"), { recursive: true })
    await writeFile(
      path.join(repo, "package.json"),
      JSON.stringify({
        scripts: { test: "vitest", typecheck: "tsc --noEmit" },
        dependencies: { next: "1.0.0" },
      }),
      "utf-8"
    )
    await writeFile(
      path.join(repo, "src", "app", "api", "hello", "route.ts"),
      "export function GET() { return Response.json({ ok: true }) }\n",
      "utf-8"
    )
    await writeFile(
      path.join(repo, "src", "util.ts"),
      "export function parseThing(value: string) { return value.trim() }\n",
      "utf-8"
    )
    await writeFile(path.join(repo, "data.csv"), "name,score\nAda,10\nLinus,9\n", "utf-8")
    await writeFile(
      path.join(repo, "config.json"),
      JSON.stringify({ app: { name: "demo" } }),
      "utf-8"
    )
    await writeFile(
      path.join(repo, ".env"),
      "OPENAI_API_KEY=sk-testsecretvaluethatshouldnotleak\n",
      "utf-8"
    )

    vi.resetModules()
    const { setWorkspaceRoot } = await import("./workspace")
    setWorkspaceRoot(repo)
    const {
      csvPreviewTool,
      fileOutlineTool,
      jsonQueryTool,
      routeMapTool,
      secretScanTool,
      symbolSearchTool,
      workspaceStatsTool,
    } = await import("./tools")

    const stats = (await workspaceStatsTool.invoke({})) as {
      fileCount: number
      byExtension: Record<string, number>
    }
    expect(stats.fileCount).toBeGreaterThanOrEqual(4)
    expect(stats.byExtension[".ts"]).toBeGreaterThanOrEqual(1)

    const outline = (await fileOutlineTool.invoke({ path: "src/util.ts" })) as {
      symbols: { functions: Array<{ name: string }> }
    }
    expect(outline.symbols.functions).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "parseThing" })])
    )

    const symbols = (await symbolSearchTool.invoke({ query: "parse" })) as unknown as {
      results: Array<{ name: string }>
    }
    expect(symbols.results.some((result) => result.name === "parseThing")).toBe(true)

    const routes = (await routeMapTool.invoke({})) as { routes: Array<{ path: string }> }
    expect(routes.routes.some((route) => route.path.endsWith("route.ts"))).toBe(true)

    const csv = (await csvPreviewTool.invoke({ path: "data.csv" })) as {
      headers: string[]
      rows: string[][]
    }
    expect(csv.headers).toEqual(["name", "score"])
    expect(csv.rows[0]).toEqual(["Ada", "10"])

    const json = (await jsonQueryTool.invoke({ path: "config.json", query: "$.app.name" })) as {
      value: string
    }
    expect(json.value).toBe("demo")

    const secrets = (await secretScanTool.invoke({})) as unknown as {
      findings: Array<{ preview: string }>
    }
    expect(secrets.findings.length).toBeGreaterThan(0)
    expect(JSON.stringify(secrets.findings)).not.toContain("sk-testsecretvalue")
  })
})
