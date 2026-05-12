import { tool } from "@langchain/core/tools"
import crypto from "crypto"
import { readFile } from "fs/promises"
import path from "path"
import { Project } from "ts-morph"
import { z } from "zod"

import { collectWorkspaceFiles, readWorkspaceText } from "../workspace/workspace-fs"

export function codeSymbolSummary(sourcePath: string, content: string) {
  const project = new Project({ useInMemoryFileSystem: true, skipFileDependencyResolution: true })
  const sourceFile = project.createSourceFile(sourcePath, content, { overwrite: true })
  const functions = sourceFile
    .getFunctions()
    .map((node) => ({ name: node.getName() ?? "(anonymous)", line: node.getStartLineNumber() }))
  const classes = sourceFile
    .getClasses()
    .map((node) => ({ name: node.getName() ?? "(anonymous)", line: node.getStartLineNumber() }))
  const interfaces = sourceFile
    .getInterfaces()
    .map((node) => ({ name: node.getName(), line: node.getStartLineNumber() }))
  const typeAliases = sourceFile
    .getTypeAliases()
    .map((node) => ({ name: node.getName(), line: node.getStartLineNumber() }))
  const variables = sourceFile
    .getVariableDeclarations()
    .map((node) => ({ name: node.getName(), line: node.getStartLineNumber() }))
  return {
    imports: sourceFile.getImportDeclarations().map((decl) => decl.getModuleSpecifierValue()),
    exports: Array.from(sourceFile.getExportedDeclarations().keys()),
    symbols: { functions, classes, interfaces, typeAliases, variables: variables.slice(0, 100) },
  }
}

export const fileOutlineTool = tool(
  async ({ path: filePath }) => {
    const content = await readWorkspaceText(filePath)
    return { type: "file_outline", path: filePath, ...codeSymbolSummary(filePath, content) }
  },
  {
    name: "file_outline",
    description: "Return imports, exports, and top-level symbols for a TypeScript/JavaScript file.",
    schema: z.object({ path: z.string().min(1) }),
  }
)

export const symbolSearchTool = tool(
  async ({ query, path: inputPath, maxResults }) => {
    const { files, skipped } = await collectWorkspaceFiles({
      path: inputPath,
      maxFiles: 1000,
      extensions: [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"],
    })
    const q = query.toLowerCase()
    const limit = Math.min(Math.max(maxResults ?? 50, 1), 200)
    const results: Array<Record<string, unknown>> = []
    for (const file of files) {
      if (results.length >= limit) break
      const content = await readFile(file.abs, "utf-8").catch(() => "")
      if (!content) continue
      const outline = codeSymbolSummary(file.path, content)
      for (const [kind, values] of Object.entries(outline.symbols)) {
        for (const value of values as Array<{ name: string; line: number }>) {
          if (String(value.name).toLowerCase().includes(q)) {
            results.push({ path: file.path, kind, name: value.name, line: value.line })
            if (results.length >= limit) break
          }
        }
      }
    }
    return { type: "symbol_search", query, results, skipped, truncated: results.length >= limit }
  },
  {
    name: "symbol_search",
    description: "Search TypeScript/JavaScript symbols by name without reading full files.",
    schema: z.object({
      query: z.string().min(1),
      path: z.string().optional(),
      maxResults: z.number().int().min(1).max(200).optional(),
    }),
  }
)

export const symbolReferencesTool = tool(
  async ({ symbol, path: searchPath, maxResults }) => {
    const { fileSearchTool } = await import("../workspace/workspace-tools")
    const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const result = (await fileSearchTool.invoke({
      query: `\\b${escaped}\\b`,
      path: searchPath,
      maxResults: maxResults ?? 100,
    })) as Record<string, unknown>
    return { ...result, type: "symbol_references", symbol }
  },
  {
    name: "symbol_references",
    description: "Find textual references to a symbol in workspace files.",
    schema: z.object({
      symbol: z.string().min(1),
      path: z.string().optional(),
      maxResults: z.number().int().min(1).max(1000).optional(),
    }),
  }
)

export const dependencyGraphTool = tool(
  async ({ path: inputPath, maxFiles }) => {
    const { files, skipped, truncated } = await collectWorkspaceFiles({
      path: inputPath,
      maxFiles: maxFiles ?? 250,
      extensions: [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"],
    })
    const nodes = files.map((file) => file.path)
    const nodeSet = new Set(nodes)
    const edges: Array<{ from: string; to: string; specifier: string; external: boolean }> = []
    for (const file of files) {
      const content = await readFile(file.abs, "utf-8").catch(() => "")
      if (!content) continue
      const outline = codeSymbolSummary(file.path, content)
      for (const specifier of outline.imports) {
        const external = !specifier.startsWith(".") && !specifier.startsWith("@/")
        let target = specifier
        if (specifier.startsWith(".")) {
          const joined = path.normalize(path.join(path.dirname(file.path), specifier))
          target =
            nodes.find((candidate) => candidate === joined || candidate.startsWith(`${joined}.`)) ??
            joined
        } else if (specifier.startsWith("@/")) {
          const joined = specifier.replace(/^@\//, "src/")
          target =
            nodes.find((candidate) => candidate === joined || candidate.startsWith(`${joined}.`)) ??
            joined
        }
        edges.push({
          from: file.path,
          to: target,
          specifier,
          external: external || !nodeSet.has(target),
        })
      }
    }
    return {
      type: "dependency_graph",
      path: inputPath ?? ".",
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodes: nodes.slice(0, 300),
      edges: edges.slice(0, 800),
      skipped,
      truncated,
    }
  },
  {
    name: "dependency_graph",
    description: "Build a bounded import dependency graph for JS/TS files.",
    schema: z.object({
      path: z.string().optional(),
      maxFiles: z.number().int().min(1).max(500).optional(),
    }),
  }
)

export const duplicateCodeCandidatesTool = tool(
  async ({ minBytes }) => {
    const { files } = await collectWorkspaceFiles({
      maxFiles: 2000,
      extensions: [".ts", ".tsx", ".js", ".jsx", ".css", ".md"],
    })
    const groups = new Map<string, Array<{ path: string; size: number }>>()
    for (const file of files) {
      if (file.size < (minBytes ?? 80)) continue
      const content = await readFile(file.abs, "utf-8").catch(() => "")
      const normalized = content.replace(/\s+/g, " ").trim()
      if (!normalized) continue
      const hash = crypto.createHash("sha1").update(normalized).digest("hex")
      groups.set(hash, [...(groups.get(hash) ?? []), { path: file.path, size: file.size }])
    }
    return {
      type: "duplicate_code_candidates",
      groups: Array.from(groups.entries())
        .filter(([, entries]) => entries.length > 1)
        .map(([hash, entries]) => ({ hash, entries }))
        .slice(0, 50),
    }
  },
  {
    name: "duplicate_code_candidates",
    description: "Find exact normalized duplicate text/code files as refactor candidates.",
    schema: z.object({ minBytes: z.number().int().min(1).max(10000).optional() }),
  }
)

export const deadCodeCandidatesTool = tool(
  async ({ path: inputPath }) => {
    const { files } = await collectWorkspaceFiles({
      path: inputPath,
      maxFiles: 1000,
      extensions: [".ts", ".tsx", ".js", ".jsx"],
    })
    const contents = await Promise.all(
      files.map(async (file) => ({
        file,
        content: await readFile(file.abs, "utf-8").catch(() => ""),
      }))
    )
    const allText = contents.map((entry) => entry.content).join("\n")
    const candidates: Array<Record<string, unknown>> = []
    for (const { file, content } of contents) {
      if (!content) continue
      const outline = codeSymbolSummary(file.path, content)
      for (const exported of outline.exports) {
        const count = (
          allText.match(
            new RegExp(`\\b${exported.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g")
          ) ?? []
        ).length
        if (count <= 1)
          candidates.push({ path: file.path, export: exported, referenceCount: count })
      }
    }
    return { type: "dead_code_candidates", candidates: candidates.slice(0, 100) }
  },
  {
    name: "dead_code_candidates",
    description: "Best-effort exported symbol list with few/no textual references.",
    schema: z.object({ path: z.string().optional() }),
  }
)
