import { tool } from "@langchain/core/tools"
import { unzipSync, zipSync } from "fflate"
import { mkdir, readdir, readFile, stat, writeFile } from "fs/promises"
import path from "path"
import { z } from "zod"

import { storeArtifact } from "../../artifact-store"
import {
  assertWorkspacePathAllowed,
  isBlockedWorkspaceDirectoryName,
  resolveWorkspacePath,
} from "../../workspace"
import { decodeDataInput, sanitizePdfBaseName } from "../pdf/pdf-core"

/**
 * Creates a zip artifact from workspace files or directories.
 */
export const archiveCreateTool = tool(
  async ({ paths, archiveName }) => {
    if (!Array.isArray(paths) || paths.length === 0) {
      return { type: "archive_create", error: "No paths provided", success: false }
    }
    const files: Record<string, Uint8Array> = {}
    let totalBytes = 0

    const addFile = async (zipPath: string, absPath: string) => {
      const buf = await readFile(absPath)
      totalBytes += buf.length
      if (totalBytes > 10 * 1024 * 1024) {
        throw new Error("Archive too large (max 10MB)")
      }
      files[zipPath] = new Uint8Array(buf)
    }

    const addTree = async (absPath: string, zipPrefix: string) => {
      assertWorkspacePathAllowed(absPath)
      const info = await stat(absPath)
      if (info.isDirectory()) {
        const entries = await readdir(absPath, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.isDirectory() && isBlockedWorkspaceDirectoryName(entry.name)) continue
          const childAbs = path.join(absPath, entry.name)
          const childZip = zipPrefix ? `${zipPrefix}/${entry.name}` : entry.name
          if (entry.isDirectory()) {
            await addTree(childAbs, childZip)
          } else if (entry.isFile()) {
            await addFile(childZip, childAbs)
          }
        }
        return
      }
      if (info.isFile()) {
        const name = zipPrefix || path.basename(absPath)
        await addFile(name, absPath)
      }
    }

    for (const p of paths) {
      const safeRel = p.replace(/^(\.\.(\/|\\|$))+/, "").replace(/^[\\/]/, "")
      const abs = resolveWorkspacePath(safeRel)
      await addTree(abs, safeRel.replace(/\\/g, "/"))
    }

    if (Object.keys(files).length === 0) {
      return { type: "archive_create", success: false, error: "No files found to archive" }
    }

    const buf = Buffer.from(zipSync(files, { level: 6 }))
    const zipName = sanitizePdfBaseName(archiveName || "archive")
    const artifact = await storeArtifact({
      filename: `${zipName}.zip`,
      bytes: buf,
      mimeType: "application/zip",
    })
    return {
      type: "archive_create",
      success: true,
      archiveName: `${zipName}.zip`,
      size: buf.length,
      artifact,
      artifactUrl: artifact.url,
    }
  },
  {
    name: "archive_create",
    description: "Create a zip archive from workspace files/folders (returned as data URL).",
    schema: z.object({
      paths: z.array(z.string().min(1)).min(1),
      archiveName: z.string().optional(),
    }),
  }
)

/**
 * Extracts a zip archive into the workspace with path and size limits.
 */
export const archiveExtractTool = tool(
  async ({ data, outputDir }) => {
    try {
      const buf = decodeDataInput(data)
      if (buf.length > 10 * 1024 * 1024) {
        return { type: "archive_extract", success: false, error: "Archive too large (max 10MB)" }
      }
      const extracted = unzipSync(buf)
      const written: string[] = []
      let total = 0
      const targetRoot = outputDir ?? "."
      for (const [name, content] of Object.entries(extracted)) {
        const safeName = name.replace(/^(\.\.(\/|\\|$))+/, "").replace(/^[\\/]/, "")
        if (!safeName) continue
        total += content.length
        if (total > 10 * 1024 * 1024) {
          return { type: "archive_extract", success: false, error: "Extracted data exceeds 10MB" }
        }
        const relPath = path.join(targetRoot, safeName)
        const absPath = resolveWorkspacePath(relPath)
        await mkdir(path.dirname(absPath), { recursive: true })
        await writeFile(absPath, Buffer.from(content))
        written.push(relPath.replace(/\\/g, "/"))
      }
      return { type: "archive_extract", success: true, outputDir: targetRoot, entries: written }
    } catch (err) {
      return {
        type: "archive_extract",
        success: false,
        error: err instanceof Error ? err.message : "Failed to extract archive",
      }
    }
  },
  {
    name: "archive_extract",
    description: "Extract a zip archive (data/base64) into the workspace.",
    schema: z.object({
      data: z.string().min(1),
      outputDir: z.string().optional(),
    }),
  }
)
