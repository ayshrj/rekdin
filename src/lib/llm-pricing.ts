import { LlmProvider } from "@/types/runtime"

type Price = {
  inputPerMillion: number
  outputPerMillion: number
}

const PRICING: Record<string, Price> = {
  "openai:gpt-4o": { inputPerMillion: 2.5, outputPerMillion: 10 },
  "openai:gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  "openai:gpt-4.1": { inputPerMillion: 2, outputPerMillion: 8 },
  "openai:gpt-4.1-mini": { inputPerMillion: 0.4, outputPerMillion: 1.6 },
  "claude:claude-sonnet-4": { inputPerMillion: 3, outputPerMillion: 15 },
  "claude:claude-opus-4": { inputPerMillion: 15, outputPerMillion: 75 },
  "gemini:gemini-2.5-pro": { inputPerMillion: 1.25, outputPerMillion: 10 },
  "gemini:gemini-2.5-flash": { inputPerMillion: 0.3, outputPerMillion: 2.5 },
}

function findPrice(provider: LlmProvider | string, model?: string) {
  const normalized = `${provider}:${model ?? ""}`.toLowerCase()
  const key = Object.keys(PRICING).find((entry) => normalized.includes(entry))
  return key ? PRICING[key] : null
}

export function estimateLlmCostUsd({
  provider,
  model,
  inputTokens,
  outputTokens,
}: {
  provider: LlmProvider | string
  model?: string
  inputTokens: number
  outputTokens: number
}) {
  const price = findPrice(provider, model)
  if (!price) return null
  return (inputTokens * price.inputPerMillion + outputTokens * price.outputPerMillion) / 1_000_000
}
