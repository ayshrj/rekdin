import { apiRouteMapTool } from "../api/api-contract-tools"
import {
  appRouteFromSegment,
  codeFiles,
  linesOf,
  readBounded,
  UI_EXTENSIONS,
} from "../shared/code-utils"
import { boundedLimit } from "../shared/formatting"
import {
  emptySchema,
  type Finding,
  finding,
  pathLimitSchema,
  toolDefinition,
} from "../shared/tool-base"
import { collectWorkspaceFiles, readWorkspaceText } from "../workspace/workspace-fs"

export const nextRouteSegmentMapTool = toolDefinition(
  "next_route_segment_map",
  "Map Next.js App Router segments including layouts, pages, handlers, loading/error/template files.",
  emptySchema,
  async () => {
    const { files } = await codeFiles("src/app", 2000)
    return {
      type: "next_route_segment_map",
      routes: files
        .map((file) => ({ file: file.path, ...appRouteFromSegment(file.path) }))
        .filter((item) => item.route),
    }
  }
)

export const serverClientBoundaryMapTool = toolDefinition(
  "server_client_boundary_map",
  "Map server/client components and likely illegal imports.",
  emptySchema,
  async () => {
    const { files } = await codeFiles("src", 2000)
    const components = []
    const findings = []
    for (const file of files.filter((item) => /\.(tsx|jsx)$/.test(item.path))) {
      const content = await readBounded(file)
      const client = content.startsWith('"use client"') || content.startsWith("'use client'")
      components.push({ file: file.path, boundary: client ? "client" : "server" })
      if (client && /@\/lib\/server|fs|child_process/.test(content))
        findings.push(
          finding("error", file.path, undefined, "Client component imports server-only code.")
        )
    }
    return { type: "server_client_boundary_map", components, findings }
  }
)

export const nextMetadataAuditTool = toolDefinition(
  "next_metadata_audit",
  "Check metadata exports, title, description, OpenGraph, and robots files.",
  emptySchema,
  async () => {
    const { files } = await codeFiles("src/app", 2000)
    const findings = []
    const pages = files.filter((file) => /\/page\.[tj]sx?$/.test(file.path))
    for (const file of pages) {
      const content = await readBounded(file)
      if (!/metadata|generateMetadata/.test(content))
        findings.push(finding("info", file.path, undefined, "Page has no local metadata export."))
    }
    return { type: "next_metadata_audit", findings: findings.slice(0, 200) }
  }
)

export const nextImageAuditTool = toolDefinition(
  "next_image_audit",
  "Find raw img usage where next/image may be better and flag missing dimensions.",
  pathLimitSchema,
  async ({ limit }) => {
    const { files } = await collectWorkspaceFiles({
      extensions: UI_EXTENSIONS,
      maxFiles: boundedLimit(limit, 1000, 3000),
    })
    const findings: Finding[] = []
    for (const file of files) {
      const content = await readBounded(file)
      linesOf(content).forEach((line, index) => {
        if (/<img\b/.test(line))
          findings.push(
            finding(
              "warning",
              file.path,
              index + 1,
              "Raw <img> usage detected; consider next/image when appropriate."
            )
          )
      })
    }
    return { type: "next_image_audit", findings }
  }
)

export const nextApiRuntimeAuditTool = toolDefinition(
  "next_api_runtime_audit",
  "Check route handlers for runtime, dynamic usage, body parsing, streaming, and cache headers.",
  emptySchema,
  async () => {
    const routes = (await apiRouteMapTool.invoke({})) as { routes?: Array<Record<string, unknown>> }
    const findings: Finding[] = []
    for (const route of routes.routes ?? []) {
      const file = String(route.file)
      const content = await readWorkspaceText(file).catch(() => "")
      if (!/runtime\s*=/.test(content))
        findings.push(
          finding("info", file, undefined, "Route does not declare nodejs/edge runtime.")
        )
      if (/await\s+req\.json\(\)/.test(content) && !/safeParse|z\./.test(content))
        findings.push(
          finding(
            "warning",
            file,
            undefined,
            "Route parses JSON body without visible Zod validation."
          )
        )
    }
    return { type: "next_api_runtime_audit", findings }
  }
)
