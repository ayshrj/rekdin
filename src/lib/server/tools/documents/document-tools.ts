import { tool } from "@langchain/core/tools"
import { unzipSync } from "fflate"
import { readFile } from "fs/promises"
import { JSDOM } from "jsdom"
import keywordExtractor from "keyword-extractor"
import { z } from "zod"

import { estimateTokens } from "../../token-budget"
import { resolveWorkspacePath } from "../../workspace"
import { truncateString } from "../shared/formatting"
import { readWorkspaceText } from "../workspace/workspace-fs"

function parseFrontmatter(markdown: string) {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/)
  if (!match) return { frontmatter: null, body: markdown }
  const body = markdown.slice(match[0].length)
  const raw = match[1]
  const frontmatter: Record<string, string | string[]> = {}
  for (const line of raw.split(/\r?\n/)) {
    const separator = line.indexOf(":")
    if (separator <= 0) continue
    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    if (value.startsWith("[") && value.endsWith("]")) {
      frontmatter[key] = value
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean)
    } else {
      frontmatter[key] = value.replace(/^["']|["']$/g, "")
    }
  }
  return { frontmatter, body }
}

export const docxExtractTextTool = tool(
  async ({ path: filePath, maxChars }) => {
    const bytes = await readFile(resolveWorkspacePath(filePath))
    const files = unzipSync(bytes)
    const documentXml = files["word/document.xml"]
    if (!documentXml) throw new Error("DOCX missing word/document.xml")
    const xml = Buffer.from(documentXml).toString("utf-8")
    const dom = new JSDOM(xml, { contentType: "text/xml" })
    const text = Array.from(dom.window.document.querySelectorAll("w\\:t, t"))
      .map((node) => node.textContent ?? "")
      .join("")
    return {
      type: "docx_extract_text",
      path: filePath,
      text: truncateString(text, maxChars ?? 12000),
      chars: text.length,
    }
  },
  {
    name: "docx_extract_text",
    description: "Extract plain text from a DOCX workspace file.",
    schema: z.object({
      path: z.string().min(1),
      maxChars: z.number().int().min(100).max(50000).optional(),
    }),
  }
)

export const htmlTableExtractTool = tool(
  async ({ html, url }) => {
    const content = html ?? (await fetch(url!).then((res) => res.text()))
    const dom = new JSDOM(content, url ? { url } : undefined)
    const tables = Array.from(dom.window.document.querySelectorAll("table"))
      .slice(0, 20)
      .map((table, index) => ({
        index,
        rows: Array.from(table.querySelectorAll("tr"))
          .slice(0, 200)
          .map((row) =>
            Array.from(row.querySelectorAll("th,td")).map((cell) => cell.textContent?.trim() ?? "")
          ),
      }))
    return { type: "html_table_extract", url, tables }
  },
  {
    name: "html_table_extract",
    description: "Extract tables from raw HTML or a URL.",
    schema: z
      .object({ html: z.string().optional(), url: z.string().url().optional() })
      .refine((value) => value.html || value.url, { message: "Provide html or url" }),
  }
)

export const markdownFrontmatterTool = tool(
  async ({ path: filePath, markdown }) => {
    const content = markdown ?? (await readWorkspaceText(filePath!))
    const parsed = parseFrontmatter(content)
    return {
      type: "markdown_frontmatter",
      path: filePath,
      frontmatter: parsed.frontmatter,
      bodyPreview: truncateString(parsed.body, 4000),
    }
  },
  {
    name: "markdown_frontmatter",
    description: "Parse YAML-like frontmatter from Markdown.",
    schema: z
      .object({ path: z.string().optional(), markdown: z.string().optional() })
      .refine((value) => value.path || value.markdown, { message: "Provide path or markdown" }),
  }
)

export const tokenCountTool = tool(
  async ({ text }) => ({ type: "token_count", tokens: estimateTokens(text), chars: text.length }),
  {
    name: "token_count",
    description: "Estimate tokenizer token count for text.",
    schema: z.object({ text: z.string() }),
  }
)

export const textKeywordsTool = tool(
  async ({ text, maxKeywords }) => ({
    type: "text_keywords",
    keywords: keywordExtractor
      .extract(text, { language: "english", remove_duplicates: true })
      .slice(0, maxKeywords ?? 50),
  }),
  {
    name: "text_keywords",
    description: "Extract keywords from text without using an LLM.",
    schema: z.object({
      text: z.string(),
      maxKeywords: z.number().int().min(1).max(200).optional(),
    }),
  }
)
