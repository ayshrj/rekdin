import { z } from "zod"

import {
  codeFiles,
  linesOf,
  readBounded,
  UI_EXTENSIONS,
  type WorkspaceFile,
} from "../shared/code-utils"
import { boundedLimit } from "../shared/formatting"
import {
  emptySchema,
  type Finding,
  finding,
  pathLimitSchema,
  toolDefinition,
} from "../shared/tool-base"
import { collectWorkspaceFiles, readPackageJson } from "../workspace/workspace-fs"

export const bundleAnalyzeSummaryTool = toolDefinition(
  "bundle_analyze_summary",
  "Summarize Next.js build output artifacts when available.",
  emptySchema,
  async () => {
    const { files } = await collectWorkspaceFiles({
      path: ".next",
      maxFiles: 1000,
      includeHidden: true,
    }).catch(() => ({ files: [] as WorkspaceFile[] }))
    const chunks = files
      .filter((file) => /\.(js|css)$/.test(file.path))
      .sort((a, b) => b.size - a.size)
      .slice(0, 50)
    return {
      type: "bundle_analyze_summary",
      totalBytes: chunks.reduce((sum, file) => sum + file.size, 0),
      items: chunks.map((file) => ({ name: file.path, bytes: file.size })),
    }
  }
)

export const largeDependencyReportTool = toolDefinition(
  "large_dependency_report",
  "Find heavy dependencies and where they are imported.",
  emptySchema,
  async () => {
    const pkg = await readPackageJson()
    const deps = Object.keys({
      ...((pkg.dependencies as Record<string, string>) ?? {}),
      ...((pkg.devDependencies as Record<string, string>) ?? {}),
    })
    const suspect = deps.filter((name) =>
      /puppeteer|monaco|sharp|playwright|pdf|canvas|syntax|codemirror|webpack/i.test(name)
    )
    const { files } = await codeFiles(undefined, 1500)
    const items = []
    for (const dep of suspect) {
      const importedBy = []
      for (const file of files) {
        if ((await readBounded(file)).includes(dep)) importedBy.push(file.path)
      }
      items.push({ name: dep, importedBy: importedBy.slice(0, 30), size: importedBy.length })
    }
    return { type: "large_dependency_report", items }
  }
)

export const clientBoundaryAuditTool = toolDefinition(
  "client_boundary_audit",
  "Find use client files that import server-only code or large libraries.",
  pathLimitSchema,
  async ({ limit }) => {
    const { files } = await codeFiles(undefined, boundedLimit(limit, 1000, 3000))
    const findings = []
    for (const file of files) {
      const content = await readBounded(file)
      if (!content.startsWith('"use client"') && !content.startsWith("'use client'")) continue
      if (/@\/lib\/server|fs|child_process|path/.test(content))
        findings.push(
          finding("error", file.path, undefined, "Client component imports server-only module.")
        )
      if (/puppeteer|sharp|pdf-lib|monaco/.test(content))
        findings.push(
          finding("warning", file.path, undefined, "Client boundary imports a large dependency.")
        )
    }
    return { type: "client_boundary_audit", findings }
  }
)

export const renderRiskAuditTool = toolDefinition(
  "render_risk_audit",
  "Find React performance risks in render paths.",
  pathLimitSchema,
  async ({ path: pathName, limit }) => {
    const { files } = await collectWorkspaceFiles({
      path: pathName,
      extensions: UI_EXTENSIONS,
      maxFiles: boundedLimit(limit, 800, 2000),
    })
    const findings: Finding[] = []
    for (const file of files) {
      const content = await readBounded(file)
      linesOf(content).forEach((line, index) => {
        if (/\.map\([^)]*=>\s*<[^>]+/.test(line) && !/key=/.test(line))
          findings.push(
            finding("warning", file.path, index + 1, "Mapped JSX may be missing stable key nearby.")
          )
        if (/new Date\(|Date\.now\(|Math\.random\(/.test(line))
          findings.push(
            finding("warning", file.path, index + 1, "Render may contain hydration-unstable value.")
          )
        if (/useCallback|useMemo/.test(line) && /\[\]/.test(line) === false) return
      })
    }
    return { type: "render_risk_audit", findings: findings.slice(0, 200) }
  }
)

export const assetSizeAuditTool = toolDefinition(
  "asset_size_audit",
  "Find oversized images/fonts/static files.",
  z.object({ limitBytes: z.number().int().optional() }),
  async ({ limitBytes }) => {
    const threshold = limitBytes ?? 500_000
    const { files } = await collectWorkspaceFiles({ path: "public", maxFiles: 2000 }).catch(() => ({
      files: [] as WorkspaceFile[],
    }))
    return {
      type: "asset_size_audit",
      items: files
        .filter((file) => file.size > threshold)
        .map((file) => ({ name: file.path, bytes: file.size })),
    }
  }
)
