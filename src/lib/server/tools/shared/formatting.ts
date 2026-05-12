/**
 * Limits large text values before sending them back to the model or UI.
 */
export function truncateString(value: string, max = 4000) {
  if (value.length <= max) return value
  return `${value.slice(0, max)}\n\n...(truncated, ${value.length} chars total)`
}

export function boundedLimit(value: unknown, fallback: number, max: number) {
  const parsed = typeof value === "number" ? Math.floor(value) : Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, max)
}

export function previewString(value: unknown, max = 300) {
  const text = typeof value === "string" ? value : value == null ? "" : String(value)
  const normalized = text.replace(/\s+/g, " ").trim()
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max)}...`
}
