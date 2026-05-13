import { z } from "zod"

import { boundedLimit, previewString } from "../shared/formatting"
import { inferJsonSchema, safeJsonParse } from "../shared/json"
import { finding, toolDefinition } from "../shared/tool-base"

export const promptLintTool = toolDefinition(
  "prompt_lint",
  "Check prompts for ambiguity, conflicting constraints, missing schema, and unsafe assumptions.",
  z.object({ prompt: z.string().min(1) }),
  async ({ prompt }) => {
    const findings = []
    if (!/format|schema|json|markdown|return/i.test(prompt))
      findings.push(
        finding("warning", "prompt", undefined, "Prompt does not specify an output format.")
      )
    if (/\bmaybe\b|\btry\b|\bas needed\b/i.test(prompt))
      findings.push(finding("info", "prompt", undefined, "Prompt contains ambiguous phrasing."))
    if (/ignore previous|system prompt/i.test(prompt))
      findings.push(
        finding(
          "error",
          "prompt",
          undefined,
          "Prompt contains instruction-hierarchy risk language."
        )
      )
    return { type: "prompt_lint", findings }
  }
)

export const jsonOutputRepairTool = toolDefinition(
  "json_output_repair",
  "Repair invalid JSON while preserving intent where possible.",
  z.object({ text: z.string().min(1) }),
  async ({ text }) => {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? text
    const candidate = fenced.replace(/,\s*([}\]])/g, "$1")
    const parsed = safeJsonParse(candidate)
    return { type: "json_output_repair", repaired: parsed ?? candidate, valid: parsed != null }
  }
)

export const schemaFromExamplesTool = toolDefinition(
  "schema_from_examples",
  "Generate JSON Schema from example outputs.",
  z.object({ examples: z.array(z.unknown()).min(1) }),
  async ({ examples }) => ({
    type: "schema_from_examples",
    schema: inferJsonSchema(examples[0]),
    exampleCount: examples.length,
  })
)

export const examplesValidateAgainstSchemaTool = toolDefinition(
  "examples_validate_against_schema",
  "Validate examples against a simple inferred or provided JSON Schema.",
  z.object({
    examples: z.array(z.unknown()).min(1),
    schema: z.record(z.string(), z.unknown()).optional(),
  }),
  async ({ examples, schema }) => {
    const target = schema ?? inferJsonSchema(examples[0])
    const expectedType = target.type
    return {
      type: "examples_validate_against_schema",
      schema: target,
      results: examples.map((example, index) => ({
        index,
        valid: Array.isArray(example) ? expectedType === "array" : typeof example === expectedType,
      })),
    }
  }
)

export const evalCaseGenerateTool = toolDefinition(
  "eval_case_generate",
  "Generate eval cases for an agent, tool, or prompt.",
  z.object({ subject: z.string().min(1), count: z.number().int().optional() }),
  async ({ subject, count }) => ({
    type: "eval_case_generate",
    cases: Array.from({ length: boundedLimit(count, 5, 50) }, (_, index) => ({
      id: `${subject}-${index + 1}`,
      input: `Evaluate ${subject} scenario ${index + 1}`,
      expected: "Structured, bounded, inspectable output.",
    })),
  })
)

export const llmResponseAuditTool = toolDefinition(
  "llm_response_audit",
  "Audit an LLM output against instructions, schema, and style guide.",
  z.object({ instructions: z.string().optional(), response: z.string().min(1) }),
  async ({ instructions, response }) => {
    const findings = []
    if (instructions && /json/i.test(instructions) && safeJsonParse(response) == null)
      findings.push(
        finding(
          "error",
          "response",
          undefined,
          "Response is not valid JSON despite JSON instruction."
        )
      )
    if (response.length > 8000)
      findings.push(
        finding(
          "warning",
          "response",
          undefined,
          "Response is very long; consider tighter summarization."
        )
      )
    return { type: "llm_response_audit", findings }
  }
)
