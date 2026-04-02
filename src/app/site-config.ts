export const siteConfig = {
  name: "Rekdin",
  shortName: "REKDIN",
  title: "Rekdin | AI Research and Automation Workspace",
  description:
    "Rekdin is an AI research and automation workspace for running web research, browser actions, file workflows, structured tool calls, and live execution traces in one interface.",
  keywords: [
    "AI research workspace",
    "AI automation",
    "LangChain",
    "OpenRouter",
    "OpenAI",
    "browser automation",
    "workflow automation",
    "tool calling",
    "agent workspace",
    "research assistant",
  ],
} as const

export function getSiteUrl() {
  const candidate = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000"

  try {
    return new URL(candidate)
  } catch {
    return new URL("http://localhost:3000")
  }
}
