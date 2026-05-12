import { tool } from "@langchain/core/tools"
import { readdir, readFile, stat, unlink } from "fs/promises"
import path from "path"
import { z } from "zod"

import { ensureWorkspaceDirs, getArtifactsDir } from "../../workspace"
import { truncateString } from "../shared/formatting"

function parseArtifactName(value: string) {
  const cleaned = value.startsWith("/api/artifacts/") ? value.split("/api/artifacts/")[1] : value
  return path.basename(decodeURIComponent(cleaned))
}

export const artifactListTool = tool(
  async () => {
    await ensureWorkspaceDirs()
    const dir = getArtifactsDir()
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
    const artifacts = await Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .slice(0, 500)
        .map(async (entry) => {
          const info = await stat(path.join(dir, entry.name))
          return {
            name: entry.name,
            url: `/api/artifacts/${entry.name}`,
            size: info.size,
            modified: info.mtime.toISOString(),
          }
        })
    )
    return { type: "artifact_list", artifacts }
  },
  { name: "artifact_list", description: "List stored Rekdin artifacts.", schema: z.object({}) }
)

export const artifactReadTool = tool(
  async ({ artifact }) => {
    const name = parseArtifactName(artifact)
    const artifactsDir = getArtifactsDir()
    const fullPath = path.join(artifactsDir, name)
    const relative = path.relative(path.resolve(artifactsDir), path.resolve(fullPath))
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("Artifact path escapes artifact directory")
    }
    const info = await stat(fullPath)
    const bytes = await readFile(fullPath)
    const textLike = /\.(txt|md|json|csv|html|xml|svg)$/i.test(name)
    return {
      type: "artifact_read",
      artifact,
      name,
      size: info.size,
      content: textLike ? truncateString(bytes.toString("utf-8"), 12000) : undefined,
      base64: textLike ? undefined : bytes.toString("base64").slice(0, 12000),
      truncated: !textLike && bytes.length > 9000,
    }
  },
  {
    name: "artifact_read",
    description: "Read a stored artifact by URL or filename.",
    schema: z.object({ artifact: z.string().min(1) }),
  }
)

export const artifactDeleteTool = tool(
  async ({ artifact }) => {
    const name = parseArtifactName(artifact)
    const artifactsDir = getArtifactsDir()
    const fullPath = path.join(artifactsDir, name)
    const relative = path.relative(path.resolve(artifactsDir), path.resolve(fullPath))
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("Artifact path escapes artifact directory")
    }
    await unlink(fullPath)
    return { type: "artifact_delete", artifact, deleted: true }
  },
  {
    name: "artifact_delete",
    description: "Delete a stored Rekdin artifact.",
    schema: z.object({ artifact: z.string().min(1) }),
  }
)
