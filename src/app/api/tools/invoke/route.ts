import { NextResponse } from "next/server"
import { z } from "zod"

import { getSettingsStore } from "@/lib/server/settings-store"
import { runWithToolExecutionContext } from "@/lib/server/tool-execution-context"
import { createToolset } from "@/lib/server/tools"

export const runtime = "nodejs"

// Only safe, read-only tools are exposed through this route.
// workspace_read group
const WORKSPACE_READ_TOOLS = [
  "file_read",
  "list_files",
  "file_stat",
  "file_search",
  "file_head_tail",
  "file_outline",
  "symbol_search",
  "symbol_references",
  "workspace_stats",
  "code_map",
  "route_map",
  "test_map",
  "secret_scan",
  "duplicate_code_candidates",
  "dead_code_candidates",
  "csv_preview",
  "csv_query",
  "json_query",
  "yaml_query",
  "sqlite_query",
  "markdown_frontmatter",
  "asset_manifest",
  "artifact_list",
  "artifact_read",
  "pdf_extract_text",
  "docx_extract_text",
]
// repo group (read-only git operations)
const REPO_READ_TOOLS = [
  "git_log_summary",
  "git_branches",
  "git_diff_summary",
  "git_blame",
  "git_file_history",
  "git_status",
  "git_changed_files",
  "git_staged_diff",
  "git_show",
  "git_compare_refs",
  "git_conflicts",
  "git_tags",
  "git_remote_info",
  "git_commit_search",
  "git_patch_preview",
  "npm_scripts",
  "dependency_audit",
  "license_summary",
  "lockfile_risk_summary",
]
// browser read-only group
const BROWSER_READ_TOOLS = [
  "browser_full_page_screenshot",
  "browser_selector_screenshot",
  "browser_screenshot",
  "browser_get_markdown",
  "browser_get_text",
  "browser_get_links",
  "browser_extract",
  "browser_accessibility_snapshot",
  "browser_console_logs",
  "browser_network_log",
  "browser_storage_snapshot",
  "browser_form_schema",
  "browser_table_extract",
]
// network read-only tools
const NETWORK_READ_TOOLS = [
  "visit_link",
  "link_preview",
  "npm_package_info",
  "domain_info",
  "robots_txt",
  "sitemap_fetch",
  "page_metadata_batch",
]

const INSPECTABILITY_TOOLS = [
  "session_list",
  "session_inspect",
  "replay_summary",
  "replay_search",
  "trace_summary",
  "token_usage_report",
  "background_jobs_summary",
  "settings_summary",
]

const ALLOWED_TOOLS = new Set([
  ...WORKSPACE_READ_TOOLS,
  ...REPO_READ_TOOLS,
  ...BROWSER_READ_TOOLS,
  ...NETWORK_READ_TOOLS,
  ...INSPECTABILITY_TOOLS,
])

const requestSchema = z.object({
  sessionId: z.string().min(1),
  toolName: z.string().min(1),
  toolInput: z.record(z.string(), z.unknown()).optional().default({}),
})

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { sessionId, toolName, toolInput } = parsed.data

  if (!ALLOWED_TOOLS.has(toolName)) {
    return NextResponse.json(
      { error: `Tool "${toolName}" is not available through this endpoint.` },
      { status: 403 }
    )
  }

  const settings = await getSettingsStore().load()
  const workspaceRoot = settings.workspaceRoot ?? null

  const toolset = createToolset({ allowedToolNames: [toolName] })
  const tool = toolset.find((t) => t.name === toolName)
  if (!tool) {
    return NextResponse.json({ error: `Tool "${toolName}" not found.` }, { status: 404 })
  }

  try {
    const result = await runWithToolExecutionContext(
      { sessionId, workspaceRoot: workspaceRoot ?? undefined },
      () =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tool as any).invoke(toolInput)
    )
    return NextResponse.json({ result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
