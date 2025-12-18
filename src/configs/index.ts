export const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini"
export const OPENROUTER_FALLBACK_MODEL =
  process.env.OPENROUTER_FALLBACK_MODEL ?? "openai/gpt-4o-mini"
export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? ""
// Exposed to both server and client; set NEXT_PUBLIC_SHOW_LOGS=true to enable client logging
export const SHOW_LOGS =
  (process.env.NEXT_PUBLIC_SHOW_LOGS ?? process.env.SHOW_LOGS ?? "").toLowerCase() === "true"
