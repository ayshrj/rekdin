import { describe, expect, it } from "vitest"

import { extractDuckDuckGoHtmlResults } from "./web-search"

const SAMPLE_RESULTS_HTML = `
  <html>
    <body>
      <div class="result">
        <h2 class="result__title">
          <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fnextjs.org%2Fblog%2Fnext%2D16">Next.js 16</a>
        </h2>
        <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fnextjs.org%2Fblog%2Fnext%2D16">
          Official release notes for Next.js 16.
        </a>
      </div>
      <div class="result">
        <h2 class="result__title">
          <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fvercel.com%2Fblog%2Fsome%2Dpost">Vercel post</a>
        </h2>
        <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fvercel.com%2Fblog%2Fsome%2Dpost">
          Supporting context from Vercel.
        </a>
      </div>
    </body>
  </html>
`

describe("extractDuckDuckGoHtmlResults", () => {
  it("extracts resolved result URLs and snippets from DuckDuckGo HTML", () => {
    const results = extractDuckDuckGoHtmlResults(SAMPLE_RESULTS_HTML, {
      maxResults: 10,
    })

    expect(results).toHaveLength(2)
    expect(results[0]).toEqual({
      title: "Next.js 16",
      url: "https://nextjs.org/blog/next-16",
      snippet: "Official release notes for Next.js 16.",
      source: "nextjs.org",
    })
  })

  it("applies include and exclude domain filters", () => {
    const onlyNext = extractDuckDuckGoHtmlResults(SAMPLE_RESULTS_HTML, {
      maxResults: 10,
      domains: ["nextjs.org"],
    })
    const withoutVercel = extractDuckDuckGoHtmlResults(SAMPLE_RESULTS_HTML, {
      maxResults: 10,
      excludeDomains: ["vercel.com"],
    })

    expect(onlyNext).toHaveLength(1)
    expect(onlyNext[0]?.source).toBe("nextjs.org")
    expect(withoutVercel).toHaveLength(1)
    expect(withoutVercel[0]?.source).toBe("nextjs.org")
  })
})
