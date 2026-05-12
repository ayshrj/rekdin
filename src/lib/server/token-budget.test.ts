import { describe, expect, it } from "vitest"

import { estimateTokens, truncateTextByTokens } from "./token-budget"

describe("token budget helpers", () => {
  it("counts and truncates text by tokens", () => {
    const text = Array.from({ length: 500 }, (_, index) => `word${index}`).join(" ")
    const originalTokens = estimateTokens(text)
    const truncated = truncateTextByTokens(text, 80)

    expect(originalTokens).toBeGreaterThan(80)
    expect(truncated.truncated).toBe(true)
    expect(truncated.tokens).toBeLessThanOrEqual(90)
    expect(truncated.text).toContain("truncated")
  })

  it("keeps small text unchanged", () => {
    const text = "short local content"
    const result = truncateTextByTokens(text, 100)

    expect(result.truncated).toBe(false)
    expect(result.text).toBe(text)
  })
})
