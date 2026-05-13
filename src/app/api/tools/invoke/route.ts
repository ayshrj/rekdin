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

// Read-only analysis, audit, and intelligence tools from domain modules
const ANALYSIS_TOOLS = [
  "component_map",
  "hook_map",
  "state_flow_trace",
  "api_contract_map",
  "api_contract_diff",
  "type_dependency_trace",
  "prop_drilling_trace",
  "event_handler_trace",
  "safe_rename_symbol",
  "move_symbol_to_file",
  "extract_function",
  "extract_component",
  "barrel_export_sync",
  "import_rewrite",
  "dead_imports_fix",
  "module_boundary_check",
  "architecture_summary",
  "feature_map",
  "ownership_map",
  "complexity_hotspots",
  "coupling_report",
  "circular_dependency_check",
  "test_gap_analysis",
  "generate_unit_test_draft",
  "test_failure_explain",
  "snapshot_diff_explain",
  "tool_contract_test_generate",
  "mock_workspace_create",
  "agent_plan_create",
  "agent_plan_check",
  "agent_worklog",
  "agent_self_check",
  "agent_diff_review",
  "agent_regression_risk",
  "tailwind_class_audit",
  "component_design_audit",
  "responsive_breakpoint_audit",
  "accessibility_audit_static",
  "storybook_story_generate",
  "shadcn_usage_audit",
  "icon_usage_map",
  "api_route_map",
  "api_payload_infer",
  "api_error_taxonomy",
  "prisma_schema_inspect",
  "drizzle_schema_inspect",
  "sql_schema_map",
  "migration_diff_summary",
  "erd_generate",
  "docs_index",
  "docs_missing_report",
  "readme_generate_or_update",
  "agents_md_sync",
  "changelog_generate",
  "release_notes_generate",
  "auth_flow_audit",
  "permission_boundary_audit",
  "dangerous_command_detect",
  "dependency_confusion_check",
  "env_usage_audit",
  "client_secret_leak_check",
  "bundle_analyze_summary",
  "large_dependency_report",
  "client_boundary_audit",
  "render_risk_audit",
  "asset_size_audit",
  "next_route_segment_map",
  "server_client_boundary_map",
  "next_metadata_audit",
  "next_image_audit",
  "next_api_runtime_audit",
  "github_pr_summary",
  "github_issue_triage",
  "github_action_logs_analyze",
  "pr_description_generate",
  "branch_cleanup_candidates",
  "screenshot_compare",
  "page_visual_audit",
  "responsive_screenshot_matrix",
  "dom_layout_box_map",
  "css_computed_style_extract",
  "postman_collection_generate",
  "curl_from_api_call",
  "prompt_lint",
  "json_output_repair",
  "schema_from_examples",
  "examples_validate_against_schema",
  "eval_case_generate",
  "llm_response_audit",
  "workflow_inventory",
  "workflow_validate",
  "workflow_run_dry",
  "workflow_compare",
  "artifact_preview",
  "artifact_convert",
  "artifact_bundle",
  "todo_to_issues",
  "env_example_generate",
  "setup_health_check",
  "onboarding_summary",
  "log_parse",
  "log_error_cluster",
  "csv_profile",
  "json_profile",
]

const ALLOWED_TOOLS = new Set([
  ...WORKSPACE_READ_TOOLS,
  ...REPO_READ_TOOLS,
  ...BROWSER_READ_TOOLS,
  ...NETWORK_READ_TOOLS,
  ...INSPECTABILITY_TOOLS,
  ...ANALYSIS_TOOLS,
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
