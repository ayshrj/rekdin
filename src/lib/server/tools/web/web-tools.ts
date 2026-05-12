import { tool } from "@langchain/core/tools"
import { Readability } from "@mozilla/readability"
import { createPatch } from "diff"
import { JSDOM } from "jsdom"
import TurndownService from "turndown"
import { z } from "zod"

import { searchPublicWeb } from "../../web-search"
import { truncateString } from "../shared/formatting"

const turndown = new TurndownService({ headingStyle: "atx" })

/**
 * Searches the public web for current information and source candidates.
 */
export const webSearchTool = tool(
  async ({ query, maxResults, domains, excludeDomains }) => {
    return await searchPublicWeb(query, {
      maxResults,
      domains,
      excludeDomains,
    })
  },
  {
    name: "web_search",
    description: "Search the public web for answers and recent information.",
    schema: z.object({
      query: z.string(),
      maxResults: z.number().int().min(1).max(25).default(10),
      domains: z.array(z.string()).optional(),
      excludeDomains: z.array(z.string()).optional(),
    }),
  }
)

/**
 * Fetches a web page and converts its readable article content into Markdown.
 */
export const visitUrlTool = tool(
  async ({ url }) => {
    const response = await fetch(url, { headers: { "User-Agent": "Rekdin/NextJS" } })
    if (!response.ok) return { url, error: `Failed to fetch (${response.status})` }
    const html = await response.text()
    const dom = new JSDOM(html, { url })
    const reader = new Readability(dom.window.document)
    const article = reader.parse()
    const markdown = article?.content ? turndown.turndown(article.content) : turndown.turndown(html)
    return {
      url,
      title: article?.title ?? dom.window.document.title ?? "Untitled",
      excerpt: article?.excerpt ?? "",
      markdown,
      type: "visit_link",
    }
  },
  {
    name: "visit_link",
    description: "Fetch and summarize the readable content from a web page.",
    schema: z.object({ url: z.string().url() }),
  }
)

export const searchBatchTool = tool(
  async ({ queries, maxResults }) => {
    const results = await Promise.all(
      queries.slice(0, 8).map(async (query) => ({
        query,
        results: await searchPublicWeb(query, { maxResults: Math.min(maxResults ?? 5, 10) }),
      }))
    )
    return { type: "search_batch", results, omittedQueries: Math.max(queries.length - 8, 0) }
  },
  {
    name: "search_batch",
    description: "Run several public web searches at once.",
    schema: z.object({
      queries: z.array(z.string().min(1)).min(1).max(20),
      maxResults: z.number().int().min(1).max(10).optional(),
    }),
  }
)

export const pageDiffSnapshotTool = tool(
  async ({ beforeUrl, afterUrl }) => {
    const before = (await visitUrlTool.invoke({ url: beforeUrl })) as {
      markdown?: string
      title?: string
    }
    const after = (await visitUrlTool.invoke({ url: afterUrl })) as {
      markdown?: string
      title?: string
    }
    return {
      type: "page_diff_snapshot",
      beforeUrl,
      afterUrl,
      beforeTitle: before.title,
      afterTitle: after.title,
      diff: truncateString(
        createPatch("page.md", before.markdown ?? "", after.markdown ?? "", "before", "after"),
        16000
      ),
    }
  },
  {
    name: "page_diff_snapshot",
    description: "Fetch two pages and return a markdown diff.",
    schema: z.object({ beforeUrl: z.string().url(), afterUrl: z.string().url() }),
  }
)
