import { access } from "fs/promises"

import { ToolCall } from "@/types/chat"

import { resolveWorkspacePath } from "../workspace"

type VerificationResult = {
  ok: boolean
  notes: string[]
}

async function fileExists(relativePath: string) {
  try {
    await access(resolveWorkspacePath(relativePath))
    return true
  } catch {
    return false
  }
}

export async function verifyToolCalls(toolCalls: ToolCall[]): Promise<VerificationResult> {
  const notes: string[] = []

  for (const call of toolCalls) {
    if (call.status === "error") {
      notes.push(`${call.name} reported an error`)
      continue
    }

    const result = (call.result ?? {}) as Record<string, unknown>

    if (["write_file", "file_replace", "json_patch", "yaml_patch"].includes(call.name)) {
      const filePath =
        typeof result.path === "string"
          ? result.path
          : typeof call.arguments.path === "string"
            ? call.arguments.path
            : ""
      if (!filePath || !(await fileExists(filePath))) {
        notes.push(`${call.name} could not verify output file ${filePath || "(missing path)"}`)
      }
    }

    if (
      ["generate_latex_pdf", "markdown_to_pdf", "archive_create", "image_convert"].includes(
        call.name
      )
    ) {
      const hasArtifact = Boolean(
        result.artifactUrl || result.cloudinaryUrl || result.screenshot || result.dataUrl
      )
      if (!hasArtifact) {
        notes.push(`${call.name} did not return a verifiable artifact`)
      }
    }

    if (call.name.startsWith("browser_")) {
      const screenshot = result.screenshot
      if (typeof screenshot !== "string" || screenshot.length === 0) {
        notes.push(`${call.name} did not return a browser snapshot`)
      }
    }
  }

  return {
    ok: notes.length === 0,
    notes,
  }
}
