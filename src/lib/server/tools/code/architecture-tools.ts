import path from "path"
import { z } from "zod"

import { apiRouteMapTool } from "../api/api-contract-tools"
import {
  codeFiles,
  collectTextFiles,
  exportedNames,
  importedSpecifiers,
  linesOf,
  readBounded,
} from "../shared/code-utils"
import { gitOutput } from "../shared/command"
import { boundedLimit } from "../shared/formatting"
import { emptySchema, pathLimitSchema, toolDefinition } from "../shared/tool-base"
import { readPackageJson } from "../workspace/workspace-fs"

export const architectureSummaryTool = toolDefinition(
  "architecture_summary",
  "Generate a structured architecture summary from routes, components, APIs, stores, and dependencies.",
  emptySchema,
  async () => {
    const { files } = await collectTextFiles({ maxFiles: 3000 })
    const domains = ["app", "components", "contexts", "lib/server", "types", "docs"].map(
      (domain) => {
        const domainFiles = files.filter(
          (file) => file.path.startsWith(`src/${domain}`) || file.path.startsWith(domain)
        )
        return {
          name: domain,
          fileCount: domainFiles.length,
          files: domainFiles.slice(0, 20).map((file) => file.path),
        }
      }
    )
    const routes = (await apiRouteMapTool.invoke({})) as { routes?: unknown[] }
    const pkg = await readPackageJson()
    return {
      type: "architecture_summary",
      appType: "Next.js App Router",
      fileCount: files.length,
      domains,
      apiRoutes: routes.routes ?? [],
      externalServices: Object.keys(
        (pkg.dependencies as Record<string, string> | undefined) ?? {}
      ).filter((name) => /openai|anthropic|cloud|github|puppeteer/i.test(name)),
    }
  }
)

export const featureMapTool = toolDefinition(
  "feature_map",
  "Map features by folder, route, components, hooks, APIs, and tests.",
  pathLimitSchema,
  async ({ limit }) => {
    const { files } = await collectTextFiles({ maxFiles: boundedLimit(limit, 2000, 5000) })
    const featureNames = [
      "chat",
      "workspace",
      "tools",
      "settings",
      "browser",
      "replay",
      "trace",
      "artifact",
      "workflow",
    ]
    const features = featureNames.map((name) => ({
      name,
      files: files
        .filter((file) => file.path.toLowerCase().includes(name))
        .map((file) => file.path)
        .slice(0, 80),
    }))
    return { type: "feature_map", features }
  }
)

export const ownershipMapTool = toolDefinition(
  "ownership_map",
  "Detect ownership zones from folders and git commit authors.",
  z.object({ limit: z.number().int().optional() }),
  async ({ limit }) => {
    const out = await gitOutput(
      `git log --format='%an' --name-only -n ${boundedLimit(limit, 200, 1000)}`
    )
    const owners = new Map<string, Map<string, number>>()
    let author = ""
    for (const line of out.stdout.split(/\r?\n/)) {
      if (!line.trim()) continue
      if (!line.includes("/") && !line.includes(".")) {
        author = line.trim()
        continue
      }
      const zone = line.split("/").slice(0, 3).join("/")
      const bucket = owners.get(zone) ?? new Map<string, number>()
      bucket.set(author, (bucket.get(author) ?? 0) + 1)
      owners.set(zone, bucket)
    }
    return {
      type: "ownership_map",
      zones: [...owners.entries()].slice(0, 100).map(([zone, counts]) => ({
        zone,
        authors: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      })),
    }
  }
)

export const complexityHotspotsTool = toolDefinition(
  "complexity_hotspots",
  "Find files with high complexity risk signals.",
  pathLimitSchema,
  async ({ path: pathName, limit }) => {
    const { files } = await codeFiles(pathName, boundedLimit(limit, 500, 2000))
    const hotspots = []
    for (const file of files) {
      const content = await readBounded(file)
      const lineCount = linesOf(content).length
      const imports = importedSpecifiers(content).length
      const conditionals = (content.match(/\b(if|switch|case|for|while|catch)\b/g) ?? []).length
      const exports = exportedNames(content).length
      const score = Math.min(
        100,
        Math.round(lineCount / 20 + imports * 2 + conditionals + exports * 2)
      )
      const reasons = [
        lineCount > 400 ? "large file" : "",
        imports > 25 ? "many imports" : "",
        conditionals > 40 ? "many branches" : "",
        exports > 20 ? "many exports" : "",
      ].filter(Boolean)
      if (score >= 30)
        hotspots.push({
          path: file.path,
          score,
          lineCount,
          imports,
          conditionals,
          exports,
          reasons,
        })
    }
    return {
      type: "complexity_hotspots",
      hotspots: hotspots.sort((a, b) => b.score - a.score).slice(0, 100),
    }
  }
)

export const couplingReportTool = toolDefinition(
  "coupling_report",
  "Find highly coupled files/modules and cross-domain imports.",
  pathLimitSchema,
  async ({ limit }) => {
    const { files } = await codeFiles(undefined, boundedLimit(limit, 1000, 3000))
    const importedBy = new Map<string, string[]>()
    const broadImporters = []
    for (const file of files) {
      const imports = importedSpecifiers(await readBounded(file))
      const domains = new Set(imports.map((spec) => spec.split("/").slice(0, 3).join("/")))
      if (domains.size > 8)
        broadImporters.push({
          file: file.path,
          domains: domains.size,
          imports: imports.slice(0, 20),
        })
      for (const spec of imports) importedBy.set(spec, [...(importedBy.get(spec) ?? []), file.path])
    }
    return {
      type: "coupling_report",
      mostImported: [...importedBy.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 50)
        .map(([name, files]) => ({ name, count: files.length, importedBy: files.slice(0, 20) })),
      broadImporters: broadImporters.slice(0, 50),
    }
  }
)

export const circularDependencyCheckTool = toolDefinition(
  "circular_dependency_check",
  "Detect simple circular dependency paths from relative imports.",
  pathLimitSchema,
  async ({ limit }) => {
    const { files } = await codeFiles(undefined, boundedLimit(limit, 1000, 3000))
    const graph = new Map<string, string[]>()
    const fileSet = new Set(files.map((file) => file.path.replace(/\.[tj]sx?$/, "")))
    for (const file of files) {
      const base = file.path.replace(/\.[tj]sx?$/, "")
      const dir = path.dirname(file.path)
      const imports = importedSpecifiers(await readBounded(file))
        .filter((spec) => spec.startsWith("."))
        .map((spec) => path.normalize(path.join(dir, spec)).replace(/\\/g, "/"))
        .filter((spec) => fileSet.has(spec))
      graph.set(base, imports)
    }
    const cycles: string[][] = []
    for (const [node, deps] of graph) {
      for (const dep of deps) if (graph.get(dep)?.includes(node)) cycles.push([node, dep, node])
    }
    return { type: "circular_dependency_check", cycles: cycles.slice(0, 100) }
  }
)
