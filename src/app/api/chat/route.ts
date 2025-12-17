import { ChatOpenAI } from "@langchain/openai"
import { tool } from "@langchain/core/tools"
import { z } from "zod"
import { NextResponse } from "next/server"
import { OPENROUTER_API_KEY, OPENROUTER_MODEL } from "@/configs"

export const runtime = "nodejs"

const requestSchema = z.object({
  message: z.string().min(1).max(10_000),
})

type ChatAction =
  | { type: "show_toast"; variant: "info" | "success" | "warning" | "error"; message?: string }
  | { type: "update_weather_widget"; city: string; weather: string }

type ChatResponse = {
  reply: string
  action: ChatAction | null
  decision: { type: "calculation" | "weather" | "general"; params?: Record<string, unknown> }
}

function extractFirstJsonObject(text: string): string | null {
  const cleaned = text.replace(/```(?:json)?/g, "").trim()
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) return null
  return cleaned.slice(start, end + 1)
}

type Operator = "+" | "-" | "*" | "/" | "u-"
type Token =
  | { type: "number"; value: number }
  | { type: "op"; value: Operator }
  | { type: "paren"; value: "(" | ")" }

function tokenizeExpression(expression: string): Token[] {
  const tokens: Token[] = []
  const src = expression.trim()
  let i = 0

  while (i < src.length) {
    const ch = src[i]
    if (ch === " " || ch === "\t" || ch === "\n") {
      i += 1
      continue
    }

    if (ch === "(" || ch === ")") {
      tokens.push({ type: "paren", value: ch })
      i += 1
      continue
    }

    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      tokens.push({ type: "op", value: ch })
      i += 1
      continue
    }

    if ((ch >= "0" && ch <= "9") || ch === ".") {
      let j = i + 1
      while (j < src.length) {
        const c = src[j]
        if ((c >= "0" && c <= "9") || c === ".") j += 1
        else break
      }
      const raw = src.slice(i, j)
      const value = Number(raw)
      if (!Number.isFinite(value)) throw new Error("Invalid number")
      tokens.push({ type: "number", value })
      i = j
      continue
    }

    throw new Error("Unsupported character")
  }

  return tokens
}

function toRpn(tokens: Token[]): Token[] {
  const output: Token[] = []
  const ops: Token[] = []

  const precedence: Record<Operator, number> = { "u-": 3, "*": 2, "/": 2, "+": 1, "-": 1 }
  const rightAssociative = new Set<Operator>(["u-"])

  let prev: Token | null = null
  for (const token of tokens) {
    if (token.type === "number") {
      output.push(token)
      prev = token
      continue
    }

    if (token.type === "paren") {
      if (token.value === "(") {
        ops.push(token)
        prev = token
        continue
      }

      while (ops.length > 0) {
        const top = ops[ops.length - 1]!
        if (top.type === "paren" && top.value === "(") break
        output.push(ops.pop()!)
      }
      const popped = ops.pop()
      if (!popped || popped.type !== "paren" || popped.value !== "(") {
        throw new Error("Mismatched parentheses")
      }
      prev = token
      continue
    }

    if (token.type === "op") {
      const isUnary: boolean =
        token.value === "-" &&
        (prev === null ||
          (prev.type === "op" && prev.value !== "u-") ||
          (prev.type === "paren" && prev.value === "("))
      const op: Operator = isUnary ? "u-" : token.value

      while (ops.length > 0) {
        const top = ops[ops.length - 1]!
        if (top.type !== "op") break
        const topOp = top.value
        const shouldPop = rightAssociative.has(op)
          ? precedence[op] < precedence[topOp]
          : precedence[op] <= precedence[topOp]
        if (!shouldPop) break
        output.push(ops.pop()!)
      }
      ops.push({ type: "op", value: op })
      prev = { type: "op", value: op }
      continue
    }
  }

  while (ops.length > 0) {
    const top = ops.pop()!
    if (top.type === "paren") throw new Error("Mismatched parentheses")
    output.push(top)
  }

  return output
}

function evaluateRpn(tokens: Token[]): number {
  const stack: number[] = []

  for (const token of tokens) {
    if (token.type === "number") {
      stack.push(token.value)
      continue
    }
    if (token.type !== "op") throw new Error("Invalid token")

    if (token.value === "u-") {
      const a = stack.pop()
      if (a === undefined) throw new Error("Invalid expression")
      stack.push(-a)
      continue
    }

    const b = stack.pop()
    const a = stack.pop()
    if (a === undefined || b === undefined) throw new Error("Invalid expression")
    switch (token.value) {
      case "+":
        stack.push(a + b)
        break
      case "-":
        stack.push(a - b)
        break
      case "*":
        stack.push(a * b)
        break
      case "/":
        stack.push(a / b)
        break
    }
  }

  if (stack.length !== 1) throw new Error("Invalid expression")
  return stack[0]!
}

function safeEvaluateMath(expression: string): number {
  const tokens = tokenizeExpression(expression)
  const rpn = toRpn(tokens)
  const result = evaluateRpn(rpn)
  if (!Number.isFinite(result)) throw new Error("Non-finite result")
  return result
}

function requireOpenRouterConfig() {
  if (!OPENROUTER_API_KEY) throw new Error("Missing OPENROUTER_API_KEY")
  if (!OPENROUTER_MODEL) throw new Error("Missing OPENROUTER_MODEL")
}

const calculatorTool = tool(
  async ({ expression }: { expression: string }) => {
    try {
      const result = safeEvaluateMath(expression)
      return `The result is ${result}`
    } catch {
      return "I couldn't calculate that. Please check the syntax (numbers, + - * / and parentheses)."
    }
  },
  {
    name: "calculator",
    description: "Perform mathematical calculations like '2 + 2' or '5 * 10'.",
    schema: z.object({
      expression: z.string().describe("The math expression to evaluate"),
    }),
  }
)

const weatherTool = tool(
  async ({ city }: { city: string }) => {
    const mockDb: Record<string, string> = {
      london: "Rainy, 15°C",
      "new york": "Sunny, 22°C",
      tokyo: "Cloudy, 25°C",
      delhi: "Haze, 30°C",
    }
    const weather = mockDb[city.toLowerCase()] || "Clear, 20°C"
    return `The current weather in ${city} is ${weather}.`
  },
  {
    name: "get_weather",
    description: "Get the current weather for a specific city.",
    schema: z.object({
      city: z.string().describe("The city name, e.g., London, New York"),
    }),
  }
)

async function createLlm(headers: Headers) {
  requireOpenRouterConfig()
  const origin = headers.get("origin") || "http://localhost:3000"
  const title = headers.get("x-app-title") || "LangChain Next.js Demo"

  return new ChatOpenAI({
    model: OPENROUTER_MODEL,
    apiKey: OPENROUTER_API_KEY,
    temperature: 0,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": origin,
        "X-Title": title,
      },
    },
  })
}

async function routeDecision(llm: ChatOpenAI, question: string) {
  const prompt = `
You are a routing assistant. Classify the user's intent into JSON.

User Question: "${question}"

Return ONLY a JSON object with these fields:
- type: "calculation" | "weather" | "general"
- params: object with "expression" (for calc) or "city" (for weather)
`.trim()

  const response = await llm.invoke(prompt)
  const raw = typeof response.content === "string" ? response.content : String(response.content)
  const json = extractFirstJsonObject(raw)
  if (!json) return { type: "general" as const }

  const parsed = z
    .object({
      type: z.enum(["calculation", "weather", "general"]),
      params: z.record(z.string(), z.unknown()).optional(),
    })
    .safeParse(JSON.parse(json))

  if (!parsed.success) return { type: "general" as const }
  return parsed.data
}

async function chat(headers: Headers, userMessage: string): Promise<ChatResponse> {
  const llm = await createLlm(headers)

  const decision = await routeDecision(llm, userMessage)

  const params = (decision.params ?? {}) as Record<string, unknown>
  const getStringParam = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : ""

  switch (decision.type) {
    case "calculation": {
      const expression = getStringParam("expression")
      const reply = await calculatorTool.invoke({ expression })
      return {
        reply,
        action: { type: "show_toast", variant: "info", message: "Calculated result" },
        decision,
      }
    }

    case "weather": {
      const city = getStringParam("city")
      const reply = await weatherTool.invoke({ city })
      const weather = reply.match(/is (.*)\.$/)?.[1] ?? ""
      return {
        reply,
        action: { type: "update_weather_widget", city, weather },
        decision,
      }
    }

    case "general":
    default: {
      const aiMsg = await llm.invoke(userMessage)
      const reply = typeof aiMsg.content === "string" ? aiMsg.content : String(aiMsg.content)
      return { reply, action: null, decision }
    }
  }
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request: expected { message: string }" },
      { status: 400 }
    )
  }

  try {
    const result = await chat(req.headers, parsed.data.message)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
