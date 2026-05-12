import { jsonrepair } from "jsonrepair"

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

function candidateJsonStrings(raw: string) {
  const trimmed = raw.trim()
  const candidates = new Set<string>()

  for (const match of trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) {
    const candidate = match[1]?.trim()
    if (candidate) candidates.add(candidate)
  }

  const firstObject = trimmed.indexOf("{")
  const lastObject = trimmed.lastIndexOf("}")
  if (firstObject >= 0 && lastObject > firstObject) {
    candidates.add(trimmed.slice(firstObject, lastObject + 1))
  }

  const firstArray = trimmed.indexOf("[")
  const lastArray = trimmed.lastIndexOf("]")
  if (firstArray >= 0 && lastArray > firstArray) {
    candidates.add(trimmed.slice(firstArray, lastArray + 1))
  }

  if (trimmed) candidates.add(trimmed)

  return [...candidates]
}

function parseJsonCandidates(raw: string) {
  const parsedCandidates: Array<{ parsed: JsonValue; normalized: string; repaired: boolean }> = []
  for (const candidate of candidateJsonStrings(raw)) {
    try {
      parsedCandidates.push({
        parsed: JSON.parse(candidate) as JsonValue,
        normalized: candidate,
        repaired: false,
      })
      continue
    } catch {
      try {
        const repaired = jsonrepair(candidate)
        parsedCandidates.push({
          parsed: JSON.parse(repaired) as JsonValue,
          normalized: repaired,
          repaired: true,
        })
      } catch {
        // Try the next candidate.
      }
    }
  }

  return parsedCandidates
}

/**
 * Recursively validates the subset of JSON Schema used by workflow response contracts.
 */
function validateNode(
  value: unknown,
  schema: Record<string, unknown>,
  path: string,
  errors: string[]
) {
  const expectedType = typeof schema.type === "string" ? schema.type : undefined

  if (expectedType === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      errors.push(`${path} should be an object`)
      return
    }
    const record = value as Record<string, unknown>
    const required = Array.isArray(schema.required) ? schema.required : []
    for (const key of required) {
      if (typeof key === "string" && !(key in record)) {
        errors.push(`${path}.${key} is required`)
      }
    }
    const properties =
      schema.properties && typeof schema.properties === "object"
        ? (schema.properties as Record<string, Record<string, unknown>>)
        : {}
    for (const [key, childSchema] of Object.entries(properties)) {
      if (key in record) {
        validateNode(record[key], childSchema, `${path}.${key}`, errors)
      }
    }
    return
  }

  if (expectedType === "array") {
    if (!Array.isArray(value)) {
      errors.push(`${path} should be an array`)
      return
    }
    if (schema.items && typeof schema.items === "object") {
      value.forEach((item, index) =>
        validateNode(item, schema.items as Record<string, unknown>, `${path}[${index}]`, errors)
      )
    }
    return
  }

  if (expectedType === "string" && typeof value !== "string") {
    errors.push(`${path} should be a string`)
  }
  if (expectedType === "number" && typeof value !== "number") {
    errors.push(`${path} should be a number`)
  }
  if (expectedType === "boolean" && typeof value !== "boolean") {
    errors.push(`${path} should be a boolean`)
  }
}

/**
 * Parses and validates an assistant reply against an optional workflow response schema.
 * No schema means free-form chat output is accepted.
 */
export function validateStructuredOutput(raw: string, schema?: Record<string, unknown> | null) {
  if (!schema) {
    return { valid: true as const, parsed: null, errors: [] as string[] }
  }

  const parsedCandidates = parseJsonCandidates(raw)
  if (parsedCandidates.length === 0) {
    return {
      valid: false as const,
      parsed: null,
      errors: ["Response is not valid JSON"],
    }
  }

  let firstErrors: string[] = []
  let firstCandidate = parsedCandidates[0]
  for (const parsedCandidate of parsedCandidates) {
    const errors: string[] = []
    validateNode(parsedCandidate.parsed, schema, "$", errors)
    if (errors.length === 0) {
      return {
        valid: true as const,
        parsed: parsedCandidate.parsed,
        errors,
        normalized: parsedCandidate.normalized,
        repaired: parsedCandidate.repaired,
      }
    }
    if (firstErrors.length === 0) {
      firstErrors = errors
      firstCandidate = parsedCandidate
    }
  }

  return {
    valid: false as const,
    parsed: firstCandidate.parsed,
    errors: firstErrors,
    normalized: firstCandidate.normalized,
    repaired: firstCandidate.repaired,
  }
}
