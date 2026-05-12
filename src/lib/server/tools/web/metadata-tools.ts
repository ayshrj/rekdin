import { tool } from "@langchain/core/tools"
import { JSDOM } from "jsdom"
import { z } from "zod"

import { truncateString } from "../shared/formatting"
import { visitUrlTool } from "./web-tools"

/**
 * Fetches Open Graph and meta tag data for a URL preview.
 */
export const linkPreviewTool = tool(
  async ({ url }) => {
    const res = await fetch(url, { headers: { "User-Agent": "Rekdin/NextJS" } })
    if (!res.ok) {
      return { type: "link_preview", url, error: `Failed to fetch (${res.status})` }
    }
    const html = await res.text()
    const dom = new JSDOM(html, { url })
    const doc = dom.window.document
    const title =
      doc.querySelector("meta[property='og:title']")?.getAttribute("content") || doc.title
    const description =
      doc.querySelector("meta[property='og:description']")?.getAttribute("content") ||
      doc.querySelector("meta[name='description']")?.getAttribute("content") ||
      ""
    const image =
      doc.querySelector("meta[property='og:image']")?.getAttribute("content") ||
      doc.querySelector("meta[name='twitter:image']")?.getAttribute("content") ||
      ""
    return { type: "link_preview", url, title, description, image }
  },
  {
    name: "link_preview",
    description: "Fetch lightweight metadata (title/description/image) for a URL.",
    schema: z.object({ url: z.string().url() }),
  }
)

export const pageMetadataBatchTool = tool(
  async ({ urls }) => {
    const results = await Promise.all(
      urls.slice(0, 10).map((url) => linkPreviewTool.invoke({ url }))
    )
    return { type: "page_metadata_batch", results, omittedUrls: Math.max(urls.length - 10, 0) }
  },
  {
    name: "page_metadata_batch",
    description: "Fetch metadata for several pages.",
    schema: z.object({ urls: z.array(z.string().url()).min(1).max(25) }),
  }
)

export const citationMetadataTool = tool(
  async ({ url }) => {
    const preview = (await linkPreviewTool.invoke({ url })) as Record<string, unknown>
    const visited = (await visitUrlTool.invoke({ url })) as Record<string, unknown>
    return {
      type: "citation_metadata",
      url,
      title: preview.title ?? visited.title,
      description: preview.description,
      excerpt: visited.excerpt,
      accessedAt: new Date().toISOString(),
    }
  },
  {
    name: "citation_metadata",
    description: "Create compact citation metadata for a URL.",
    schema: z.object({ url: z.string().url() }),
  }
)

export const robotsTxtTool = tool(
  async ({ origin }) => {
    const url = new URL("/robots.txt", origin).href
    const res = await fetch(url, { headers: { "User-Agent": "Rekdin/NextJS" } })
    const text = await res.text().catch(() => "")
    return { type: "robots_txt", url, status: res.status, content: truncateString(text, 8000) }
  },
  {
    name: "robots_txt",
    description: "Fetch robots.txt for an origin.",
    schema: z.object({ origin: z.string().url() }),
  }
)

export const sitemapFetchTool = tool(
  async ({ url, maxUrls }) => {
    const res = await fetch(url, { headers: { "User-Agent": "Rekdin/NextJS" } })
    const xml = await res.text()
    const dom = new JSDOM(xml, { contentType: "text/xml" })
    const limit = Math.min(maxUrls ?? 100, 500)
    const urls = Array.from(dom.window.document.querySelectorAll("url > loc, sitemap > loc"))
      .map((node) => node.textContent?.trim())
      .filter(Boolean)
      .slice(0, limit)
    return { type: "sitemap_fetch", url, status: res.status, urls, truncated: urls.length >= limit }
  },
  {
    name: "sitemap_fetch",
    description: "Fetch and parse sitemap XML URLs.",
    schema: z.object({
      url: z.string().url(),
      maxUrls: z.number().int().min(1).max(500).optional(),
    }),
  }
)

export const rssFetchTool = tool(
  async ({ url, maxItems }) => {
    const res = await fetch(url, { headers: { "User-Agent": "Rekdin/NextJS" } })
    const xml = await res.text()
    const dom = new JSDOM(xml, { contentType: "text/xml" })
    const limit = Math.min(maxItems ?? 20, 100)
    const items = Array.from(dom.window.document.querySelectorAll("item, entry"))
      .slice(0, limit)
      .map((item) => ({
        title: item.querySelector("title")?.textContent?.trim() ?? "",
        link:
          item.querySelector("link")?.textContent?.trim() ||
          item.querySelector("link")?.getAttribute("href") ||
          "",
        date: item.querySelector("pubDate, updated, published")?.textContent?.trim() ?? "",
        summary: truncateString(
          item.querySelector("description, summary, content")?.textContent?.trim() ?? "",
          1000
        ),
      }))
    return { type: "rss_fetch", url, status: res.status, items }
  },
  {
    name: "rss_fetch",
    description: "Fetch and parse RSS/Atom feed items.",
    schema: z.object({
      url: z.string().url(),
      maxItems: z.number().int().min(1).max(100).optional(),
    }),
  }
)

/**
 * Looks up npm registry metadata and recent download counts for a package.
 */
export const npmPackageInfoTool = tool(
  async ({ name }) => {
    async function fetchJson<T = unknown>(url: string): Promise<T> {
      const res = await fetch(url, { headers: { "User-Agent": "Rekdin/NextJS" } })
      if (!res.ok) throw new Error(`Failed request (${res.status})`)
      return (await res.json()) as T
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await fetchJson<any>(`https://registry.npmjs.org/${encodeURIComponent(name)}`)
    const latest = data["dist-tags"]?.latest
    const latestInfo = latest ? data.versions?.[latest] : null
    const weekly =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await fetchJson<any>(
        `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name)}`
      )
    return {
      type: "npm_package_info",
      name,
      latest,
      license: latestInfo?.license ?? latestInfo?.licenses ?? null,
      description: latestInfo?.description ?? data.description ?? "",
      homepage: latestInfo?.homepage ?? data.homepage ?? "",
      downloadsLastWeek: weekly?.downloads ?? null,
      repository: latestInfo?.repository ?? data.repository ?? null,
    }
  },
  {
    name: "npm_package_info",
    description: "Fetch npm package metadata (version, license, downloads).",
    schema: z.object({ name: z.string().min(1) }),
  }
)

export const packageCompareTool = tool(
  async ({ names }) => {
    const packages = await Promise.all(
      names.slice(0, 8).map((name) => npmPackageInfoTool.invoke({ name }))
    )
    return { type: "package_compare", packages, omittedPackages: Math.max(names.length - 8, 0) }
  },
  {
    name: "package_compare",
    description: "Compare npm metadata for several packages.",
    schema: z.object({ names: z.array(z.string().min(1)).min(1).max(20) }),
  }
)

export const githubRepoInfoTool = tool(
  async ({ owner, repo }) => {
    async function fetchJson<T = unknown>(url: string): Promise<T> {
      const res = await fetch(url, { headers: { "User-Agent": "Rekdin/NextJS" } })
      if (!res.ok) throw new Error(`Failed request (${res.status})`)
      return (await res.json()) as T
    }
    const data = await fetchJson<Record<string, unknown>>(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
    )
    return {
      type: "github_repo_info",
      owner,
      repo,
      name: data.full_name,
      description: data.description,
      stars: data.stargazers_count,
      forks: data.forks_count,
      openIssues: data.open_issues_count,
      license: (data.license as Record<string, unknown> | null)?.spdx_id ?? null,
      updatedAt: data.updated_at,
      defaultBranch: data.default_branch,
    }
  },
  {
    name: "github_repo_info",
    description: "Fetch public GitHub repository metadata.",
    schema: z.object({ owner: z.string().min(1), repo: z.string().min(1) }),
  }
)

export const openapiInspectTool = tool(
  async ({ source }: { source: string }) => {
    let specText: string
    if (source.startsWith("http://") || source.startsWith("https://")) {
      const res = await fetch(source, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) return { type: "openapi_inspect", error: `Fetch failed: ${res.status}` }
      specText = await res.text()
    } else {
      const { readWorkspaceText } = await import("../workspace/workspace-fs")
      specText = await readWorkspaceText(source)
    }

    let spec: Record<string, unknown>
    try {
      spec =
        source.endsWith(".yaml") ||
        source.endsWith(".yml") ||
        specText.trimStart().startsWith("openapi:")
          ? (await import("yaml")).parse(specText)
          : JSON.parse(specText)
    } catch (err) {
      return {
        type: "openapi_inspect",
        error: `Parse error: ${err instanceof Error ? err.message : String(err)}`,
      }
    }

    const version = (spec.openapi ?? spec.swagger ?? "unknown") as string
    const info = (spec.info ?? {}) as Record<string, unknown>
    const paths = (spec.paths ?? {}) as Record<string, Record<string, unknown>>
    const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options", "trace"]

    const endpoints: Array<{
      method: string
      path: string
      summary?: string
      tags: string[]
      operationId?: string
    }> = []
    for (const [p, methods] of Object.entries(paths)) {
      for (const method of HTTP_METHODS) {
        const op = methods[method] as Record<string, unknown> | undefined
        if (!op) continue
        endpoints.push({
          method: method.toUpperCase(),
          path: p,
          summary: op.summary as string | undefined,
          tags: Array.isArray(op.tags) ? (op.tags as string[]) : [],
          operationId: op.operationId as string | undefined,
        })
      }
    }

    const byTag: Record<string, typeof endpoints> = {}
    for (const ep of endpoints) {
      const tag = ep.tags[0] ?? "default"
      if (!byTag[tag]) byTag[tag] = []
      byTag[tag].push(ep)
    }

    return {
      type: "openapi_inspect",
      source,
      version,
      title: info.title as string | undefined,
      description: info.description ? truncateString(String(info.description), 500) : undefined,
      apiVersion: info.version as string | undefined,
      totalEndpoints: endpoints.length,
      byTag,
    }
  },
  {
    name: "openapi_inspect",
    description:
      "Parse an OpenAPI 3.x or Swagger 2.x spec (file path or URL) and list endpoints grouped by tag.",
    schema: z.object({ source: z.string().min(1) }),
  }
)

const GRAPHQL_INTROSPECTION_QUERY = `
query IntrospectionQuery {
  __schema {
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types {
      kind name description
      fields(includeDeprecated: false) { name description type { kind name ofType { kind name } } }
    }
  }
}`

export const graphqlIntrospectTool = tool(
  async ({
    endpoint,
    headers: extraHeaders = {},
  }: {
    endpoint: string
    headers?: Record<string, string>
  }) => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...extraHeaders },
      body: JSON.stringify({ query: GRAPHQL_INTROSPECTION_QUERY }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      return { type: "graphql_introspect", endpoint, error: `Request failed: ${res.status}` }
    }
    const json = (await res.json()) as Record<string, unknown>
    if ((json as Record<string, unknown>).errors) {
      return {
        type: "graphql_introspect",
        endpoint,
        error: "GraphQL errors in introspection response",
        errors: (json as Record<string, unknown>).errors,
      }
    }
    const schema = ((json as Record<string, unknown>).data as Record<string, unknown>)
      ?.__schema as Record<string, unknown>
    const types = (Array.isArray(schema?.types) ? schema.types : []) as Array<
      Record<string, unknown>
    >
    const userTypes = types.filter(
      (t) => !String(t.name ?? "").startsWith("__") && t.kind !== "SCALAR" && t.kind !== "ENUM"
    )
    const queryTypeName = (schema?.queryType as Record<string, string> | undefined)?.name
    const mutationTypeName = (schema?.mutationType as Record<string, string> | undefined)?.name
    const queryType = types.find((t) => t.name === queryTypeName)
    const mutationType = types.find((t) => t.name === mutationTypeName)
    return {
      type: "graphql_introspect",
      endpoint,
      queryType: queryTypeName,
      mutationType: mutationTypeName,
      queryFields: Array.isArray(queryType?.fields)
        ? (queryType.fields as Array<Record<string, unknown>>).map((f) => String(f.name))
        : [],
      mutationFields: Array.isArray(mutationType?.fields)
        ? (mutationType.fields as Array<Record<string, unknown>>).map((f) => String(f.name))
        : [],
      typeCount: userTypes.length,
      types: userTypes.slice(0, 60).map((t) => ({
        kind: t.kind,
        name: t.name,
        fieldCount: Array.isArray(t.fields) ? t.fields.length : 0,
      })),
    }
  },
  {
    name: "graphql_introspect",
    description:
      "Run the GraphQL introspection query against an endpoint and return types, queries, and mutations.",
    schema: z.object({
      endpoint: z.string().url(),
      headers: z.record(z.string(), z.string()).optional(),
    }),
  }
)
