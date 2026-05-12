import { tool } from "@langchain/core/tools"
import { readFile } from "fs/promises"
import { z } from "zod"

import { resolveWorkspacePath } from "../../workspace"
import { truncateString } from "../shared/formatting"
import {
  buildPrintableHtmlDocument,
  fetchBuffer,
  parseCloudinaryConfig,
  renderHtmlToPdf,
  renderMarkdownHtml,
} from "./pdf-core"

/**
 * Creates a Markdown-to-PDF tool with request-specific Cloudinary credentials.
 */
export function createMarkdownToPdfTool(context?: { headers?: HeadersInit }) {
  const cloudinaryConfig = parseCloudinaryConfig(context?.headers)
  return tool(
    async ({ markdown, filename }) => {
      const bodyMarkup = renderMarkdownHtml(markdown)
      const html = buildPrintableHtmlDocument(filename ?? "document", bodyMarkup)
      const result = await renderHtmlToPdf(
        html,
        filename ?? "document",
        cloudinaryConfig ?? undefined
      )
      return { type: "markdown_to_pdf", ...result }
    },
    {
      name: "markdown_to_pdf",
      description: "Convert Markdown text to PDF (via LaTeX) and return URL/data.",
      schema: z.object({ markdown: z.string().min(1), filename: z.string().optional() }),
    }
  )
}

export const pdfExtractTextTool = tool(
  async ({ path: filePath, source, maxChars }) => {
    const bytes = filePath
      ? await readFile(resolveWorkspacePath(filePath))
      : await fetchBuffer(source!)
    const { PDFParse } = await import("pdf-parse")
    const parser = new PDFParse({ data: new Uint8Array(bytes) })
    try {
      const result = await parser.getText()
      const text = result.text ?? ""
      return {
        type: "pdf_extract_text",
        path: filePath,
        source,
        pages: result.pages?.length ?? undefined,
        text: truncateString(text, maxChars ?? 12000),
        chars: text.length,
      }
    } finally {
      await parser.destroy()
    }
  },
  {
    name: "pdf_extract_text",
    description: "Extract text from a PDF workspace file, URL, or data URL.",
    schema: z
      .object({
        path: z.string().optional(),
        source: z.string().optional(),
        maxChars: z.number().int().min(100).max(50000).optional(),
      })
      .refine((value) => value.path || value.source, { message: "Provide path or source" }),
  }
)
