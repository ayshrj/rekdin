export function getJsonPath(value: unknown, query: string) {
  if (!query || query === "$") return value
  const normalized = query.startsWith("$.") ? query.slice(2) : query.replace(/^\//, "")
  const parts = normalized.split(/[./]/).flatMap((part) => {
    const tokens: string[] = []
    const re = /([^[\]]+)|\[(\d+)\]/g
    for (const match of part.matchAll(re)) tokens.push(match[1] ?? match[2] ?? "")
    return tokens.filter(Boolean)
  })
  let cursor = value as unknown
  for (const part of parts) {
    if (Array.isArray(cursor)) {
      cursor = cursor[Number(part)]
    } else if (cursor && typeof cursor === "object") {
      cursor = (cursor as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return cursor
}
