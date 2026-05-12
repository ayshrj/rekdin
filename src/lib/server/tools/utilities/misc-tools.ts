import { tool } from "@langchain/core/tools"
import { createTwoFilesPatch } from "diff"
import { z } from "zod"

import { readWorkspaceText } from "../workspace/workspace-fs"

export const regexMatchTool = tool(
  async ({
    pattern,
    text,
    flags = "",
    limit = 50,
  }: {
    pattern: string
    text: string
    flags?: string
    limit?: number
  }) => {
    let regex: RegExp
    try {
      const gFlags = flags.includes("g") ? flags : flags + "g"
      regex = new RegExp(pattern, gFlags)
    } catch (err) {
      return {
        type: "regex_match",
        error: `Invalid regex: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
    const matches: Array<{
      match: string
      index: number
      captures: string[]
      groups: Record<string, string> | undefined
    }> = []
    let m: RegExpExecArray | null
    while ((m = regex.exec(text)) !== null && matches.length < limit) {
      matches.push({ match: m[0], index: m.index, captures: m.slice(1), groups: m.groups })
      if (m[0].length === 0) regex.lastIndex++
    }
    const hasMore = m !== null
    return {
      type: "regex_match",
      pattern,
      flags,
      matchCount: matches.length + (hasMore ? "+" : ""),
      matches,
    }
  },
  {
    name: "regex_match",
    description:
      "Test a regex pattern against text and return all matches, capture groups, and indices.",
    schema: z.object({
      pattern: z.string().min(1),
      text: z.string(),
      flags: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }),
  }
)

export const urlParseTool = tool(
  async ({ url }: { url: string }) => {
    try {
      const p = new URL(url)
      const params: Record<string, string> = {}
      p.searchParams.forEach((v, k) => {
        params[k] = v
      })
      return {
        type: "url_parse",
        input: url,
        protocol: p.protocol,
        host: p.host,
        hostname: p.hostname,
        port: p.port || undefined,
        pathname: p.pathname,
        search: p.search || undefined,
        hash: p.hash || undefined,
        origin: p.origin,
        params: Object.keys(params).length > 0 ? params : undefined,
      }
    } catch (err) {
      return {
        type: "url_parse",
        error: `Invalid URL: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  },
  {
    name: "url_parse",
    description: "Parse a URL into protocol, host, path, query parameters, and hash.",
    schema: z.object({ url: z.string().min(1) }),
  }
)

const CRON_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const
const CRON_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const

function explainCronField(
  value: string,
  singular: string,
  plural: string,
  names?: readonly string[],
  offset = 0
): string {
  if (value === "*" || value === "?") return `every ${singular}`
  const name = (raw: string) => {
    const n = parseInt(raw, 10)
    return names && !isNaN(n) ? (names[n - offset] ?? raw) : raw
  }
  if (value.startsWith("*/")) return `every ${value.slice(2)} ${plural}`
  if (value.includes(",")) return `at ${value.split(",").map(name).join(", ")}`
  const [range, step] = value.split("/", 2)
  if (range.includes("-")) {
    const [s, e] = range.split("-")
    const desc = `from ${name(s)} to ${name(e)}`
    return step ? `every ${step} ${plural}, ${desc}` : desc
  }
  return name(range)
}

export const cronExplainTool = tool(
  async ({ expression }: { expression: string }) => {
    const parts = expression.trim().split(/\s+/)
    if (parts.length < 5 || parts.length > 6) {
      return {
        type: "cron_explain",
        error: `Expected 5 or 6 fields, got ${parts.length}.`,
      }
    }
    const has6 = parts.length === 6
    const [sec, min, hour, dom, month, dow] = has6 ? parts : ["0", ...parts]
    return {
      type: "cron_explain",
      expression,
      fields: {
        second: has6 ? explainCronField(sec, "second", "seconds") : undefined,
        minute: explainCronField(min, "minute", "minutes"),
        hour: explainCronField(hour, "hour", "hours"),
        dayOfMonth: explainCronField(dom, "day", "days"),
        month: explainCronField(month, "month", "months", CRON_MONTHS, 1),
        dayOfWeek: explainCronField(dow, "weekday", "weekdays", CRON_DAYS, 0),
      },
      summary: [
        has6 && sec !== "0" ? `at second ${explainCronField(sec, "second", "seconds")}` : null,
        `minute ${explainCronField(min, "minute", "minutes")}`,
        `hour ${explainCronField(hour, "hour", "hours")}`,
        dom !== "*" && dom !== "?" ? `day ${explainCronField(dom, "day", "days")}` : null,
        month !== "*" ? `in ${explainCronField(month, "month", "months", CRON_MONTHS, 1)}` : null,
        dow !== "*" && dow !== "?"
          ? `on ${explainCronField(dow, "weekday", "weekdays", CRON_DAYS, 0)}`
          : null,
      ]
        .filter(Boolean)
        .join(", "),
    }
  },
  {
    name: "cron_explain",
    description: "Describe a 5- or 6-field cron expression in plain English, field by field.",
    schema: z.object({ expression: z.string().min(1) }),
  }
)

function parseHex(hex: string): [number, number, number] | null {
  const h = hex.replace(/^#/, "")
  if (h.length === 3) {
    return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)]
  }
  if (h.length === 6) {
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  }
  return null
}
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255
  const max = Math.max(rn, gn, bn),
    min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, Math.round(l * 100)]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / d + 2) / 6
  else h = ((rn - gn) / d + 4) / 6
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sn = s / 100,
    ln = l / 100
  const a = sn * Math.min(ln, 1 - ln)
  const k = (n: number) => (n + h / 30) % 12
  const f = (n: number) =>
    Math.round(255 * (ln - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))))
  return [f(0), f(8), f(4)]
}
function toHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")
}

export const colorConvertTool = tool(
  async ({ color }: { color: string }) => {
    const c = color.trim().toLowerCase()
    let rgb: [number, number, number] | null = null

    if (c.startsWith("#") || /^[0-9a-f]{3,6}$/i.test(c)) {
      rgb = parseHex(c)
    } else if (c.startsWith("rgb")) {
      const m = c.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/)
      if (m) rgb = [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])]
    } else if (c.startsWith("hsl")) {
      const m = c.match(/([\d.]+)[,\s]+([\d.]+)%?[,\s]+([\d.]+)%?/)
      if (m) rgb = hslToRgb(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]))
    } else if (/^\d+[,\s]+\d+[,\s]+\d+$/.test(c)) {
      const m = c.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/)
      if (m) {
        const vals = [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])]
        rgb =
          vals[0] <= 360 && vals[1] <= 100 && vals[2] <= 100
            ? hslToRgb(vals[0], vals[1], vals[2])
            : ([vals[0], vals[1], vals[2]] as [number, number, number])
      }
    }

    if (!rgb) {
      return {
        type: "color_convert",
        error: `Could not parse color: "${color}". Use hex (#rrggbb), rgb(r,g,b), or hsl(h,s%,l%).`,
      }
    }

    const [r, g, b] = rgb
    const [h, s, l] = rgbToHsl(r, g, b)
    return {
      type: "color_convert",
      input: color,
      hex: toHex(r, g, b),
      rgb: { r, g, b },
      rgbCss: `rgb(${r}, ${g}, ${b})`,
      hsl: { h, s, l },
      hslCss: `hsl(${h}, ${s}%, ${l}%)`,
    }
  },
  {
    name: "color_convert",
    description: "Convert a color between hex, rgb, and hsl formats.",
    schema: z.object({ color: z.string().min(1) }),
  }
)

export const textDiffTool = tool(
  async ({
    a,
    b,
    pathA,
    pathB,
    nameA = "a",
    nameB = "b",
  }: {
    a?: string
    b?: string
    pathA?: string
    pathB?: string
    nameA?: string
    nameB?: string
  }) => {
    const textA = pathA ? await readWorkspaceText(pathA) : (a ?? "")
    const textB = pathB ? await readWorkspaceText(pathB) : (b ?? "")
    const labelA = pathA ?? nameA
    const labelB = pathB ?? nameB
    const patch = createTwoFilesPatch(labelA, labelB, textA, textB, undefined, undefined, {
      context: 3,
    })
    const lines = patch.split("\n")
    const added = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length
    const removed = lines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length
    return {
      type: "text_diff",
      nameA: labelA,
      nameB: labelB,
      patch,
      addedLines: added,
      removedLines: removed,
      identical: added === 0 && removed === 0,
    }
  },
  {
    name: "text_diff",
    description: "Compute a unified diff between two strings or two workspace file paths.",
    schema: z.object({
      a: z.string().optional(),
      b: z.string().optional(),
      pathA: z.string().optional(),
      pathB: z.string().optional(),
      nameA: z.string().optional(),
      nameB: z.string().optional(),
    }),
  }
)

export const jsonDiffTool = tool(
  async ({ a, b, pathA, pathB }: { a?: unknown; b?: unknown; pathA?: string; pathB?: string }) => {
    async function parseSource(inline?: unknown, filePath?: string): Promise<unknown> {
      if (filePath) {
        const text = await readWorkspaceText(filePath)
        return JSON.parse(text)
      }
      if (typeof inline === "string") return JSON.parse(inline)
      return inline
    }
    let objA: unknown, objB: unknown
    try {
      objA = await parseSource(a, pathA)
      objB = await parseSource(b, pathB)
    } catch (err) {
      return {
        type: "json_diff",
        error: `JSON parse error: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
    const strA = JSON.stringify(objA, null, 2)
    const strB = JSON.stringify(objB, null, 2)
    const labelA = pathA ?? "a"
    const labelB = pathB ?? "b"
    const patch = createTwoFilesPatch(labelA, labelB, strA, strB, undefined, undefined, {
      context: 3,
    })
    const lines = patch.split("\n")
    const added = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length
    const removed = lines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length
    return {
      type: "json_diff",
      nameA: labelA,
      nameB: labelB,
      patch,
      addedLines: added,
      removedLines: removed,
      identical: added === 0 && removed === 0,
    }
  },
  {
    name: "json_diff",
    description:
      "Semantic diff between two JSON values (inline or workspace file paths). Returns a unified diff of the formatted JSON.",
    schema: z.object({
      a: z.unknown().optional(),
      b: z.unknown().optional(),
      pathA: z.string().optional(),
      pathB: z.string().optional(),
    }),
  }
)
