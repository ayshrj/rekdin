import { z } from "zod"

import { linesOf } from "../shared/code-utils"
import { csvRowsToObjects, parseSimpleCsv } from "../shared/csv"
import { boundedLimit, previewString } from "../shared/formatting"
import { inferJsonSchema, safeJsonParse } from "../shared/json"
import { toolDefinition } from "../shared/tool-base"
import { readWorkspaceText } from "../workspace/workspace-fs"

export const logParseTool = toolDefinition(
  "log_parse",
  "Parse logs and group by error type.",
  z.object({ log: z.string().min(1) }),
  async ({ log }) => {
    const errors = linesOf(log).filter((line) => /error|warn|fail|exception/i.test(line))
    return {
      type: "log_parse",
      clusters: errors
        .slice(0, 100)
        .map((line) => ({ pattern: previewString(line, 160), count: 1, sample: line })),
    }
  }
)

export const logErrorClusterTool = toolDefinition(
  "log_error_cluster",
  "Cluster similar errors in logs.",
  z.object({ log: z.string().min(1) }),
  async ({ log }) => {
    const buckets = new Map<string, string[]>()
    for (const line of linesOf(log).filter((item) => /error|warn|fail|exception/i.test(item))) {
      const key = line.replace(/\d+/g, "#").slice(0, 100)
      buckets.set(key, [...(buckets.get(key) ?? []), line])
    }
    return {
      type: "log_error_cluster",
      clusters: [...buckets.entries()]
        .map(([pattern, values]) => ({ pattern, count: values.length, sample: values[0] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 100),
    }
  }
)

export const csvProfileTool = toolDefinition(
  "csv_profile",
  "Profile CSV columns with type inference, nulls, unique counts, min/max, and samples.",
  z.object({ path: z.string().min(1), limit: z.number().int().optional() }),
  async ({ path: pathName, limit }) => {
    const parsed = csvRowsToObjects(parseSimpleCsv(await readWorkspaceText(pathName), ",", 10_000))
    const rows = parsed.rows.slice(0, boundedLimit(limit, 1000, 10000))
    const columns = parsed.headers.map((header) => {
      const values = rows.map((row) => String(row[header] ?? ""))
      const nonEmpty = values.filter(Boolean)
      const numbers = nonEmpty.map(Number).filter((value) => Number.isFinite(value))
      return {
        name: header,
        type: numbers.length === nonEmpty.length && nonEmpty.length ? "number" : "string",
        nulls: values.length - nonEmpty.length,
        unique: new Set(values).size,
        min: numbers.length ? Math.min(...numbers) : nonEmpty.sort()[0],
        max: numbers.length ? Math.max(...numbers) : nonEmpty.sort().at(-1),
        sample: [...new Set(nonEmpty)].slice(0, 5),
      }
    })
    return { type: "csv_profile", rows: parsed.rows.length, columns }
  }
)

export const jsonProfileTool = toolDefinition(
  "json_profile",
  "Summarize JSON structure deeply.",
  z.object({ path: z.string().optional(), json: z.unknown().optional() }),
  async ({ path: pathName, json }) => {
    const value = pathName ? safeJsonParse(await readWorkspaceText(pathName)) : json
    return {
      type: "json_profile",
      schema: inferJsonSchema(value),
      topLevelKeys:
        value && typeof value === "object" && !Array.isArray(value)
          ? Object.keys(value as Record<string, unknown>)
          : [],
    }
  }
)
