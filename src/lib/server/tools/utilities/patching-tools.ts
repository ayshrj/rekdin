import { tool } from "@langchain/core/tools"
import { z } from "zod"

import { loadYamlModule } from "../shared/loaders"
import { applyJsonPatch } from "../shared/patching"
import { readWorkspaceText, writeWorkspaceText } from "../workspace/workspace-fs"

/**
 * Performs find-and-replace edits in a workspace text file.
 */
export const fileReplaceTool = tool(
  async ({ path: filePath, find, replace, regex, ignoreCase, maxReplacements }) => {
    const content = await readWorkspaceText(filePath)
    const flags = `${regex ? "g" : "g"}${ignoreCase ? "i" : ""}`
    let matcher: RegExp
    try {
      matcher = regex
        ? new RegExp(find, flags)
        : new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags)
    } catch (err) {
      return {
        type: "file_replace",
        path: filePath,
        replaced: 0,
        error: err instanceof Error ? err.message : "Invalid regex",
      }
    }
    let count = 0
    const limit = maxReplacements ?? Infinity
    const updated = content.replace(matcher, (match) => {
      if (count >= limit) return match
      count++
      return replace
    })
    await writeWorkspaceText(filePath, updated)
    return { type: "file_replace", path: filePath, replaced: count }
  },
  {
    name: "file_replace",
    description: "Find-and-replace text in a workspace file.",
    schema: z.object({
      path: z.string(),
      find: z.string().min(1),
      replace: z.string(),
      regex: z.boolean().optional(),
      ignoreCase: z.boolean().optional(),
      maxReplacements: z.number().int().min(1).optional(),
    }),
  }
)

/**
 * Applies add, remove, and replace JSON Patch operations to a workspace JSON file.
 */
export const jsonPatchTool = tool(
  async ({ path: filePath, operations }) => {
    const raw = await readWorkspaceText(filePath)
    const data = JSON.parse(raw)
    const patched = applyJsonPatch(data, operations)
    await writeWorkspaceText(filePath, JSON.stringify(patched, null, 2))
    return {
      type: "json_patch",
      path: filePath,
      operations,
      changed: true,
    }
  },
  {
    name: "json_patch",
    description: "Apply RFC-6902 style JSON Patch operations to a JSON file.",
    schema: z.object({
      path: z.string(),
      operations: z.array(
        z.object({
          op: z.enum(["add", "remove", "replace"]),
          path: z.string().min(1),
          value: z.any().optional(),
        })
      ),
    }),
  }
)

/**
 * Applies add, remove, and replace patch operations to a workspace YAML file.
 */
export const yamlPatchTool = tool(
  async ({ path: filePath, operations }) => {
    const yamlMod = await loadYamlModule()
    if (!yamlMod) {
      return {
        type: "yaml_patch",
        path: filePath,
        changed: false,
        error: "YAML support requires the `yaml` package. Install with `npm install yaml`.",
      }
    }
    const raw = await readWorkspaceText(filePath)
    const parsed = yamlMod.parse(raw)
    const patched = applyJsonPatch(parsed, operations)
    const output = yamlMod.stringify(patched)
    await writeWorkspaceText(filePath, output)
    return { type: "yaml_patch", path: filePath, operations, changed: true }
  },
  {
    name: "yaml_patch",
    description: "Apply JSON Patch operations to a YAML file (requires `yaml` package).",
    schema: z.object({
      path: z.string(),
      operations: z.array(
        z.object({
          op: z.enum(["add", "remove", "replace"]),
          path: z.string().min(1),
          value: z.any().optional(),
        })
      ),
    }),
  }
)
