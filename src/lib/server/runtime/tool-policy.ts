import { AgentMode, ToolPolicyProfile } from "@/types/runtime"

type ToolGroup =
  | "network"
  | "browser_read"
  | "browser_write"
  | "workspace_read"
  | "workspace_write"
  | "execution"
  | "documents"
  | "transforms"
  | "repo"

const TOOL_GROUPS: Record<string, ToolGroup[]> = {
  web_search: ["network"],
  search_batch: ["network"],
  visit_link: ["network"],
  fetch_many: ["network"],
  http_request: ["network"],
  download_fetch: ["network"],
  robots_txt: ["network"],
  sitemap_fetch: ["network"],
  rss_fetch: ["network"],
  page_metadata_batch: ["network"],
  page_diff_snapshot: ["network"],
  citation_metadata: ["network"],
  domain_info: ["network"],
  github_repo_info: ["network"],
  package_compare: ["network"],
  url_safety_check: ["network", "transforms"],
  link_preview: ["network"],
  npm_package_info: ["network"],
  session_list: ["workspace_read"],
  session_inspect: ["workspace_read"],
  replay_summary: ["workspace_read"],
  replay_search: ["workspace_read"],
  trace_summary: ["workspace_read"],
  token_usage_report: ["workspace_read"],
  background_jobs_summary: ["workspace_read"],
  settings_summary: ["workspace_read"],
  code_map: ["workspace_read", "repo"],
  file_stat: ["workspace_read"],
  workspace_stats: ["workspace_read"],
  file_head_tail: ["workspace_read"],
  file_outline: ["workspace_read", "repo"],
  symbol_search: ["workspace_read", "repo"],
  symbol_references: ["workspace_read", "repo"],
  dependency_graph: ["workspace_read", "repo"],
  route_map: ["workspace_read", "repo"],
  test_map: ["workspace_read", "repo"],
  config_inventory: ["workspace_read", "repo"],
  env_inventory: ["workspace_read"],
  lockfile_summary: ["workspace_read", "repo"],
  duplicate_code_candidates: ["workspace_read", "repo"],
  dead_code_candidates: ["workspace_read", "repo"],
  file_search: ["workspace_read"],
  file_read: ["workspace_read"],
  list_files: ["workspace_read"],
  file_replace: ["workspace_write"],
  json_patch: ["workspace_write"],
  yaml_patch: ["workspace_write"],
  archive_create: ["workspace_write"],
  archive_extract: ["workspace_write"],
  write_file: ["workspace_write"],
  browser_navigate: ["browser_read"],
  browser_get_markdown: ["browser_read"],
  browser_screenshot: ["browser_read"],
  browser_extract: ["browser_read"],
  browser_get_text: ["browser_read"],
  browser_get_links: ["browser_read"],
  browser_get_clickable_elements: ["browser_read"],
  browser_accessibility_snapshot: ["browser_read"],
  browser_console_logs: ["browser_read"],
  browser_network_log: ["browser_read"],
  browser_storage_snapshot: ["browser_read"],
  browser_selector_screenshot: ["browser_read"],
  browser_full_page_screenshot: ["browser_read"],
  browser_form_schema: ["browser_read"],
  browser_table_extract: ["browser_read"],
  browser_wait: ["browser_read"],
  browser_wait_for: ["browser_read"],
  browser_print_pdf: ["documents", "browser_read"],
  browser_downloads: ["documents", "browser_write"],
  browser_set_viewport: ["browser_write"],
  browser_control: ["browser_write"],
  browser_vision_control: ["browser_write"],
  browser_action: ["browser_write"],
  browser_click: ["browser_write"],
  browser_double_click: ["browser_write"],
  browser_right_click: ["browser_write"],
  browser_hover: ["browser_write"],
  browser_scroll: ["browser_write"],
  browser_type: ["browser_write"],
  browser_form_input_fill: ["browser_write"],
  browser_form_fill_batch: ["browser_write"],
  browser_drag_and_drop: ["browser_write"],
  browser_drag: ["browser_write"],
  browser_key_press: ["browser_write"],
  browser_hotkey: ["browser_write"],
  browser_evaluate: ["browser_write"],
  node_execute: ["execution"],
  python_execute: ["execution"],
  node_codeact: ["execution"],
  python_codeact: ["execution"],
  shell_codeact: ["execution"],
  shell_execute: ["execution"],
  execute_command: ["execution"],
  npm_scripts: ["repo"],
  run_npm_script: ["repo"],
  typecheck_project: ["repo"],
  lint_project: ["repo"],
  test_project: ["repo"],
  format_check: ["repo"],
  build_project: ["repo"],
  dev_server_start: ["repo"],
  dev_server_stop: ["repo"],
  dev_server_status: ["repo"],
  port_probe: ["network", "repo"],
  http_health_check: ["network", "repo"],
  generate_latex_pdf: ["documents"],
  markdown_to_pdf: ["documents"],
  pdf_extract_text: ["documents", "workspace_read"],
  docx_extract_text: ["documents", "workspace_read"],
  base64_encode: ["transforms"],
  base64_decode: ["transforms"],
  hash: ["transforms"],
  text_summarize: ["transforms"],
  text_rewrite: ["transforms"],
  token_count: ["transforms"],
  text_keywords: ["transforms"],
  text_entities: ["transforms"],
  extract_todos: ["transforms"],
  csv_preview: ["transforms", "workspace_read"],
  csv_query: ["transforms", "workspace_read"],
  json_query: ["transforms", "workspace_read"],
  yaml_query: ["transforms", "workspace_read"],
  sqlite_query: ["transforms", "workspace_read"],
  html_table_extract: ["transforms", "network"],
  markdown_frontmatter: ["transforms", "workspace_read"],
  image_info: ["transforms"],
  image_convert: ["transforms"],
  image_exif: ["transforms"],
  image_ocr: ["transforms"],
  image_diff: ["transforms"],
  svg_optimize: ["transforms", "workspace_read"],
  asset_manifest: ["workspace_read"],
  artifact_list: ["workspace_read"],
  artifact_read: ["workspace_read"],
  artifact_delete: ["workspace_write"],
  secret_scan: ["workspace_read", "repo"],
  dependency_audit: ["repo"],
  license_summary: ["repo"],
  sbom_generate: ["repo"],
  lockfile_risk_summary: ["repo"],
  semgrep_scan: ["repo"],
  dockerfile_scan: ["workspace_read", "repo"],
  workspace_permissions_scan: ["workspace_read", "repo"],
  git_log_summary: ["repo"],
  git_branches: ["repo"],
  git_diff_summary: ["repo"],
  git_blame: ["repo"],
  git_file_history: ["repo"],
  git_status: ["repo"],
  git_changed_files: ["repo"],
  git_staged_diff: ["repo"],
  git_show: ["repo"],
  git_compare_refs: ["repo"],
  git_conflicts: ["repo"],
  git_tags: ["repo"],
  git_remote_info: ["repo"],
  git_commit_search: ["repo"],
  git_patch_preview: ["repo"],
  git_apply_patch: ["workspace_write", "repo"],

  // Cluster A — developer utilities
  jwt_decode: ["transforms"],
  regex_match: ["transforms"],
  uuid_generate: ["transforms"],
  url_parse: ["transforms", "network"],
  cron_explain: ["transforms"],
  color_convert: ["transforms"],

  // Cluster B — diff & comparison
  text_diff: ["transforms", "workspace_read"],
  json_diff: ["transforms", "workspace_read"],

  // Cluster C — git write
  git_commit: ["repo", "workspace_write"],
  git_checkout: ["repo"],
  git_stash: ["repo"],
  git_push: ["repo", "network"],

  // Cluster D — system & process
  process_list: ["workspace_read"],
  system_info: ["workspace_read"],
  clipboard_read: ["workspace_read"],
  clipboard_write: ["transforms"],
  desktop_notify: ["transforms"],

  // Cluster E — network diagnostics
  dns_lookup: ["network"],
  ssl_check: ["network"],
  ping: ["network"],
  whois_lookup: ["network"],

  // Cluster F — API development
  openapi_inspect: ["network", "workspace_read", "transforms"],
  graphql_introspect: ["network"],

  // Cluster G — image tools
  image_resize: ["transforms"],
  image_crop: ["transforms"],

  // Cluster H — data format
  json_schema_validate: ["transforms"],
  csv_to_json: ["transforms", "workspace_read"],
  json_to_csv: ["transforms"],
  xml_to_json: ["transforms", "workspace_read"],
  xpath_query: ["transforms", "workspace_read"],

  // Cluster I — code intelligence (read-only analysis)
  component_map: ["workspace_read", "repo"],
  hook_map: ["workspace_read", "repo"],
  state_flow_trace: ["workspace_read", "repo"],
  type_dependency_trace: ["workspace_read", "repo"],
  prop_drilling_trace: ["workspace_read", "repo"],
  event_handler_trace: ["workspace_read", "repo"],

  // Cluster J — refactoring (dry-run patch previews)
  safe_rename_symbol: ["workspace_read", "repo"],
  move_symbol_to_file: ["workspace_read", "repo"],
  extract_function: ["workspace_read", "repo"],
  extract_component: ["workspace_read", "repo"],
  barrel_export_sync: ["workspace_read", "repo"],
  import_rewrite: ["workspace_read", "repo"],
  dead_imports_fix: ["workspace_read", "repo"],
  module_boundary_check: ["workspace_read", "repo"],

  // Cluster K — architecture analysis
  architecture_summary: ["workspace_read", "repo"],
  feature_map: ["workspace_read", "repo"],
  ownership_map: ["workspace_read", "repo"],
  complexity_hotspots: ["workspace_read", "repo"],
  coupling_report: ["workspace_read", "repo"],
  circular_dependency_check: ["workspace_read", "repo"],

  // Cluster L — testing
  test_gap_analysis: ["workspace_read", "repo"],
  generate_unit_test_draft: ["workspace_read", "repo"],
  test_failure_explain: ["workspace_read", "repo"],
  snapshot_diff_explain: ["workspace_read", "repo"],
  tool_contract_test_generate: ["workspace_read", "repo"],
  mock_workspace_create: ["workspace_read", "repo"],

  // Cluster M — agent planning
  agent_plan_create: ["workspace_read", "repo"],
  agent_plan_check: ["workspace_read", "repo"],
  agent_worklog: ["workspace_read", "repo"],
  agent_self_check: ["workspace_read", "repo"],
  agent_diff_review: ["workspace_read", "repo"],
  agent_regression_risk: ["workspace_read", "repo"],

  // Cluster N — UI audit + control
  ui_control: ["transforms"],
  tailwind_class_audit: ["workspace_read", "repo"],
  component_design_audit: ["workspace_read", "repo"],
  responsive_breakpoint_audit: ["workspace_read", "repo"],
  accessibility_audit_static: ["workspace_read", "repo"],
  storybook_story_generate: ["workspace_read", "repo"],
  shadcn_usage_audit: ["workspace_read", "repo"],
  icon_usage_map: ["workspace_read", "repo"],

  // Cluster O — API contracts
  api_contract_map: ["workspace_read", "repo"],
  api_route_map: ["workspace_read", "repo"],
  api_payload_infer: ["workspace_read", "repo"],
  api_contract_diff: ["workspace_read", "repo"],
  api_error_taxonomy: ["workspace_read", "repo"],

  // Cluster P — database
  prisma_schema_inspect: ["workspace_read", "repo"],
  drizzle_schema_inspect: ["workspace_read", "repo"],
  sql_schema_map: ["workspace_read", "repo"],
  migration_diff_summary: ["workspace_read", "repo"],
  erd_generate: ["workspace_read", "repo"],

  // Cluster Q — docs
  docs_index: ["workspace_read", "repo"],
  docs_missing_report: ["workspace_read", "repo"],
  readme_generate_or_update: ["workspace_read", "repo"],
  agents_md_sync: ["workspace_read", "repo"],
  changelog_generate: ["workspace_read", "repo"],
  release_notes_generate: ["workspace_read", "repo"],

  // Cluster R — security audits
  auth_flow_audit: ["workspace_read", "repo"],
  permission_boundary_audit: ["workspace_read", "repo"],
  dangerous_command_detect: ["workspace_read", "repo"],
  dependency_confusion_check: ["workspace_read", "repo"],
  env_usage_audit: ["workspace_read", "repo"],
  client_secret_leak_check: ["workspace_read", "repo"],

  // Cluster S — performance and Next.js audits
  bundle_analyze_summary: ["workspace_read", "repo"],
  large_dependency_report: ["workspace_read", "repo"],
  client_boundary_audit: ["workspace_read", "repo"],
  render_risk_audit: ["workspace_read", "repo"],
  asset_size_audit: ["workspace_read", "repo"],
  next_route_segment_map: ["workspace_read", "repo"],
  server_client_boundary_map: ["workspace_read", "repo"],
  next_metadata_audit: ["workspace_read", "repo"],
  next_image_audit: ["workspace_read", "repo"],
  next_api_runtime_audit: ["workspace_read", "repo"],

  // Cluster T — GitHub (network + read)
  github_pr_summary: ["network", "workspace_read"],
  github_issue_triage: ["network", "workspace_read"],
  github_action_logs_analyze: ["network", "workspace_read"],
  pr_description_generate: ["workspace_read", "repo"],
  branch_cleanup_candidates: ["workspace_read", "repo"],

  // Cluster U — artifacts and dev helpers
  artifact_preview: ["workspace_read", "repo"],
  artifact_convert: ["workspace_read", "repo"],
  artifact_bundle: ["workspace_read", "repo"],
  todo_to_issues: ["workspace_read", "repo"],
  env_example_generate: ["workspace_read", "repo"],
  setup_health_check: ["workspace_read", "repo"],
  onboarding_summary: ["workspace_read", "repo"],

  // Cluster V — browser visual analysis
  screenshot_compare: ["browser_read"],
  page_visual_audit: ["browser_read"],
  responsive_screenshot_matrix: ["browser_read"],
  dom_layout_box_map: ["browser_read"],
  css_computed_style_extract: ["browser_read"],

  // Cluster W — LLM and workflow helpers
  postman_collection_generate: ["transforms", "workspace_read"],
  curl_from_api_call: ["transforms", "workspace_read"],
  prompt_lint: ["transforms", "workspace_read"],
  json_output_repair: ["transforms", "workspace_read"],
  schema_from_examples: ["transforms", "workspace_read"],
  examples_validate_against_schema: ["transforms", "workspace_read"],
  eval_case_generate: ["transforms", "workspace_read"],
  llm_response_audit: ["transforms", "workspace_read"],
  workflow_inventory: ["transforms", "workspace_read"],
  workflow_validate: ["transforms", "workspace_read"],
  workflow_run_dry: ["transforms", "workspace_read"],
  workflow_compare: ["transforms", "workspace_read"],
  log_parse: ["transforms", "workspace_read"],
  log_error_cluster: ["transforms", "workspace_read"],
  csv_profile: ["transforms", "workspace_read"],
  json_profile: ["transforms", "workspace_read"],
}

const GROUPS_BY_MODE: Record<AgentMode, ToolGroup[]> = {
  general: [
    "network",
    "browser_read",
    "workspace_read",
    "workspace_write",
    "documents",
    "transforms",
    "repo",
    "execution",
  ],
  research: ["network", "browser_read", "documents", "transforms", "repo", "workspace_read"],
  browser: ["network", "browser_read", "browser_write", "transforms"],
  workspace: ["workspace_read", "workspace_write", "repo", "transforms", "documents", "execution"],
  document: ["documents", "workspace_read", "workspace_write", "transforms", "network"],
}

const GROUPS_BY_PROFILE: Record<ToolPolicyProfile, ToolGroup[]> = {
  read_only: ["network", "browser_read", "workspace_read", "transforms", "repo"],
  balanced: [
    "network",
    "browser_read",
    "browser_write",
    "workspace_read",
    "workspace_write",
    "documents",
    "transforms",
    "repo",
  ],
  full_auto: [
    "network",
    "browser_read",
    "browser_write",
    "workspace_read",
    "workspace_write",
    "execution",
    "documents",
    "transforms",
    "repo",
  ],
}

const READ_ONLY_BLOCKLIST = new Set([
  "browser_control",
  "browser_vision_control",
  "browser_action",
  "browser_click",
  "browser_double_click",
  "browser_right_click",
  "browser_hover",
  "browser_scroll",
  "browser_type",
  "browser_form_input_fill",
  "browser_form_fill_batch",
  "browser_drag_and_drop",
  "browser_drag",
  "browser_key_press",
  "browser_hotkey",
  "browser_evaluate",
  "browser_print_pdf",
  "browser_downloads",
  "browser_set_viewport",
  "file_replace",
  "json_patch",
  "yaml_patch",
  "archive_create",
  "archive_extract",
  "write_file",
  "node_execute",
  "python_execute",
  "node_codeact",
  "python_codeact",
  "shell_codeact",
  "shell_execute",
  "execute_command",
  "run_npm_script",
  "build_project",
  "dev_server_start",
  "dev_server_stop",
  "browser_downloads",
  "git_apply_patch",
  "artifact_delete",
  "generate_latex_pdf",
  "markdown_to_pdf",
  "image_convert",
  "git_commit",
  "git_checkout",
  "git_stash",
  "git_push",
  "clipboard_write",
  "desktop_notify",
  "image_resize",
  "image_crop",
])

const BALANCED_APPROVAL_TOOLS = new Set([
  "file_replace",
  "json_patch",
  "yaml_patch",
  "archive_create",
  "archive_extract",
  "write_file",
  "browser_control",
  "browser_vision_control",
  "browser_action",
  "browser_click",
  "browser_double_click",
  "browser_right_click",
  "browser_type",
  "browser_form_input_fill",
  "browser_form_fill_batch",
  "browser_drag_and_drop",
  "browser_drag",
  "browser_key_press",
  "browser_hotkey",
  "browser_evaluate",
  "browser_print_pdf",
  "browser_downloads",
  "browser_set_viewport",
  "node_execute",
  "python_execute",
  "node_codeact",
  "python_codeact",
  "shell_codeact",
  "shell_execute",
  "execute_command",
  "run_npm_script",
  "build_project",
  "dev_server_start",
  "dev_server_stop",
  "git_apply_patch",
  "artifact_delete",
  "git_commit",
  "git_checkout",
  "git_stash",
  "git_push",
])

const FULL_AUTO_APPROVAL_TOOLS = new Set([
  "shell_execute",
  "execute_command",
  "shell_codeact",
  "run_npm_script",
  "build_project",
  "dev_server_start",
  "dev_server_stop",
  "browser_downloads",
  "git_apply_patch",
  "artifact_delete",
  "git_push",
])

/**
 * Computes the hard tool allow-list for a turn by intersecting the selected agent mode with the
 * selected tool policy profile. Prompt guidance can ask the model to be careful, but this function
 * is the actual permission boundary for which tools the model receives.
 */
export function resolveAllowedToolNames(mode: AgentMode, profile: ToolPolicyProfile): string[] {
  const modeGroups = new Set(GROUPS_BY_MODE[mode])
  const profileGroups = new Set(GROUPS_BY_PROFILE[profile])
  return Object.entries(TOOL_GROUPS)
    .filter(([toolName, groups]) => {
      if (profile === "read_only" && READ_ONLY_BLOCKLIST.has(toolName)) {
        return false
      }
      return groups.some((group) => modeGroups.has(group) && profileGroups.has(group))
    })
    .map(([toolName]) => toolName)
}

const WORKFLOW_TOOL_ALLOWLISTS: Record<string, string[]> = {
  "research-plan": [],
  "research-report": [
    "web_search",
    "search_batch",
    "visit_link",
    "fetch_many",
    "link_preview",
    "page_metadata_batch",
    "citation_metadata",
    "browser_get_markdown",
    "text_summarize",
    "text_keywords",
  ],
  "repo-audit": [
    "code_map",
    "workspace_stats",
    "file_outline",
    "symbol_search",
    "dependency_graph",
    "route_map",
    "test_map",
    "config_inventory",
    "lockfile_summary",
    "secret_scan",
    "license_summary",
    "file_read",
    "file_search",
    "list_files",
    "extract_todos",
    "git_log_summary",
    "git_branches",
    "git_diff_summary",
    "git_blame",
    "git_file_history",
    "git_status",
    "git_changed_files",
  ],
  "diff-review": [
    "git_status",
    "git_changed_files",
    "git_diff_summary",
    "git_staged_diff",
    "code_map",
    "file_outline",
    "symbol_references",
    "file_read",
    "file_search",
    "list_files",
    "git_blame",
    "git_file_history",
  ],
}

export function resolveWorkflowAllowedToolNames(
  mode: AgentMode,
  profile: ToolPolicyProfile,
  workflowId?: string | null
): string[] {
  const baseTools = resolveAllowedToolNames(mode, profile)
  const workflowTools = workflowId ? WORKFLOW_TOOL_ALLOWLISTS[workflowId] : undefined
  if (!workflowTools) return baseTools
  const base = new Set(baseTools)
  return workflowTools.filter((toolName) => base.has(toolName))
}

export function requiresToolApproval(toolName: string, profile: ToolPolicyProfile) {
  if (profile === "read_only") return false
  if (profile === "balanced") return BALANCED_APPROVAL_TOOLS.has(toolName)
  return FULL_AUTO_APPROVAL_TOOLS.has(toolName)
}

export function getToolApprovalReason(toolName: string, profile: ToolPolicyProfile) {
  if (profile === "balanced") {
    return `${toolName} can mutate files, browser state, or the local environment in balanced mode.`
  }
  return `${toolName} can run host-level commands and needs explicit approval even in full auto mode.`
}
