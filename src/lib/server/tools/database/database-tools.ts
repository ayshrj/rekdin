import { stat } from "fs/promises"
import { z } from "zod"

import { resolveWorkspacePath } from "../../workspace"
import { codeFiles, readBounded } from "../shared/code-utils"
import { boundedLimit } from "../shared/formatting"
import { emptySchema, pathLimitSchema, toolDefinition } from "../shared/tool-base"
import { collectWorkspaceFiles, readWorkspaceText } from "../workspace/workspace-fs"

export const prismaSchemaInspectTool = toolDefinition(
  "prisma_schema_inspect",
  "Inspect Prisma schema models, fields, relations, and indexes.",
  z.object({ path: z.string().optional() }),
  async ({ path: pathName }) => {
    const candidates = pathName ? [pathName] : ["prisma/schema.prisma", "schema.prisma"]
    let resolvedPath = candidates[0]
    for (const candidate of candidates) {
      const exists = await stat(resolveWorkspacePath(candidate))
        .then(() => true)
        .catch(() => false)
      if (exists) {
        resolvedPath = candidate
        break
      }
    }
    const content = await readWorkspaceText(resolvedPath).catch(() => "")
    const models = Array.from(content.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\}/g)).map((match) => ({
      name: match[1],
      fields: match[2]
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [name, type, ...decorators] = line.split(/\s+/)
          return { name, type, decorators: decorators.join(" ") }
        }),
    }))
    return { type: "prisma_schema_inspect", path: resolvedPath, models, modelCount: models.length }
  }
)

export const drizzleSchemaInspectTool = toolDefinition(
  "drizzle_schema_inspect",
  "Inspect Drizzle schema declarations and table definitions.",
  pathLimitSchema,
  async ({ path: pathName, limit }) => {
    const { files } = await codeFiles(pathName, boundedLimit(limit, 500, 1500))
    const tables = []
    for (const file of files) {
      const content = await readBounded(file)
      for (const match of content.matchAll(
        /(?:pgTable|mysqlTable|sqliteTable)\(\s*["'`](\w+)["'`]/g
      )) {
        tables.push({ name: match[1], file: file.path })
      }
    }
    return { type: "drizzle_schema_inspect", models: tables }
  }
)

export const sqlSchemaMapTool = toolDefinition(
  "sql_schema_map",
  "Read SQL migrations and produce a schema summary.",
  pathLimitSchema,
  async ({ path: pathName, limit }) => {
    const { files } = await collectWorkspaceFiles({
      path: pathName,
      extensions: [".sql"],
      maxFiles: boundedLimit(limit, 500, 2000),
    })
    const tables = []
    for (const file of files) {
      const content = await readBounded(file)
      for (const match of content.matchAll(
        /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([\w.]+)["`]?/gi
      ))
        tables.push({ name: match[1], file: file.path })
    }
    return { type: "sql_schema_map", models: tables }
  }
)

export const migrationDiffSummaryTool = toolDefinition(
  "migration_diff_summary",
  "Compare database migrations and summarize schema evolution.",
  pathLimitSchema,
  async ({ path: pathName }) => {
    const map = (await sqlSchemaMapTool.invoke({ path: pathName })) as {
      models?: Array<Record<string, unknown>>
    }
    return {
      type: "migration_diff_summary",
      text: `Detected ${(map.models ?? []).length} table creation events across SQL migrations.`,
      models: map.models ?? [],
    }
  }
)

export const erdGenerateTool = toolDefinition(
  "erd_generate",
  "Generate Mermaid ER diagram from Prisma/SQL/Drizzle schema summary.",
  emptySchema,
  async () => {
    const prisma = (await prismaSchemaInspectTool.invoke({})) as {
      models?: Array<Record<string, unknown>>
    }
    const lines = ["erDiagram", ...(prisma.models ?? []).map((model) => `  ${model.name} {}`)]
    return { type: "erd_generate", mermaid: lines.join("\n") }
  }
)
