export interface ParsedLLMError {
  code: number | null
  title: string
  detail: string
  action: string | null
}

const ERROR_MAP: Record<number, { title: string; action: string }> = {
  400: {
    title: "Bad request",
    action: "Check your message for unsupported content, or reduce its length.",
  },
  401: {
    title: "Invalid API key",
    action: "Update your API key in Settings.",
  },
  402: {
    title: "Insufficient credits",
    action: "Add credits at openrouter.ai/settings/credits, or switch to a free model in Settings.",
  },
  403: {
    title: "Access denied",
    action: "Your account may not have access to this model. Try a different one in Settings.",
  },
  404: {
    title: "Model not found",
    action: "This model may be deprecated or renamed. Switch to another model in Settings.",
  },
  408: {
    title: "Request timed out",
    action: "Try again, or shorten your prompt.",
  },
  429: {
    title: "Rate limited",
    action: "Too many requests. Wait a moment, then retry.",
  },
  500: {
    title: "Provider error",
    action: "The model provider had an internal error. Try again.",
  },
  502: {
    title: "Bad gateway",
    action: "The model provider is unreachable. Try again shortly.",
  },
  503: {
    title: "Service unavailable",
    action: "The model provider is overloaded. Try again shortly.",
  },
}

export function parseLLMError(raw: string): ParsedLLMError {
  // Errors from OpenRouter / LangChain look like "NNN <message>"
  const codeMatch = raw.match(/^(\d{3})\s+/)
  const code = codeMatch ? parseInt(codeMatch[1], 10) : null

  // Strip the leading code, troubleshooting URLs and credit top-up links
  const stripped = raw
    .replace(/^\d{3}\s+/, "")
    .replace(/\n\nTroubleshooting URL:[\s\S]*$/, "")
    .replace(/\. To (increase|continue)[^.]*visit https?:\/\/\S+[^.]*/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .trim()

  // First sentence only for the detail (avoid walls of text)
  const firstSentence = stripped.split(/\.\s/)[0]?.trim() ?? stripped
  const detail = firstSentence.endsWith(".") ? firstSentence : `${firstSentence}.`

  const known = code !== null ? ERROR_MAP[code] : null

  return {
    code,
    title: known?.title ?? (code !== null ? `Error ${code}` : "Request failed"),
    detail,
    action: known?.action ?? null,
  }
}
