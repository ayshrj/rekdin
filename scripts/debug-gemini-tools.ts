import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import fs from "fs"

import { createToolset } from "../src/lib/server/tools"

function readEnvValue(name: string) {
  const envText = fs.readFileSync(".env", "utf8")
  return envText.match(new RegExp(`^${name}=(.+)$`, "m"))?.[1]?.trim() ?? ""
}

const geminiApiKey = readEnvValue("GEMINI_API_KEY")
const model = "gemini-2.0-flash-lite"

if (!geminiApiKey) {
  throw new Error("Missing GEMINI_API_KEY in .env")
}

async function testWithTools(toolNames?: string[]) {
  const tools = toolNames === undefined ? [] : createToolset({ allowedToolNames: toolNames })
  const llm = new ChatGoogleGenerativeAI({
    apiKey: geminiApiKey,
    model,
    temperature: 0.2,
  })

  const runnable = tools.length > 0 ? llm.bindTools(tools) : llm
  const response = await runnable.invoke("Reply with the single word hello. Do not call any tools.")

  return {
    toolCount: tools.length,
    toolNames: tools.map((tool) => tool.name),
    content:
      typeof response.content === "string" ? response.content : JSON.stringify(response.content),
  }
}

async function main() {
  const results: Record<string, unknown> = {}

  results.noTools = await testWithTools()

  const allTools = createToolset()
  try {
    results.fullToolset = await testWithTools(allTools.map((tool) => tool.name))
  } catch (error) {
    results.fullToolsetError = error instanceof Error ? error.message : String(error)
  }

  const failures: Array<{ name: string; error: string }> = []
  for (const tool of allTools) {
    try {
      await testWithTools([tool.name])
    } catch (error) {
      failures.push({
        name: tool.name,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  results.individualFailures = failures
  console.log(JSON.stringify(results, null, 2))
}

void main()
