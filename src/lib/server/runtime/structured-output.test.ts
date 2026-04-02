import { describe, expect, it } from "vitest"

import { validateStructuredOutput } from "./structured-output"

describe("validateStructuredOutput", () => {
  it("accepts valid JSON matching the schema", () => {
    const result = validateStructuredOutput(
      JSON.stringify({ summary: "ok", sources: [{ title: "A", url: "https://example.com" }] }),
      {
        type: "object",
        required: ["summary", "sources"],
        properties: {
          summary: { type: "string" },
          sources: {
            type: "array",
            items: {
              type: "object",
              required: ["title", "url"],
              properties: {
                title: { type: "string" },
                url: { type: "string" },
              },
            },
          },
        },
      }
    )

    expect(result.valid).toBe(true)
  })

  it("rejects invalid JSON and missing required fields", () => {
    const malformed = validateStructuredOutput("{oops", { type: "object" })
    expect(malformed.valid).toBe(false)

    const missingField = validateStructuredOutput(JSON.stringify({ summary: "ok" }), {
      type: "object",
      required: ["summary", "sources"],
      properties: {
        summary: { type: "string" },
        sources: { type: "array" },
      },
    })
    expect(missingField.valid).toBe(false)
    expect(missingField.errors[0]).toContain("sources")
  })
})
