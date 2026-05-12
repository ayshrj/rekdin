import { tool } from "@langchain/core/tools"
import path from "path"
import { z } from "zod"

import { getWorkspaceRoot, resolveWorkspacePath } from "../../workspace"
import { runCommandUnsafe, safeShellArg } from "../shared/command"
import { parseSimpleCsv } from "../shared/csv"
import { truncateString } from "../shared/formatting"
import { getJsonPath } from "../shared/json"
import { loadYamlModule } from "../shared/loaders"
import { readWorkspaceText } from "../workspace/workspace-fs"

function isReadOnlySql(query: string) {
  return /^\s*(select|with|pragma)\b/i.test(query) && !/;\s*\S/.test(query.trim())
}

export const csvPreviewTool = tool(
  async ({ path: filePath, delimiter, maxRows }) => {
    const content = await readWorkspaceText(filePath)
    const rows = parseSimpleCsv(content, delimiter ?? ",", Math.min(maxRows ?? 25, 200))
    return {
      type: "csv_preview",
      path: filePath,
      rowCountPreviewed: rows.length,
      headers: rows[0] ?? [],
      rows: rows.slice(1),
    }
  },
  {
    name: "csv_preview",
    description: "Preview rows from a CSV workspace file.",
    schema: z.object({
      path: z.string().min(1),
      delimiter: z.string().length(1).optional(),
      maxRows: z.number().int().min(1).max(200).optional(),
    }),
  }
)

export const csvQueryTool = tool(
  async ({ path: filePath, delimiter, whereColumn, whereEquals, columns, maxRows }) => {
    const content = await readWorkspaceText(filePath)
    const rows = parseSimpleCsv(content, delimiter ?? ",", 5000)
    const headers = rows[0] ?? []
    const selectedColumns = columns?.length ? columns : headers
    const whereIndex = whereColumn ? headers.indexOf(whereColumn) : -1
    const selectedIndexes = selectedColumns
      .map((column) => headers.indexOf(column))
      .filter((index) => index >= 0)
    const resultRows = rows
      .slice(1)
      .filter((row) => whereIndex < 0 || row[whereIndex] === whereEquals)
      .slice(0, Math.min(maxRows ?? 50, 500))
      .map((row) =>
        Object.fromEntries(selectedIndexes.map((index) => [headers[index], row[index] ?? ""]))
      )
    return {
      type: "csv_query",
      path: filePath,
      headers,
      rows: resultRows,
      truncated: resultRows.length >= (maxRows ?? 50),
    }
  },
  {
    name: "csv_query",
    description: "Filter and project rows from a CSV workspace file.",
    schema: z.object({
      path: z.string().min(1),
      delimiter: z.string().length(1).optional(),
      whereColumn: z.string().optional(),
      whereEquals: z.string().optional(),
      columns: z.array(z.string()).optional(),
      maxRows: z.number().int().min(1).max(500).optional(),
    }),
  }
)

export const jsonQueryTool = tool(
  async ({ path: filePath, query }) => {
    const parsed = JSON.parse(await readWorkspaceText(filePath))
    return {
      type: "json_query",
      path: filePath,
      query: query ?? "$",
      value: getJsonPath(parsed, query ?? "$"),
    }
  },
  {
    name: "json_query",
    description: "Read a JSON file and return a simple path query result.",
    schema: z.object({ path: z.string().min(1), query: z.string().optional() }),
  }
)

export const yamlQueryTool = tool(
  async ({ path: filePath, query }) => {
    const yaml = await loadYamlModule()
    if (!yaml) throw new Error("YAML module unavailable")
    const parsed = yaml.parse(await readWorkspaceText(filePath))
    return {
      type: "yaml_query",
      path: filePath,
      query: query ?? "$",
      value: getJsonPath(parsed, query ?? "$"),
    }
  },
  {
    name: "yaml_query",
    description: "Read a YAML file and return a simple path query result.",
    schema: z.object({ path: z.string().min(1), query: z.string().optional() }),
  }
)

export const sqliteQueryTool = tool(
  async ({ path: filePath, query }) => {
    if (!isReadOnlySql(query))
      throw new Error("Only a single read-only SELECT/WITH/PRAGMA query is allowed")
    const safePath = path.relative(getWorkspaceRoot(), resolveWorkspacePath(filePath))
    const res = await runCommandUnsafe(
      `sqlite3 -json ${safeShellArg(safePath)} ${safeShellArg(query)}`,
      getWorkspaceRoot(),
      15000
    )
    let rows: unknown = res.stdout
    try {
      rows = JSON.parse(res.stdout || "[]")
    } catch {
      // keep raw stdout
    }
    return {
      type: "sqlite_query",
      path: filePath,
      query,
      rows,
      exitCode: res.exitCode,
      stderr: truncateString(res.stderr, 2000),
    }
  },
  {
    name: "sqlite_query",
    description: "Run one read-only sqlite3 query against a workspace database file.",
    schema: z.object({ path: z.string().min(1), query: z.string().min(1) }),
  }
)
