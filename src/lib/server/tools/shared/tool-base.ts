import { tool } from "@langchain/core/tools"
import { z } from "zod"

export const emptySchema = z.object({})
export const pathLimitSchema = z.object({
  path: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional(),
})
export const dryRunSchema = z.object({ dryRun: z.boolean().optional().default(true) })

export type Finding = ReturnType<typeof finding>
export type TraceStep = { action: string; file: string; line: number; detail: string }

export function finding(
  severity: "error" | "warning" | "info",
  file: string,
  line: number | undefined,
  message: string,
  hint?: string
) {
  return { severity, file, line, message, hint }
}

export function toolDefinition<I extends z.ZodTypeAny>(
  name: string,
  description: string,
  schema: I,
  handler: (input: z.infer<I>) => Promise<unknown> | unknown
) {
  return tool(async (input) => handler(input as z.infer<I>), { name, description, schema })
}
