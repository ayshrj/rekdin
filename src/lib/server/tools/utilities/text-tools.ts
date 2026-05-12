import { tool } from "@langchain/core/tools"
import { readdir, readFile, stat } from "fs/promises"
import path from "path"
import { z } from "zod"

import {
  assertWorkspacePathAllowed,
  isBlockedWorkspaceDirectoryName,
  resolveWorkspacePath,
} from "../../workspace"
import { readWorkspaceText } from "../workspace/workspace-fs"

const TODO_SCAN_EXTENSIONS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "c",
  "cpp",
  "h",
  "cs",
  "swift",
  "kt",
  "php",
  "sh",
  "css",
  "scss",
  "html",
  "vue",
  "svelte",
  "yaml",
  "yml",
  "toml",
  "sql",
  "md",
  "txt",
  "json",
  "graphql",
  "gql",
])
const TODO_KEYWORD_RE = /\b(TODO|FIXME|HACK|XXX|BUG|NOTE)\b/i

/**
 * Finds TODO-style markers in one text buffer.
 */
function scanTextForTodos(content: string, relFile?: string) {
  return content.split(/\r?\n/).flatMap((line, i) => {
    const match = line.match(TODO_KEYWORD_RE)
    if (!match) return []
    return [{ file: relFile, line: i + 1, text: line.trim(), type: match[1].toUpperCase() }]
  })
}

/**
 * Recursively scans supported workspace files for TODO-style markers.
 */
async function walkDirForTodos(
  dirPath: string,
  baseDir: string
): Promise<{ file?: string; line?: number; text: string; type: string }[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const results: { file?: string; line?: number; text: string; type: string }[] = []
  for (const entry of entries) {
    if (entry.name.startsWith(".") || isBlockedWorkspaceDirectoryName(entry.name)) continue
    const fullPath = path.join(dirPath, entry.name)
    assertWorkspacePathAllowed(fullPath)
    if (entry.isDirectory()) {
      results.push(...(await walkDirForTodos(fullPath, baseDir)))
    } else {
      const ext = entry.name.split(".").pop()?.toLowerCase() ?? ""
      if (!TODO_SCAN_EXTENSIONS.has(ext)) continue
      const content = await readFile(fullPath, "utf-8").catch(() => "")
      results.push(...scanTextForTodos(content, path.relative(baseDir, fullPath)))
    }
  }
  return results
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items))
}

export const textSummarizeTool = tool(
  async ({ text, path: filePath }) => {
    if (!text && filePath) {
      text = await readWorkspaceText(filePath)
    }
    const words = (text || "").split(/\s+/).filter(Boolean)
    const summary = words.slice(0, 120).join(" ") + (words.length > 120 ? " ..." : "")
    return { type: "text_summarize", length: words.length, summary }
  },
  {
    name: "text_summarize",
    description: "Lightweight extractive summarization (first ~120 words).",
    schema: z.object({ text: z.string().optional(), path: z.string().optional() }),
  }
)

/**
 * Rewrites text into a simple bullet-list format.
 */
export const textRewriteTool = tool(
  async ({ text, path: filePath, style }) => {
    if (!text && filePath) {
      text = await readWorkspaceText(filePath)
    }
    const paragraphs = (text || "")
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
    const rewritten = paragraphs.map((p) => `- ${p}`).join("\n")
    return { type: "text_rewrite", style: style ?? "bulletize", output: rewritten }
  },
  {
    name: "text_rewrite",
    description: "Simple rewrite to bullets (deterministic).",
    schema: z.object({
      text: z.string().optional(),
      path: z.string().optional(),
      style: z.string().optional(),
    }),
  }
)

export const textEntitiesTool = tool(
  async ({ text }) => {
    const urls = unique(text.match(/https?:\/\/[^\s)]+/g) ?? [])
    const emails = unique(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [])
    const capitalizedPhrases = unique(
      text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4}\b/g) ?? []
    ).slice(0, 100)
    return { type: "text_entities", urls, emails, capitalizedPhrases }
  },
  {
    name: "text_entities",
    description: "Extract simple URLs, emails, and capitalized phrase entities from text.",
    schema: z.object({ text: z.string() }),
  }
)

/**
 * Extracts TODO, FIXME, HACK, XXX, BUG, and NOTE markers from text, files, or folders.
 */
export const extractTodosTool = tool(
  async ({ text, path: inputPath }) => {
    let todos: { file?: string; line?: number; text: string; type: string }[] = []
    if (text) {
      todos = scanTextForTodos(text)
    } else if (inputPath) {
      const resolved = resolveWorkspacePath(inputPath)
      const s = await stat(resolved)
      if (s.isDirectory()) {
        todos = await walkDirForTodos(resolved, resolved)
      } else {
        const content = await readFile(resolved, "utf-8")
        todos = scanTextForTodos(content, inputPath)
      }
    }
    return { type: "extract_todos", count: todos.length, todos }
  },
  {
    name: "extract_todos",
    description:
      "Extract TODO/FIXME/HACK-style comments from a workspace file or directory (scanned recursively).",
    schema: z.object({ text: z.string().optional(), path: z.string().optional() }),
  }
)
