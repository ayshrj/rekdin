import { tool } from "@langchain/core/tools"
import { readFile, stat } from "fs/promises"
import { z } from "zod"

import { getWorkspaceRoot, resolveWorkspacePath } from "../../workspace"
import { runCommandUnsafe, safeShellArg } from "../shared/command"
import { truncateString } from "../shared/formatting"
import { collectWorkspaceFiles } from "./workspace-fs"

const SECRET_PATTERNS = [
  { type: "openai_key", pattern: /sk-[A-Za-z0-9_-]{20,}/g },
  {
    type: "generic_api_key",
    pattern: /\b(api[_-]?key|secret|token|password)\s*[:=]\s*["']?([A-Za-z0-9_./+=-]{16,})/gi,
  },
  { type: "aws_access_key", pattern: /AKIA[0-9A-Z]{16}/g },
  { type: "private_key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
]

export const secretScanTool = tool(
  async ({ path: inputPath, maxFiles }) => {
    const { files, skipped } = await collectWorkspaceFiles({
      path: inputPath,
      maxFiles: maxFiles ?? 1000,
      includeHidden: true,
    })
    const findings: Array<Record<string, unknown>> = []
    for (const file of files) {
      const content = await readFile(file.abs, "utf-8").catch(() => "")
      const lines = content.split(/\r?\n/)
      lines.forEach((line, index) => {
        for (const { type, pattern } of SECRET_PATTERNS) {
          pattern.lastIndex = 0
          if (pattern.test(line))
            findings.push({
              type,
              file: file.path,
              line: index + 1,
              preview: line.replace(/([:=]\s*["']?).{4,}/, "$1[redacted]"),
            })
        }
      })
    }
    return { type: "secret_scan", findings: findings.slice(0, 200), skipped }
  },
  {
    name: "secret_scan",
    description: "Scan workspace text files for likely secrets without returning secret values.",
    schema: z.object({
      path: z.string().optional(),
      maxFiles: z.number().int().min(1).max(5000).optional(),
    }),
  }
)

export const dependencyAuditTool = tool(
  async () => {
    const res = await runCommandUnsafe("npm audit --json", getWorkspaceRoot(), 120000)
    let parsed: Record<string, unknown> | null = null
    try {
      parsed = JSON.parse(res.stdout || "{}") as Record<string, unknown>
    } catch {
      parsed = null
    }
    return {
      type: "dependency_audit",
      exitCode: res.exitCode,
      audit: parsed,
      stderr: truncateString(res.stderr, 4000),
    }
  },
  {
    name: "dependency_audit",
    description: "Run npm audit and return JSON vulnerability metadata.",
    schema: z.object({}),
  }
)

export const licenseSummaryTool = tool(
  async () => {
    const lockPath = resolveWorkspacePath("package-lock.json")
    const lock = JSON.parse(await readFile(lockPath, "utf-8")) as {
      packages?: Record<string, { license?: string }>
    }
    const counts: Record<string, number> = {}
    for (const pkg of Object.values(lock.packages ?? {})) {
      const license = pkg.license ?? "UNKNOWN"
      counts[license] = (counts[license] ?? 0) + 1
    }
    return { type: "license_summary", licenses: counts }
  },
  {
    name: "license_summary",
    description: "Summarize package-lock license fields.",
    schema: z.object({}),
  }
)

export const sbomGenerateTool = tool(
  async () => {
    const lock = JSON.parse(await readFile(resolveWorkspacePath("package-lock.json"), "utf-8")) as {
      packages?: Record<string, { version?: string; resolved?: string; license?: string }>
    }
    const components = Object.entries(lock.packages ?? {})
      .filter(([name]) => name.startsWith("node_modules/"))
      .map(([name, info]) => ({
        type: "library",
        name: name.replace(/^node_modules\//, ""),
        version: info.version,
        licenses: info.license ? [{ license: { id: info.license } }] : undefined,
        purl: `pkg:npm/${name.replace(/^node_modules\//, "")}@${info.version ?? ""}`,
      }))
    return {
      type: "sbom_generate",
      format: "cyclonedx-lite",
      componentCount: components.length,
      bom: { bomFormat: "CycloneDX", specVersion: "1.5", components: components.slice(0, 2000) },
    }
  },
  {
    name: "sbom_generate",
    description: "Generate a lightweight CycloneDX-style SBOM from package-lock.",
    schema: z.object({}),
  }
)

export const lockfileRiskSummaryTool = tool(
  async () => {
    const lock = JSON.parse(await readFile(resolveWorkspacePath("package-lock.json"), "utf-8")) as {
      packages?: Record<
        string,
        { version?: string; resolved?: string; integrity?: string; dev?: boolean }
      >
    }
    const packages = Object.entries(lock.packages ?? {}).filter(([name]) =>
      name.startsWith("node_modules/")
    )
    return {
      type: "lockfile_risk_summary",
      packageCount: packages.length,
      missingIntegrity: packages
        .filter(([, info]) => !info.integrity)
        .map(([name]) => name)
        .slice(0, 100),
      gitResolved: packages
        .filter(([, info]) => String(info.resolved ?? "").startsWith("git"))
        .map(([name, info]) => ({ name, resolved: info.resolved }))
        .slice(0, 100),
      devCount: packages.filter(([, info]) => info.dev).length,
    }
  },
  {
    name: "lockfile_risk_summary",
    description: "Summarize package-lock supply-chain risk signals.",
    schema: z.object({}),
  }
)

export const semgrepScanTool = tool(
  async ({ config }) => {
    const res = await runCommandUnsafe(
      `semgrep --json --config ${safeShellArg(config ?? "auto")} .`,
      getWorkspaceRoot(),
      120000
    )
    let findings: unknown = res.stdout
    try {
      findings = JSON.parse(res.stdout || "{}")
    } catch {
      // keep raw output
    }
    return {
      type: "semgrep_scan",
      exitCode: res.exitCode,
      findings,
      stderr: truncateString(res.stderr, 4000),
    }
  },
  {
    name: "semgrep_scan",
    description: "Run semgrep if installed and return JSON findings.",
    schema: z.object({ config: z.string().optional() }),
  }
)

export const dockerfileScanTool = tool(
  async () => {
    const { files } = await collectWorkspaceFiles({ maxFiles: 1000, includeHidden: true })
    const dockerfiles = files.filter((file) => /(^|\/)(Dockerfile|.*\.Dockerfile)$/.test(file.path))
    const findings = []
    for (const file of dockerfiles) {
      const content = await readFile(file.abs, "utf-8").catch(() => "")
      if (/FROM\s+[^:\s]+(?=\s|$)/i.test(content))
        findings.push({ path: file.path, issue: "Base image has no explicit tag" })
      if (/USER\s+root/i.test(content) || !/\nUSER\s+/i.test(content))
        findings.push({ path: file.path, issue: "Container may run as root" })
      if (/ADD\s+https?:/i.test(content))
        findings.push({ path: file.path, issue: "Remote ADD detected" })
    }
    return { type: "dockerfile_scan", dockerfiles: dockerfiles.map((file) => file.path), findings }
  },
  {
    name: "dockerfile_scan",
    description: "Run lightweight Dockerfile safety checks.",
    schema: z.object({}),
  }
)

export const workspacePermissionsScanTool = tool(
  async ({ path: inputPath }) => {
    const { files } = await collectWorkspaceFiles({
      path: inputPath,
      maxFiles: 3000,
      includeHidden: true,
    })
    const executable = []
    const worldWritable = []
    for (const file of files) {
      const info = await stat(file.abs)
      if ((info.mode & 0o111) !== 0) executable.push(file.path)
      if ((info.mode & 0o002) !== 0) worldWritable.push(file.path)
    }
    return {
      type: "workspace_permissions_scan",
      executable: executable.slice(0, 200),
      worldWritable: worldWritable.slice(0, 200),
    }
  },
  {
    name: "workspace_permissions_scan",
    description: "Find executable and world-writable files.",
    schema: z.object({ path: z.string().optional() }),
  }
)
