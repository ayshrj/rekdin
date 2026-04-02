type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

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

export function validateStructuredOutput(raw: string, schema?: Record<string, unknown> | null) {
  if (!schema) {
    return { valid: true as const, parsed: null, errors: [] as string[] }
  }

  let parsed: JsonValue
  try {
    parsed = JSON.parse(raw) as JsonValue
  } catch {
    return {
      valid: false as const,
      parsed: null,
      errors: ["Response is not valid JSON"],
    }
  }

  const errors: string[] = []
  validateNode(parsed, schema, "$", errors)

  return {
    valid: errors.length === 0,
    parsed,
    errors,
  }
}
