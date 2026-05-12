import keywordExtractor from "keyword-extractor"

const MAX_TITLE_CHARS = 60
const CODE_BLOCK_RE = /```[\s\S]*?```/g
const URL_RE = /https?:\/\/\S+/gi

const LOW_SIGNAL_WORDS = new Set([
  "please",
  "help",
  "need",
  "want",
  "make",
  "create",
  "build",
  "add",
  "fix",
  "update",
  "change",
  "can",
  "could",
  "would",
  "should",
  "thing",
  "stuff",
  "file",
  "code",
])

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (/^[A-Z0-9_./-]{2,}$/.test(word)) return word
      return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`
    })
    .join(" ")
}

function cleanPrompt(prompt: string) {
  return prompt
    .replace(CODE_BLOCK_RE, " ")
    .replace(URL_RE, " ")
    .replace(/[`*_#[\]()>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function trimTitle(value: string) {
  const normalized = value
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/[.。！？!?,;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
  if (normalized.length <= MAX_TITLE_CHARS) return normalized
  const sliced = normalized.slice(0, MAX_TITLE_CHARS)
  return sliced.replace(/\s+\S*$/, "").trim() || normalized.slice(0, MAX_TITLE_CHARS).trim()
}

export function generateLocalTitle(prompt: string) {
  const cleaned = cleanPrompt(prompt)
  if (!cleaned) return "New Conversation"

  const keywords = keywordExtractor
    .extract(cleaned, {
      language: "english",
      remove_digits: false,
      remove_duplicates: true,
      return_changed_case: false,
    })
    .map((keyword) => keyword.replace(/[^\w./-]+/g, " ").trim())
    .filter((keyword) => keyword.length > 1 && !LOW_SIGNAL_WORDS.has(keyword.toLowerCase()))

  const keywordTitle = trimTitle(titleCase(keywords.slice(0, 6).join(" ")))
  if (keywordTitle.split(/\s+/).filter(Boolean).length >= 2) return keywordTitle

  const firstSentence = cleaned.split(/[.?!]\s/)[0] ?? cleaned
  return trimTitle(firstSentence) || "New Conversation"
}
