import { tool } from "@langchain/core/tools"
import { readdir, readFile, stat } from "fs/promises"
import path from "path"
import { Project } from "ts-morph"
import { z } from "zod"

import {
  assertWorkspacePathAllowed,
  ensureWorkspaceDirs,
  getWorkspaceRoot,
  isBlockedWorkspaceDirectoryName,
  resolveWorkspacePath,
} from "../../workspace"
import { collectWorkspaceFiles, readWorkspaceText } from "../workspace/workspace-fs"

const CODE_MAP_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"])
const CODE_MAP_MAX_FILE_BYTES = 1_000_000

function isLikelyReactComponentName(name: string) {
  return /^[A-Z][A-Za-z0-9]*$/.test(name)
}

async function readPackageMetadata() {
  try {
    const raw = await readFile(resolveWorkspacePath("package.json"), "utf-8")
    const parsed = JSON.parse(raw) as {
      name?: string
      scripts?: Record<string, string>
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    return {
      name: parsed.name,
      scripts: parsed.scripts ?? {},
      dependencies: Object.keys(parsed.dependencies ?? {}),
      devDependencies: Object.keys(parsed.devDependencies ?? {}),
    }
  } catch {
    return null
  }
}

async function collectCodeMapFiles({
  root,
  relativeRoot,
  maxDepth,
  maxFiles,
}: {
  root: string
  relativeRoot: string
  maxDepth: number
  maxFiles: number
}) {
  const files: Array<{ abs: string; rel: string; size: number }> = []
  const skipped: Array<{ path: string; reason: string }> = []

  async function visit(absPath: string, relPath: string, depth: number) {
    if (files.length >= maxFiles) return
    assertWorkspacePathAllowed(absPath)
    const info = await stat(absPath)

    if (info.isFile()) {
      const ext = path.extname(absPath)
      if (!CODE_MAP_EXTENSIONS.has(ext)) return
      if (info.size > CODE_MAP_MAX_FILE_BYTES) {
        skipped.push({
          path: relPath,
          reason: `File is larger than ${CODE_MAP_MAX_FILE_BYTES} bytes`,
        })
        return
      }
      files.push({ abs: absPath, rel: relPath || path.basename(absPath), size: info.size })
      return
    }

    if (!info.isDirectory() || depth >= maxDepth) return
    const entries = (await readdir(absPath, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name)
    )
    for (const entry of entries) {
      if (files.length >= maxFiles) break
      const childRel = relPath ? `${relPath}/${entry.name}` : entry.name
      if (entry.isDirectory() && isBlockedWorkspaceDirectoryName(entry.name)) {
        skipped.push({ path: childRel, reason: "Protected generated dependency/build directory" })
        continue
      }
      if (entry.isSymbolicLink()) {
        skipped.push({ path: childRel, reason: "Symlink skipped" })
        continue
      }
      await visit(path.join(absPath, entry.name), childRel, depth + 1)
    }
  }

  await visit(root, relativeRoot, 0)
  return { files, skipped, truncated: files.length >= maxFiles }
}

/**
 * Builds a bounded AST map of the workspace without sending full source text to the model.
 */
export const codeMapTool = tool(
  async ({ path: inputPath, maxFiles, maxDepth }) => {
    await ensureWorkspaceDirs()
    const target = inputPath ? resolveWorkspacePath(inputPath) : getWorkspaceRoot()
    const relativeRoot = inputPath?.replace(/^\.\//, "") ?? ""
    const limit = Math.min(Math.max(maxFiles ?? 120, 1), 500)
    const depthLimit = Math.min(Math.max(maxDepth ?? 6, 1), 12)
    const { files, skipped, truncated } = await collectCodeMapFiles({
      root: target,
      relativeRoot,
      maxDepth: depthLimit,
      maxFiles: limit,
    })
    const project = new Project({ skipFileDependencyResolution: true })
    const fileSummaries = files.map((file) => {
      try {
        const sourceFile = project.addSourceFileAtPath(file.abs)
        const functions = sourceFile
          .getFunctions()
          .map((fn) => fn.getName())
          .filter((name): name is string => Boolean(name))
        const classes = sourceFile.getClasses().map((cls) => cls.getName() ?? "(anonymous)")
        const interfaces = sourceFile.getInterfaces().map((node) => node.getName())
        const typeAliases = sourceFile.getTypeAliases().map((node) => node.getName())
        const enums = sourceFile.getEnums().map((node) => node.getName())
        const variables = sourceFile
          .getVariableDeclarations()
          .map((node) => node.getName())
          .filter(Boolean)
        const exported = Array.from(sourceFile.getExportedDeclarations().keys()).slice(0, 80)
        const components = [...functions, ...classes, ...variables].filter(
          isLikelyReactComponentName
        )

        return {
          path: file.rel,
          size: file.size,
          imports: sourceFile
            .getImportDeclarations()
            .map((decl) => decl.getModuleSpecifierValue())
            .slice(0, 80),
          exports: exported,
          symbols: {
            functions,
            classes,
            interfaces,
            typeAliases,
            enums,
            variables: variables.slice(0, 60),
          },
          reactComponents: components,
        }
      } catch (err) {
        return {
          path: file.rel,
          size: file.size,
          error: err instanceof Error ? err.message : "Unable to parse file",
        }
      }
    })

    return {
      type: "code_map",
      path: inputPath ?? ".",
      fileCount: files.length,
      truncated,
      skipped,
      package: await readPackageMetadata(),
      files: fileSummaries,
    }
  },
  {
    name: "code_map",
    description:
      "Inspect TypeScript/JavaScript repository structure using AST metadata without reading full source contents.",
    schema: z.object({
      path: z.string().optional(),
      maxFiles: z.number().int().min(1).max(500).optional(),
      maxDepth: z.number().int().min(1).max(12).optional(),
    }),
  }
)

export const routeMapTool = tool(
  async () => {
    const { files } = await collectWorkspaceFiles({
      maxFiles: 1000,
      extensions: [".ts", ".tsx", ".js", ".jsx"],
      includeHidden: false,
    })
    const routes = files
      .filter((file) =>
        /(^|\/)(page|layout|route|loading|error|template)\.[tj]sx?$/.test(file.path)
      )
      .map((file) => {
        const appMatch = file.path.match(
          /^src\/app\/(.+)\/(page|route|layout|loading|error|template)\.[tj]sx?$/
        )
        const kind = path.basename(file.path).split(".")[0]
        const route = appMatch
          ? `/${appMatch[1]
              .replace(/\([^)]*\)\//g, "")
              .replace(/\/?page$/, "")
              .replace(/\/route$/, "")}`.replace(/\/+/g, "/")
          : null
        return { path: file.path, kind, route: route === "/." ? "/" : route }
      })
    return { type: "route_map", routes }
  },
  {
    name: "route_map",
    description: "Map Next.js app route files to route-like paths.",
    schema: z.object({}),
  }
)

export const testMapTool = tool(
  async () => {
    const { files } = await collectWorkspaceFiles({
      maxFiles: 2000,
      extensions: [".ts", ".tsx", ".js", ".jsx"],
    })
    const tests = files
      .filter((file) => /(^|\/)__tests__\/|[.-](test|spec)\.[tj]sx?$/.test(file.path))
      .map((file) => ({ path: file.path, size: file.size }))

    let scripts: Record<string, string> = {}
    try {
      const pkg = JSON.parse(await readWorkspaceText("package.json")) as Record<string, unknown>
      scripts = (pkg.scripts as Record<string, string> | undefined) ?? {}
    } catch {
      // ignore
    }
    return {
      type: "test_map",
      testCount: tests.length,
      tests,
      scripts,
    }
  },
  {
    name: "test_map",
    description: "List test files and package test scripts.",
    schema: z.object({}),
  }
)

export const configInventoryTool = tool(
  async () => {
    const configPattern =
      /(^|\/)(package\.json|tsconfig.*\.json|next\.config\.[cm]?[tj]s|vite\.config\.[cm]?[tj]s|vitest\.config\.[cm]?[tj]s|tailwind\.config\.[cm]?[tj]s|postcss\.config\.[cm]?[tj]s|eslint\.config\.[cm]?[tj]s|\.prettierrc.*|components\.json)$/
    const { files } = await collectWorkspaceFiles({ maxFiles: 2000, includeHidden: true })
    return {
      type: "config_inventory",
      configs: files
        .filter((file) => configPattern.test(file.path))
        .map(({ path, size, modified }) => ({ path, size, modified })),
    }
  },
  {
    name: "config_inventory",
    description: "List common project configuration files.",
    schema: z.object({}),
  }
)

export const envInventoryTool = tool(
  async () => {
    const { files } = await collectWorkspaceFiles({ maxFiles: 200, includeHidden: true })
    const envFiles = files.filter((file) => /(^|\/)\.env($|\.)/.test(file.path))
    const entries = await Promise.all(
      envFiles.map(async (file) => {
        const content = await readFile(file.abs, "utf-8").catch(() => "")
        return {
          path: file.path,
          keys: content
            .split(/\r?\n/)
            .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1])
            .filter(Boolean),
        }
      })
    )
    return { type: "env_inventory", files: entries }
  },
  {
    name: "env_inventory",
    description: "List .env files and variable names only; never returns secret values.",
    schema: z.object({}),
  }
)

export const lockfileSummaryTool = tool(
  async () => {
    const lockfiles = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb"]
    const found = []
    for (const file of lockfiles) {
      const resolved = path.join(getWorkspaceRoot(), file)
      const exists = await stat(resolved)
        .then(() => true)
        .catch(() => false)
      if (!exists) continue
      const info = await stat(resolved)
      let packageCount: number | undefined
      if (file === "package-lock.json") {
        const parsed = JSON.parse(await readFile(resolved, "utf-8")) as { packages?: object }
        packageCount = Object.keys(parsed.packages ?? {}).length
      }
      found.push({ path: file, size: info.size, modified: info.mtime.toISOString(), packageCount })
    }
    return { type: "lockfile_summary", lockfiles: found }
  },
  { name: "lockfile_summary", description: "Summarize dependency lockfiles.", schema: z.object({}) }
)
