import { z } from "zod"

import { codeFiles, readBounded } from "../shared/code-utils"
import { boundedLimit } from "../shared/formatting"
import {
  emptySchema,
  type Finding,
  finding,
  pathLimitSchema,
  toolDefinition,
} from "../shared/tool-base"
import { readPackageJson, readWorkspaceText } from "../workspace/workspace-fs"

export const authFlowAuditTool = toolDefinition(
  "auth_flow_audit",
  "Scan code for auth/session usage and missing checks.",
  pathLimitSchema,
  async ({ limit }) => {
    const { files } = await codeFiles(undefined, boundedLimit(limit, 1000, 3000))
    const findings: Finding[] = []
    for (const file of files.filter(
      (item) => item.path.includes("/api/") || item.path.includes("route.")
    )) {
      const content = await readBounded(file)
      if (!/auth|session|token|cookie|user/i.test(content))
        findings.push(
          finding(
            "info",
            file.path,
            undefined,
            "No auth/session check detected in route-like file."
          )
        )
    }
    return { type: "auth_flow_audit", findings: findings.slice(0, 200) }
  }
)

export const permissionBoundaryAuditTool = toolDefinition(
  "permission_boundary_audit",
  "Check whether dangerous tools appear to require approval.",
  emptySchema,
  async () => {
    const policy = await readWorkspaceText("src/lib/server/runtime/tool-policy.ts")
    const dangerous = [
      "execute_command",
      "write_file",
      "git_push",
      "git_apply_patch",
      "artifact_delete",
      "browser_downloads",
    ]
    const findings = dangerous
      .filter((name) => !policy.includes(name))
      .map((name) =>
        finding(
          "error",
          "src/lib/server/runtime/tool-policy.ts",
          undefined,
          `${name} is not present in policy file.`
        )
      )
    return { type: "permission_boundary_audit", findings }
  }
)

export const dangerousCommandDetectTool = toolDefinition(
  "dangerous_command_detect",
  "Analyze shell commands before running and detect dangerous patterns.",
  z.object({ command: z.string().min(1) }),
  async ({ command }) => {
    const patterns = [
      [/rm\s+-rf\s+\/|rm\s+-rf\s+\*/, "recursive destructive remove"],
      [/curl\s+[^|]+\|\s*(bash|sh)/, "curl pipe to shell"],
      [/chmod\s+-R\s+777/, "world-writable recursive chmod"],
      [/\bsudo\b/, "sudo usage"],
      [/(cat|echo|printenv).*(API_KEY|TOKEN|SECRET|PASSWORD)/i, "possible secret exfiltration"],
    ] as const
    return {
      type: "dangerous_command_detect",
      findings: patterns
        .filter(([re]) => re.test(command))
        .map(([, message]) => finding("error", "command", undefined, message)),
    }
  }
)

export const dependencyConfusionCheckTool = toolDefinition(
  "dependency_confusion_check",
  "Check package names for possible internal/external dependency confusion risk.",
  emptySchema,
  async () => {
    const pkg = await readPackageJson()
    const deps = {
      ...((pkg.dependencies as Record<string, string>) ?? {}),
      ...((pkg.devDependencies as Record<string, string>) ?? {}),
    }
    const findings = Object.keys(deps)
      .filter((name) => !name.startsWith("@") && /internal|private|company|rekdin/i.test(name))
      .map((name) =>
        finding(
          "warning",
          "package.json",
          undefined,
          `Package name "${name}" may be private-looking but unscoped.`
        )
      )
    return { type: "dependency_confusion_check", findings }
  }
)

export const envUsageAuditTool = toolDefinition(
  "env_usage_audit",
  "Find env vars used in code but missing from .env.example, and unused example vars.",
  pathLimitSchema,
  async ({ limit }) => {
    const { files } = await codeFiles(undefined, boundedLimit(limit, 1000, 3000))
    const used = new Set<string>()
    for (const file of files) {
      const content = await readBounded(file)
      for (const match of content.matchAll(/process\.env\.([A-Z0-9_]+)/g)) used.add(match[1])
    }
    const example = await readWorkspaceText(".env.example").catch(() => "")
    const documented = new Set(Array.from(example.matchAll(/^([A-Z0-9_]+)=/gm)).map((m) => m[1]))
    const findings = [...used]
      .filter((name) => !documented.has(name))
      .map((name) =>
        finding(
          "warning",
          ".env.example",
          undefined,
          `${name} used in code but missing from .env.example`
        )
      )
    return {
      type: "env_usage_audit",
      findings,
      used: [...used].sort(),
      documented: [...documented].sort(),
    }
  }
)

export const clientSecretLeakCheckTool = toolDefinition(
  "client_secret_leak_check",
  "Check if server-only env vars are imported into client components.",
  pathLimitSchema,
  async ({ limit }) => {
    const { files } = await codeFiles(undefined, boundedLimit(limit, 1000, 3000))
    const findings = []
    for (const file of files) {
      const content = await readBounded(file)
      if (!content.startsWith('"use client"') && !content.startsWith("'use client'")) continue
      for (const match of content.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
        if (!match[1].startsWith("NEXT_PUBLIC_"))
          findings.push(
            finding("error", file.path, undefined, `Client file reads server env var ${match[1]}`)
          )
      }
    }
    return { type: "client_secret_leak_check", findings }
  }
)
