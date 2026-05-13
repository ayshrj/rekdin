import { readFile, stat } from "fs/promises"
import path from "path"
import { z } from "zod"

import { storeArtifact } from "../../artifact-store"
import { resolveWorkspacePath } from "../../workspace"
import { csvRowsToObjects, parseSimpleCsv } from "../shared/csv"
import { truncateString } from "../shared/formatting"
import { safeJsonParse } from "../shared/json"
import { toolDefinition } from "../shared/tool-base"
import { readWorkspaceText } from "../workspace/workspace-fs"

export const artifactPreviewTool = toolDefinition(
  "artifact_preview",
  "Return preview metadata for an artifact or workspace file.",
  z.object({ path: z.string().optional(), artifact: z.string().optional() }),
  async ({ path: pathName, artifact }) => {
    const target = pathName ?? artifact
    if (!target) throw new Error("Provide path or artifact")
    const resolved = resolveWorkspacePath(target)
    const info = await stat(resolved)
    const ext = path.extname(target).toLowerCase()
    let preview: unknown
    if ([".json", ".csv", ".md", ".txt", ".xml", ".html"].includes(ext) && info.size < 1_000_000) {
      const text = await readFile(resolved, "utf-8")
      preview =
        ext === ".json"
          ? Object.keys((safeJsonParse(text) as Record<string, unknown>) ?? {})
          : truncateString(text, 2000)
    }
    return { type: "artifact_preview", path: target, size: info.size, extension: ext, preview }
  }
)

export const artifactConvertTool = toolDefinition(
  "artifact_convert",
  "Convert simple text artifacts between JSON/CSV formats.",
  z.object({
    path: z.string().min(1),
    format: z.enum(["json", "csv", "txt"]),
    dryRun: z.boolean().optional().default(true),
  }),
  async ({ path: pathName, format, dryRun }) => {
    const content = await readWorkspaceText(pathName)
    let output = content
    if (pathName.endsWith(".csv") && format === "json")
      output = JSON.stringify(csvRowsToObjects(parseSimpleCsv(content, ",", 10_000)).rows, null, 2)
    if (pathName.endsWith(".json") && format === "csv") {
      const parsed = safeJsonParse(content)
      const rows = Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : []
      const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))]
      output = [
        headers.join(","),
        ...rows.map((row) => headers.map((header) => JSON.stringify(row[header] ?? "")).join(",")),
      ].join("\n")
    }
    const filename = `${path.basename(pathName, path.extname(pathName))}.${format}`
    const stored = dryRun ? null : await storeArtifact({ filename, bytes: Buffer.from(output) })
    return {
      type: "artifact_convert",
      dryRun,
      filename,
      content: truncateString(output, 5000),
      artifact: stored,
    }
  }
)

export const artifactBundleTool = toolDefinition(
  "artifact_bundle",
  "Return a bundle manifest for selected artifacts. Zip creation is dry-run in v1.",
  z.object({ artifacts: z.array(z.string()).min(1), dryRun: z.boolean().optional().default(true) }),
  async ({ artifacts, dryRun }) => ({
    type: "artifact_bundle",
    dryRun,
    artifacts,
    message:
      "Bundle manifest generated; zip writing is intentionally not performed by this v1 tool.",
  })
)
