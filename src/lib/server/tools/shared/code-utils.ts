import { readFile } from "fs/promises"

import { collectWorkspaceFiles } from "../workspace/workspace-fs"

export const CODE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"]
export const TEXT_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mts",
  ".cts",
  ".json",
  ".md",
  ".mdx",
  ".css",
  ".scss",
  ".html",
  ".yml",
  ".yaml",
  ".sql",
  ".prisma",
]
export const UI_EXTENSIONS = [".tsx", ".jsx"]

export type WorkspaceFile = Awaited<ReturnType<typeof collectWorkspaceFiles>>["files"][number]

export function linesOf(text: string) {
  return text.split(/\r?\n/)
}

export async function collectTextFiles(options?: {
  path?: string
  extensions?: string[]
  maxFiles?: number
  includeHidden?: boolean
}) {
  return collectWorkspaceFiles({
    path: options?.path,
    extensions: options?.extensions ?? TEXT_EXTENSIONS,
    maxFiles: options?.maxFiles ?? 1000,
    includeHidden: options?.includeHidden ?? false,
  })
}

export async function readBounded(file: WorkspaceFile, maxBytes = 800_000) {
  if (file.size > maxBytes) return ""
  return readFile(file.abs, "utf-8").catch(() => "")
}

export async function codeFiles(pathName?: string, maxFiles = 1000) {
  const { files, skipped, truncated } = await collectWorkspaceFiles({
    path: pathName,
    extensions: CODE_EXTENSIONS,
    maxFiles,
  })
  return { files, skipped, truncated }
}

export function importedSpecifiers(content: string) {
  return Array.from(content.matchAll(/import\s+(?:[^'"]+\s+from\s+)?["']([^"']+)["']/g))
    .map((match) => match[1])
    .slice(0, 80)
}

export function exportedNames(content: string) {
  return Array.from(
    content.matchAll(
      /export\s+(?:default\s+)?(?:function|const|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g
    )
  ).map((match) => match[1])
}

export function componentNames(content: string) {
  const names = new Set<string>()
  for (const match of content.matchAll(
    /(?:export\s+)?(?:function|const)\s+([A-Z][A-Za-z0-9]*)\b/g
  )) {
    const snippet = content.slice(match.index ?? 0, (match.index ?? 0) + 1200)
    if (/<[A-Za-z][\w.:]*[\s>]/.test(snippet) || /React\./.test(snippet)) names.add(match[1])
  }
  return [...names]
}

export function hookNames(content: string) {
  return Array.from(
    content.matchAll(
      /(?:export\s+)?function\s+(use[A-Z][A-Za-z0-9]*)\b|const\s+(use[A-Z][A-Za-z0-9]*)\s*=/g
    )
  )
    .map((match) => match[1] || match[2])
    .filter(Boolean)
}

export function routeFromFile(filePath: string) {
  const match = filePath.match(/^src\/app\/(.+)\/route\.[tj]s$/)
  if (!match) return null
  return `/${match[1]
    .replace(/\([^)]*\)\//g, "")
    .replace(/\/route$/, "")
    .replace(/\/+/g, "/")}`
}

export function appRouteFromSegment(filePath: string) {
  const match = filePath.match(
    /^src\/app\/(.+)\/(page|layout|route|loading|error|template)\.[tj]sx?$/
  )
  if (!match) return null
  return {
    route:
      `/${match[1].replace(/\([^)]*\)\//g, "").replace(/\/+/g, "/")}`.replace(/\/$/, "") || "/",
    kind: match[2],
  }
}
