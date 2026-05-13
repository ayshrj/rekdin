import { z } from "zod"

import { codeFiles, importedSpecifiers, readBounded, routeFromFile } from "../shared/code-utils"
import { safeShellArg } from "../shared/command"
import { boundedLimit, previewString } from "../shared/formatting"
import {
  emptySchema,
  type Finding,
  finding,
  pathLimitSchema,
  toolDefinition,
} from "../shared/tool-base"

export const apiContractMapTool = toolDefinition(
  "api_contract_map",
  "Map frontend API calls to Next.js backend route files and inferred payload snippets.",
  pathLimitSchema,
  async ({ path: pathName, limit }) => {
    const { files } = await codeFiles(pathName, boundedLimit(limit, 800, 2000))
    const routeFiles = new Map<string, string>()
    const calls = []
    for (const file of files) {
      const route = routeFromFile(file.path)
      if (route) routeFiles.set(route, file.path)
      const content = await readBounded(file)
      for (const match of content.matchAll(
        /fetch\(\s*["'`]([^"'`]+)["'`]\s*(?:,\s*({[\s\S]{0,700}?}))?/g
      )) {
        const endpoint = match[1]
        calls.push({
          endpoint,
          method: match[2]?.match(/method\s*:\s*["'`]([A-Z]+)["'`]/)?.[1] ?? "GET",
          calledFrom: [file.path],
          requestShape: previewString(match[2] ?? "", 250),
          backendHandler: routeFiles.get(endpoint),
        })
      }
    }
    return { type: "api_contract_map", endpoints: calls.slice(0, 200) }
  }
)

export const apiContractDiffTool = toolDefinition(
  "api_contract_diff",
  "Compare inferred frontend API expectations with backend route return snippets.",
  z.object({ endpoint: z.string().optional(), limit: z.number().int().optional() }),
  async ({ endpoint, limit }) => {
    const map = (await apiContractMapTool.invoke({ limit: boundedLimit(limit, 500, 2000) })) as {
      endpoints?: Array<Record<string, unknown>>
    }
    const endpoints = (map.endpoints ?? []).filter(
      (item) => !endpoint || item.endpoint === endpoint
    )
    const findings = endpoints
      .filter((item) => !item.backendHandler && String(item.endpoint).startsWith("/api/"))
      .map((item) =>
        finding(
          "warning",
          String(item.calledFrom ?? ""),
          undefined,
          `No backend handler matched ${item.endpoint}`
        )
      )
    return { type: "api_contract_diff", endpoint, findings, endpoints: endpoints.slice(0, 100) }
  }
)

export const apiRouteMapTool = toolDefinition(
  "api_route_map",
  "Map all Next.js API route handlers with methods and imports.",
  emptySchema,
  async () => {
    const { files } = await codeFiles("src/app", 1000)
    const routes = []
    for (const file of files.filter((item) => /\/route\.[tj]s$/.test(item.path))) {
      const content = await readBounded(file)
      routes.push({
        route: routeFromFile(file.path),
        file: file.path,
        methods: Array.from(
          content.matchAll(
            /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g
          )
        ).map((match) => match[1]),
        imports: importedSpecifiers(content),
      })
    }
    return { type: "api_route_map", routes }
  }
)

export const apiPayloadInferTool = toolDefinition(
  "api_payload_infer",
  "Infer request and response shape hints from frontend fetch calls and backend route handlers.",
  z.object({ endpoint: z.string().optional(), limit: z.number().int().optional() }),
  async ({ endpoint, limit }) => {
    const map = (await apiContractMapTool.invoke({ limit: boundedLimit(limit, 500, 2000) })) as {
      endpoints?: Array<Record<string, unknown>>
    }
    return {
      type: "api_payload_infer",
      endpoint,
      contracts: (map.endpoints ?? [])
        .filter((item) => !endpoint || item.endpoint === endpoint)
        .map((item) => ({
          ...item,
          responseShape: item.backendHandler
            ? "Inspect backend route for NextResponse.json(...) shape"
            : undefined,
        }))
        .slice(0, 100),
    }
  }
)

export const postmanCollectionGenerateTool = toolDefinition(
  "postman_collection_generate",
  "Generate a Postman collection JSON draft from Next.js API routes.",
  emptySchema,
  async () => {
    const routes = (await apiRouteMapTool.invoke({})) as { routes?: Array<Record<string, unknown>> }
    return {
      type: "postman_collection_generate",
      collection: {
        info: {
          name: "Rekdin API",
          schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        },
        item: (routes.routes ?? []).flatMap((route) =>
          (Array.isArray(route.methods) ? route.methods : ["GET"]).map((method) => ({
            name: `${method} ${route.route}`,
            request: {
              method,
              url: {
                raw: `{{baseUrl}}${route.route}`,
                host: ["{{baseUrl}}"],
                path: String(route.route).split("/").filter(Boolean),
              },
            },
          }))
        ),
      },
    }
  }
)

export const curlFromApiCallTool = toolDefinition(
  "curl_from_api_call",
  "Generate an equivalent curl command for an API endpoint or frontend fetch call.",
  z.object({
    endpoint: z.string().min(1),
    method: z.string().optional(),
    body: z.unknown().optional(),
  }),
  async ({ endpoint, method, body }) => {
    const bodyText = body == null ? "" : ` --data-raw ${safeShellArg(JSON.stringify(body))}`
    return {
      type: "curl_from_api_call",
      command: `curl -X ${method ?? "GET"} ${safeShellArg(endpoint)} -H 'Content-Type: application/json'${bodyText}`,
    }
  }
)

export const apiErrorTaxonomyTool = toolDefinition(
  "api_error_taxonomy",
  "Analyze API route error handling and categorize validation/auth/unknown error paths.",
  pathLimitSchema,
  async ({ path: pathName, limit }) => {
    const { files } = await codeFiles(pathName ?? "src/app", boundedLimit(limit, 500, 1500))
    const findings: Finding[] = []
    for (const file of files.filter((item) => /\/route\.[tj]s$/.test(item.path))) {
      const content = await readBounded(file)
      if (!/try\s*{/.test(content))
        findings.push(
          finding("warning", file.path, undefined, "Route has no visible try/catch error boundary")
        )
      if (
        /catch\s*\([^)]*\)\s*{[\s\S]{0,500}status:\s*500/.test(content) &&
        !/Zod|safeParse|validation/i.test(content)
      ) {
        findings.push(
          finding(
            "info",
            file.path,
            undefined,
            "500 path exists, but validation taxonomy is unclear"
          )
        )
      }
      if (!/status\s*:\s*(400|401|403|404|500)/.test(content))
        findings.push(
          finding("warning", file.path, undefined, "No explicit HTTP error status detected")
        )
    }
    return { type: "api_error_taxonomy", findings: findings.slice(0, 200) }
  }
)
