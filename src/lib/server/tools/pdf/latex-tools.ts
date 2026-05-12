import { tool } from "@langchain/core/tools"
import { z } from "zod"

import { compileLatexToPdf, parseCloudinaryConfig } from "./pdf-core"

/**
 * Creates a LaTeX-to-PDF tool with request-specific Cloudinary credentials.
 */
export function createGenerateLatexPdfTool(context?: { headers?: HeadersInit }) {
  const cloudinaryConfig = parseCloudinaryConfig(context?.headers)
  return tool(
    async ({ filename, texContent }) => {
      const result = await compileLatexToPdf(
        texContent,
        filename ?? "document",
        cloudinaryConfig ?? undefined
      )
      return { type: "generate_latex_pdf", ...result }
    },
    {
      name: "generate_latex_pdf",
      description: "Generate a PDF from LaTeX.",
      schema: z.object({ filename: z.string().optional(), texContent: z.string().min(1) }),
    }
  )
}
