import { tool } from "@langchain/core/tools"
import { JSDOM } from "jsdom"
import { z } from "zod"

import { splitCSVLine } from "../shared/csv"
import { readWorkspaceText } from "../workspace/workspace-fs"

function validateSchema(data: unknown, schema: Record<string, unknown>, path = "$"): string[] {
  const errors: string[] = []
  const typ = schema.type
  if (typ) {
    const allowed = Array.isArray(typ) ? typ : [typ]
    const actual = data === null ? "null" : Array.isArray(data) ? "array" : typeof data
    if (!allowed.includes(actual)) {
      errors.push(`${path}: expected type ${allowed.join("|")}, got ${actual}`)
    }
  }
  if (schema.enum && Array.isArray(schema.enum)) {
    if (!schema.enum.some((v) => JSON.stringify(v) === JSON.stringify(data)))
      errors.push(`${path}: value not in enum`)
  }
  if (typeof data === "string") {
    if (typeof schema.minLength === "number" && data.length < schema.minLength)
      errors.push(`${path}: length ${data.length} < minLength ${schema.minLength}`)
    if (typeof schema.maxLength === "number" && data.length > schema.maxLength)
      errors.push(`${path}: length ${data.length} > maxLength ${schema.maxLength}`)
    if (typeof schema.pattern === "string") {
      try {
        if (!new RegExp(schema.pattern).test(data)) errors.push(`${path}: pattern mismatch`)
      } catch {
        /* ignore invalid pattern */
      }
    }
  }
  if (typeof data === "number") {
    if (typeof schema.minimum === "number" && data < schema.minimum)
      errors.push(`${path}: ${data} < minimum ${schema.minimum}`)
    if (typeof schema.maximum === "number" && data > schema.maximum)
      errors.push(`${path}: ${data} > maximum ${schema.maximum}`)
  }
  if (data !== null && typeof data === "object" && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>
    if (Array.isArray(schema.required)) {
      for (const key of schema.required as string[]) {
        if (!(key in obj)) errors.push(`${path}: missing required property "${key}"`)
      }
    }
    if (schema.properties && typeof schema.properties === "object") {
      for (const [k, s] of Object.entries(schema.properties as Record<string, unknown>)) {
        if (k in obj)
          errors.push(...validateSchema(obj[k], s as Record<string, unknown>, `${path}.${k}`))
      }
    }
  }
  if (Array.isArray(data)) {
    if (typeof schema.minItems === "number" && data.length < schema.minItems)
      errors.push(`${path}: length ${data.length} < minItems ${schema.minItems}`)
    if (typeof schema.maxItems === "number" && data.length > schema.maxItems)
      errors.push(`${path}: length ${data.length} > maxItems ${schema.maxItems}`)
    if (schema.items && typeof schema.items === "object") {
      data.forEach((item, i) =>
        errors.push(
          ...validateSchema(item, schema.items as Record<string, unknown>, `${path}[${i}]`)
        )
      )
    }
  }
  return errors
}

export const jsonSchemaValidateTool = tool(
  async ({
    data,
    schema,
    dataPath,
  }: {
    data?: unknown
    schema: Record<string, unknown>
    dataPath?: string
  }) => {
    let value: unknown = data
    if (dataPath) {
      try {
        value = JSON.parse(await readWorkspaceText(dataPath))
      } catch (err) {
        return {
          type: "json_schema_validate",
          error: `Could not read/parse ${dataPath}: ${err instanceof Error ? err.message : String(err)}`,
        }
      }
    }
    const errors = validateSchema(value, schema)
    return {
      type: "json_schema_validate",
      valid: errors.length === 0,
      errorCount: errors.length,
      errors: errors.slice(0, 50),
    }
  },
  {
    name: "json_schema_validate",
    description:
      "Validate a JSON value against a JSON Schema (draft-7 subset). Supply inline data or a workspace file path.",
    schema: z.object({
      data: z.unknown().optional(),
      schema: z.record(z.string(), z.unknown()),
      dataPath: z.string().optional(),
    }),
  }
)

export const urlSafetyCheckTool = tool(
  async ({ url }) => {
    const parsed = new URL(url)
    const warnings = []
    if (parsed.protocol !== "https:") warnings.push("URL is not HTTPS")
    if (/(\d{1,3}\.){3}\d{1,3}/.test(parsed.hostname)) warnings.push("URL uses a raw IPv4 address")
    if (parsed.username || parsed.password) warnings.push("URL contains credentials")
    if (parsed.hostname === "localhost" || parsed.hostname.endsWith(".local"))
      warnings.push("URL targets a local hostname")
    return {
      type: "url_safety_check",
      url,
      hostname: parsed.hostname,
      protocol: parsed.protocol,
      warnings,
    }
  },
  {
    name: "url_safety_check",
    description: "Check URL syntax and simple safety signals.",
    schema: z.object({ url: z.string().url() }),
  }
)

export const csvToJsonTool = tool(
  async ({ csv, path: filePath }: { csv?: string; path?: string }) => {
    const text = filePath ? await readWorkspaceText(filePath) : (csv ?? "")
    const lines = text.trim().split(/\r?\n/).filter(Boolean)
    if (lines.length === 0) return { type: "csv_to_json", rows: [], headers: [] }
    const headers = splitCSVLine(lines[0])
    const rows = lines.slice(1).map((line) => {
      const vals = splitCSVLine(line)
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]))
    })
    return {
      type: "csv_to_json",
      headers,
      rowCount: rows.length,
      rows: rows.slice(0, 500),
      omittedRows: Math.max(rows.length - 500, 0),
    }
  },
  {
    name: "csv_to_json",
    description: "Convert CSV text or a workspace file to a JSON array of objects.",
    schema: z.object({
      csv: z.string().optional(),
      path: z.string().optional(),
    }),
  }
)

export const jsonToCsvTool = tool(
  async ({ json, path: filePath }: { json?: unknown[]; path?: string }) => {
    let rows: unknown[]
    if (filePath) {
      rows = JSON.parse(await readWorkspaceText(filePath)) as unknown[]
    } else {
      rows = json ?? []
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return { type: "json_to_csv", csv: "", rowCount: 0, headers: [] }
    }
    const first = rows[0] as Record<string, unknown>
    const headers = Object.keys(first)
    function escapeCell(v: unknown): string {
      const s = v === null || v === undefined ? "" : String(v)
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s
    }
    const csvLines = [
      headers.map(escapeCell).join(","),
      ...(rows as Array<Record<string, unknown>>).map((row) =>
        headers.map((h) => escapeCell(row[h])).join(",")
      ),
    ]
    return {
      type: "json_to_csv",
      headers,
      rowCount: rows.length,
      csv: csvLines.join("\n"),
    }
  },
  {
    name: "json_to_csv",
    description: "Convert a JSON array of objects to CSV text.",
    schema: z.object({
      json: z.array(z.unknown()).optional(),
      path: z.string().optional(),
    }),
  }
)

export const xmlToJsonTool = tool(
  async ({ xml, path: filePath }: { xml?: string; path?: string }) => {
    const text = filePath ? await readWorkspaceText(filePath) : (xml ?? "")
    function nodeToJson(node: Element): unknown {
      const children = Array.from(node.children)
      if (children.length === 0) {
        const attrs = Array.from(node.attributes).reduce(
          (acc, a) => {
            acc[`@${a.name}`] = a.value
            return acc
          },
          {} as Record<string, string>
        )
        const hasAttrs = Object.keys(attrs).length > 0
        if (hasAttrs) return { ...attrs, "#text": node.textContent ?? "" }
        return node.textContent ?? ""
      }
      const result: Record<string, unknown> = {}
      for (const attr of Array.from(node.attributes)) result[`@${attr.name}`] = attr.value
      for (const child of children) {
        const key = child.tagName
        const val = nodeToJson(child)
        if (key in result) {
          if (!Array.isArray(result[key])) result[key] = [result[key]]
          ;(result[key] as unknown[]).push(val)
        } else {
          result[key] = val
        }
      }
      return result
    }
    const dom = new JSDOM(text, { contentType: "text/xml" })
    const root = dom.window.document.documentElement
    return {
      type: "xml_to_json",
      rootTag: root.tagName,
      json: nodeToJson(root),
    }
  },
  {
    name: "xml_to_json",
    description: "Convert XML text or a workspace file to a JSON representation.",
    schema: z.object({
      xml: z.string().optional(),
      path: z.string().optional(),
    }),
  }
)

export const xpathQueryTool = tool(
  async ({ html, path: filePath, xpath }: { html?: string; path?: string; xpath: string }) => {
    const text = filePath ? await readWorkspaceText(filePath) : (html ?? "")
    const dom = new JSDOM(text)
    const doc = dom.window.document
    const result = doc.evaluate(xpath, doc, null, dom.window.XPathResult.ANY_TYPE, null)
    const nodes: Array<{ tag: string; text: string; html: string }> = []
    let node = result.iterateNext()
    while (node && nodes.length < 100) {
      if (node.nodeType === 1) {
        const el = node as Element
        nodes.push({
          tag: el.tagName,
          text: (el.textContent ?? "").slice(0, 500),
          html: el.outerHTML.slice(0, 500),
        })
      } else {
        nodes.push({ tag: "#text", text: (node.textContent ?? "").slice(0, 500), html: "" })
      }
      node = result.iterateNext()
    }
    return {
      type: "xpath_query",
      xpath,
      matchCount: nodes.length,
      nodes,
    }
  },
  {
    name: "xpath_query",
    description: "Run an XPath expression against HTML/XML text or a workspace file.",
    schema: z.object({
      html: z.string().optional(),
      path: z.string().optional(),
      xpath: z.string().min(1),
    }),
  }
)
