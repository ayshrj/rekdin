import { tool } from "@langchain/core/tools"
import { z } from "zod"

/**
 * Encodes plain text as base64.
 */
export const base64EncodeTool = tool(
  async ({ text }) => {
    const encoded = Buffer.from(text, "utf-8").toString("base64")
    return { type: "base64_encode", text, encoded }
  },
  {
    name: "base64_encode",
    description: "Base64-encode text.",
    schema: z.object({ text: z.string().min(1) }),
  }
)

/**
 * Decodes base64 text as UTF-8.
 */
export const base64DecodeTool = tool(
  async ({ encoded }) => {
    const decoded = Buffer.from(encoded, "base64").toString("utf-8")
    return { type: "base64_decode", decoded }
  },
  {
    name: "base64_decode",
    description: "Decode base64-encoded text.",
    schema: z.object({ encoded: z.string().min(1) }),
  }
)
