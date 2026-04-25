import { JSDOM } from "jsdom"

export type WebSearchResult = {
  title: string
  url: string
  snippet: string
  source: string
}

type SearchOptions = {
  maxResults: number
  domains?: string[]
  excludeDomains?: string[]
}

function normalizeDuckDuckGoHref(rawHref: string) {
  const trimmed = rawHref.trim()
  if (!trimmed) return null

  try {
    const absolute = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed
    const parsed = new URL(absolute, "https://duckduckgo.com")
    const redirect = parsed.searchParams.get("uddg")
    if (redirect) {
      return redirect
    }
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString()
    }
  } catch {
    return null
  }

  return null
}

function allowDomain(candidate: string, domains?: string[], excludeDomains?: string[]) {
  const normalized = candidate.toLowerCase()
  if (domains && domains.length > 0) {
    const allowed = domains.some((domain) => normalized.includes(domain.toLowerCase()))
    if (!allowed) return false
  }
  if (excludeDomains && excludeDomains.length > 0) {
    const blocked = excludeDomains.some((domain) => normalized.includes(domain.toLowerCase()))
    if (blocked) return false
  }
  return true
}

export function extractDuckDuckGoHtmlResults(
  html: string,
  { maxResults, domains, excludeDomains }: SearchOptions
): WebSearchResult[] {
  const dom = new JSDOM(html)
  const doc = dom.window.document
  const results: WebSearchResult[] = []
  const seen = new Set<string>()

  for (const node of doc.querySelectorAll(".result")) {
    const link = node.querySelector<HTMLAnchorElement>("a.result__a")
    if (!link) continue

    const resolvedUrl = normalizeDuckDuckGoHref(link.getAttribute("href") ?? "")
    if (!resolvedUrl || seen.has(resolvedUrl)) continue

    let host = ""
    try {
      host = new URL(resolvedUrl).hostname
    } catch {
      continue
    }
    if (!allowDomain(host, domains, excludeDomains)) continue

    const title = link.textContent?.replace(/\s+/g, " ").trim() ?? ""
    const snippet =
      node.querySelector(".result__snippet")?.textContent?.replace(/\s+/g, " ").trim() ?? ""

    if (!title) continue

    seen.add(resolvedUrl)
    results.push({
      title,
      url: resolvedUrl,
      snippet,
      source: host,
    })

    if (results.length >= maxResults) break
  }

  return results
}

export async function searchPublicWeb(
  query: string,
  { maxResults, domains, excludeDomains }: SearchOptions
) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Rekdin/NextJS",
      Accept: "text/html,application/xhtml+xml",
    },
  })

  if (!response.ok) {
    throw new Error(`Search request failed (${response.status})`)
  }

  const html = await response.text()
  const results = extractDuckDuckGoHtmlResults(html, {
    maxResults,
    domains,
    excludeDomains,
  })

  return {
    query,
    results,
    totalResults: results.length,
    domains: domains ?? [],
    excludeDomains: excludeDomains ?? [],
    type: "web_search",
  }
}
