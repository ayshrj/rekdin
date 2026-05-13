export function unifiedPatch(pathName: string, before: string, after: string) {
  return [
    `diff --git a/${pathName} b/${pathName}`,
    `--- a/${pathName}`,
    `+++ b/${pathName}`,
    "@@",
    ...before.split(/\r?\n/).map((line) => `-${line}`),
    ...after.split(/\r?\n/).map((line) => `+${line}`),
    "",
  ].join("\n")
}

/**
 * Parses a JSON Pointer path into unescaped path segments for JSON/YAML patching.
 */
export function parseJsonPointer(pointer: string) {
  const parts = pointer.split("/").slice(1)
  return parts.map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"))
}

/**
 * Applies one add, replace, or remove operation to an in-memory JSON-compatible value.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyOperation(target: any, op: { op: string; path: string; value?: any }) {
  const tokens = parseJsonPointer(op.path)
  if (tokens.length === 0) {
    if (op.op === "replace" || op.op === "add") return op.value
    if (op.op === "remove") return undefined
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let curr: any = target
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const key = tokens[i]
    if (curr[key] == null) {
      curr[key] = Number.isInteger(Number(tokens[i + 1])) ? [] : {}
    }
    curr = curr[key]
  }
  const last = tokens[tokens.length - 1]

  if (op.op === "add" || op.op === "replace") {
    if (Array.isArray(curr)) {
      const index = last === "-" ? curr.length : Number(last)
      if (op.op === "add") {
        curr.splice(index, 0, op.value)
      } else {
        curr[index] = op.value
      }
    } else {
      curr[last] = op.value
    }
    return target
  }

  if (op.op === "remove") {
    if (Array.isArray(curr)) {
      const index = Number(last)
      if (!Number.isNaN(index)) curr.splice(index, 1)
    } else {
      delete curr[last]
    }
    return target
  }

  throw new Error(`Unsupported op: ${op.op}`)
}

/**
 * Applies the subset of JSON Patch operations supported by Rekdin's patch tools.
 */
export function applyJsonPatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  document: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  operations: Array<{ op: string; path: string; value?: any }>
) {
  let target = JSON.parse(JSON.stringify(document))
  for (const op of operations) {
    target = applyOperation(target, op)
  }
  return target
}
