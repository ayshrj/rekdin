import { countTokens, decode, encode } from "gpt-tokenizer"

import type { TokenUsageEstimate } from "@/types/runtime"

export const DEFAULT_CONTEXT_TOKEN_BUDGET = 12_000
export const DEFAULT_CURRENT_TOOL_TOKEN_BUDGET = 1_500
export const DEFAULT_HISTORY_TOOL_TOKEN_BUDGET = 400

export function estimateTokens(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "")
  try {
    return countTokens(text)
  } catch {
    return Math.ceil(text.length / 4)
  }
}

export function truncateTextByTokens(text: string, maxTokens: number) {
  if (maxTokens <= 0) {
    const originalTokens = estimateTokens(text)
    return { text: "", originalTokens, tokens: 0, truncated: originalTokens > 0 }
  }
  const tokenCount = estimateTokens(text)
  if (tokenCount <= maxTokens) {
    return { text, originalTokens: tokenCount, tokens: tokenCount, truncated: false }
  }

  try {
    const suffix = `\n\n...[truncated, ${tokenCount} tokens total]`
    const suffixTokens = estimateTokens(suffix)
    const sliceBudget = Math.max(maxTokens - suffixTokens, 1)
    const truncated = `${decode(encode(text).slice(0, sliceBudget))}${suffix}`
    return {
      text: truncated,
      originalTokens: tokenCount,
      tokens: estimateTokens(truncated),
      truncated: true,
    }
  } catch {
    const approxChars = Math.max(maxTokens * 4, 1)
    const truncated = `${text.slice(0, approxChars)}\n\n...[truncated, ${tokenCount} tokens total]`
    return {
      text: truncated,
      originalTokens: tokenCount,
      tokens: estimateTokens(truncated),
      truncated: true,
    }
  }
}

export function createEmptyTokenUsageEstimate(): TokenUsageEstimate {
  return {
    systemPromptTokens: 0,
    historyTokens: 0,
    toolSchemaTokens: 0,
    toolResultTokens: 0,
    originalToolResultTokens: 0,
    savedToolResultTokens: 0,
    completionTokens: 0,
    totalPromptTokens: 0,
    totalTokens: 0,
  }
}

export function finalizeTokenUsageEstimate(
  estimate: TokenUsageEstimate,
  completionTokens: number
): TokenUsageEstimate {
  const totalPromptTokens =
    estimate.systemPromptTokens +
    estimate.historyTokens +
    estimate.toolSchemaTokens +
    estimate.toolResultTokens
  return {
    ...estimate,
    completionTokens,
    savedToolResultTokens: Math.max(
      estimate.originalToolResultTokens - estimate.toolResultTokens,
      0
    ),
    totalPromptTokens,
    totalTokens: totalPromptTokens + completionTokens,
  }
}
