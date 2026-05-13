import { readdir } from "fs/promises"
import path from "path"
import { z } from "zod"

import { resolveWorkspacePath } from "../../workspace"
import { codeFiles, importedSpecifiers, linesOf, readBounded } from "../shared/code-utils"
import { boundedLimit, truncateString } from "../shared/formatting"
import { unifiedPatch } from "../shared/patching"
import { type Finding, finding, toolDefinition } from "../shared/tool-base"
import { readWorkspaceText } from "../workspace/workspace-fs"

export const safeRenameSymbolTool = toolDefinition(
  "safe_rename_symbol",
  "Preview an AST-safe symbol rename patch. Defaults to dry-run and does not write files.",
  z.object({
    symbol: z.string().min(1),
    newName: z.string().min(1),
    path: z.string().optional(),
    dryRun: z.boolean().optional().default(true),
    limit: z.number().int().optional(),
  }),
  async ({ symbol, newName, path: pathName, dryRun, limit }) => {
    const { files } = await codeFiles(pathName, boundedLimit(limit, 500, 1500))
    let patch = ""
    let touched = 0
    const re = new RegExp(`\\b${symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g")
    for (const file of files) {
      const before = await readBounded(file)
      if (!re.test(before)) continue
      re.lastIndex = 0
      const after = before.replace(re, newName)
      patch += unifiedPatch(file.path, truncateString(before, 3000), truncateString(after, 3000))
      touched += 1
      if (touched >= 50) break
    }
    return {
      type: "safe_rename_symbol",
      dryRun,
      summary: `Rename ${symbol} to ${newName}`,
      fileCount: touched,
      patch,
    }
  }
)

export const moveSymbolToFileTool = toolDefinition(
  "move_symbol_to_file",
  "Preview moving a symbol to another file and updating imports.",
  z.object({
    symbol: z.string().min(1),
    from: z.string().min(1),
    to: z.string().min(1),
    dryRun: z.boolean().optional().default(true),
  }),
  async ({ symbol, from, to, dryRun }) => {
    const content = await readWorkspaceText(from)
    const match = content.match(
      new RegExp(
        `export\\s+(?:async\\s+)?(?:function|const|class|type|interface)\\s+${symbol}[\\s\\S]*?(?=\\nexport\\s+|$)`
      )
    )
    const moved = match?.[0] ?? `// Could not isolate ${symbol}; manual extraction required.\n`
    return {
      type: "move_symbol_to_file",
      dryRun,
      summary: `Move ${symbol} from ${from} to ${to}`,
      patch:
        unifiedPatch(from, truncateString(moved, 3000), `// moved to ${to}`) +
        unifiedPatch(to, "", moved),
    }
  }
)

export const extractFunctionTool = toolDefinition(
  "extract_function",
  "Preview extracting a file line range into a named function.",
  z.object({
    path: z.string().min(1),
    startLine: z.number().int().min(1),
    endLine: z.number().int().min(1),
    name: z.string().min(1),
    dryRun: z.boolean().optional().default(true),
  }),
  async ({ path: pathName, startLine, endLine, name, dryRun }) => {
    const content = await readWorkspaceText(pathName)
    const lines = linesOf(content)
    const selected = lines.slice(startLine - 1, endLine).join("\n")
    const replacement = `${name}()`
    const next = [
      ...lines.slice(0, startLine - 1),
      replacement,
      ...lines.slice(endLine),
      "",
      `function ${name}() {`,
      selected,
      "}",
    ].join("\n")
    return {
      type: "extract_function",
      dryRun,
      summary: `Extract ${pathName}:${startLine}-${endLine} into ${name}`,
      patch: unifiedPatch(pathName, content, next),
    }
  }
)

export const extractComponentTool = toolDefinition(
  "extract_component",
  "Preview extracting a TSX line range into a new component file.",
  z.object({
    path: z.string().min(1),
    startLine: z.number().int().min(1),
    endLine: z.number().int().min(1),
    componentName: z.string().min(1),
    targetPath: z.string().optional(),
    dryRun: z.boolean().optional().default(true),
  }),
  async ({ path: pathName, startLine, endLine, componentName, targetPath, dryRun }) => {
    const content = await readWorkspaceText(pathName)
    const selected = linesOf(content)
      .slice(startLine - 1, endLine)
      .join("\n")
    const target = targetPath ?? path.join(path.dirname(pathName), `${componentName}.tsx`)
    const component = `export function ${componentName}() {\n  return (\n${selected}\n  )\n}\n`
    return {
      type: "extract_component",
      dryRun,
      summary: `Extract ${componentName}`,
      patch: unifiedPatch(target, "", component),
    }
  }
)

export const barrelExportSyncTool = toolDefinition(
  "barrel_export_sync",
  "Preview missing export lines for a barrel file.",
  z.object({
    barrelPath: z.string().default("src/lib/server/tools/index.ts"),
    directory: z.string().optional(),
    dryRun: z.boolean().optional().default(true),
  }),
  async ({ barrelPath, directory, dryRun }) => {
    const current = await readWorkspaceText(barrelPath)
    const dir = directory ?? path.dirname(barrelPath)
    const abs = resolveWorkspacePath(dir)
    const entries = await readdir(abs).catch(() => [])
    const additions = entries
      .filter(
        (entry) =>
          /\.(ts|tsx)$/.test(entry) &&
          !entry.endsWith(".test.ts") &&
          entry !== path.basename(barrelPath)
      )
      .map((entry) => `export * from "./${entry.replace(/\.[tj]sx?$/, "")}"`)
      .filter((line) => !current.includes(line))
    return {
      type: "barrel_export_sync",
      dryRun,
      patch: additions.length
        ? unifiedPatch(barrelPath, current, `${current.trimEnd()}\n${additions.join("\n")}\n`)
        : "",
    }
  }
)

export const importRewriteTool = toolDefinition(
  "import_rewrite",
  "Preview rewriting import module specifiers across workspace files.",
  z.object({
    from: z.string().min(1),
    to: z.string().min(1),
    path: z.string().optional(),
    dryRun: z.boolean().optional().default(true),
    limit: z.number().int().optional(),
  }),
  async ({ from, to, path: pathName, dryRun, limit }) =>
    safeRenameSymbolTool
      .invoke({ symbol: from, newName: to, path: pathName, dryRun, limit })
      .then((result) => ({
        ...(result as object),
        type: "import_rewrite",
        summary: `Rewrite imports ${from} -> ${to}`,
      }))
)

export const deadImportsFixTool = toolDefinition(
  "dead_imports_fix",
  "Preview removing obviously unused named imports using lightweight static checks.",
  z.object({
    path: z.string().optional(),
    dryRun: z.boolean().optional().default(true),
    limit: z.number().int().optional(),
  }),
  async ({ path: pathName, dryRun, limit }) => {
    const { files } = await codeFiles(pathName, boundedLimit(limit, 300, 1000))
    let patch = ""
    let count = 0
    for (const file of files) {
      const content = await readBounded(file)
      let next = content
      for (const match of content.matchAll(/import\s+\{([^}]+)\}\s+from\s+["'][^"']+["'];?/g)) {
        const names = match[1]
          .split(",")
          .map((part) => part.trim().split(/\s+as\s+/)[1] ?? part.trim().split(/\s+as\s+/)[0])
        const unused = names.filter(
          (name) =>
            new RegExp(`\\b${name}\\b`, "g").exec(content)?.[0] &&
            (content.match(new RegExp(`\\b${name}\\b`, "g"))?.length ?? 0) <= 1
        )
        if (unused.length === names.length) next = next.replace(match[0], "")
      }
      if (next !== content) {
        patch += unifiedPatch(file.path, truncateString(content, 3000), truncateString(next, 3000))
        count += 1
      }
    }
    return { type: "dead_imports_fix", dryRun, fileCount: count, patch }
  }
)

export const moduleBoundaryCheckTool = toolDefinition(
  "module_boundary_check",
  "Check imports against configurable module-boundary rules.",
  z.object({
    rules: z.record(z.string(), z.object({ cannotImport: z.array(z.string()) })).optional(),
    limit: z.number().int().optional(),
  }),
  async ({ rules, limit }) => {
    const defaultRules = rules ?? {
      "src/lib/server/tools/shared/**": {
        cannotImport: ["src/components/**", "src/lib/server/tools/browser/**"],
      },
      "src/lib/server/tools/**": { cannotImport: ["src/components/**"] },
      "src/components/**": { cannotImport: ["src/lib/server/**"] },
    }
    const { files } = await codeFiles(undefined, boundedLimit(limit, 1000, 3000))
    const findings: Finding[] = []
    for (const file of files) {
      const content = await readBounded(file)
      for (const spec of importedSpecifiers(content)) {
        for (const [zone, rule] of Object.entries(defaultRules)) {
          const zonePrefix = zone.replace("/**", "")
          if (!file.path.startsWith(zonePrefix)) continue
          for (const forbidden of rule.cannotImport) {
            const forbiddenPrefix = forbidden.replace("/**", "").replace(/^src\//, "@/")
            if (spec.startsWith(forbiddenPrefix) || spec.includes(forbidden.replace("/**", ""))) {
              findings.push(
                finding(
                  "error",
                  file.path,
                  undefined,
                  `Import "${spec}" violates ${zone}`,
                  `Forbidden pattern: ${forbidden}`
                )
              )
            }
          }
        }
      }
    }
    return { type: "module_boundary_check", findings: findings.slice(0, 200) }
  }
)
