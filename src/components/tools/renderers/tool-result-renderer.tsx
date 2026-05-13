"use client"

import React from "react"

export { toolLabels } from "../tool-labels"

import { AgentPlanRenderer } from "./agent-plan-renderer"
import { GraphqlIntrospectRenderer, OpenApiInspectRenderer } from "./api-spec-renderer"
import { ArchitectureRenderer } from "./architecture-renderer"
import { ArchiveRenderer } from "./archive-renderer"
import { ArtifactRenderer } from "./artifact-renderer"
import { AuditFindingsRenderer } from "./audit-findings-renderer"
import { BackgroundJobsRenderer } from "./background-jobs-renderer"
import { Base64Renderer } from "./base64-renderer"
import {
  BrowserEvalRenderer,
  BrowserLogsRenderer,
  BrowserScreenshotExtRenderer,
  BrowserStorageRenderer,
  ClickActionRenderer,
  DataExtractionRenderer,
  DragActionRenderer,
  FormFillRenderer,
  HoverActionRenderer,
  WaitActionRenderer,
} from "./browser"
import { BrowserControlRenderer } from "./browser-control-renderer"
import { BrowserResultRenderer } from "./browser-result-renderer"
import { CodeActRenderer } from "./code-act-renderer"
import { CodeMapFlowRenderer } from "./code-map-flow-renderer"
import { CodeQualityRenderer } from "./code-quality-renderer"
import { CommandResultRenderer } from "./command-result-renderer"
import {
  CsvToJsonRenderer,
  JsonSchemaValidateRenderer,
  JsonToCsvRenderer,
  XmlToJsonRenderer,
  XpathQueryRenderer,
} from "./data-format-renderer"
import { DataProfileRenderer } from "./data-profile-renderer"
import { DataQueryRenderer } from "./data-query-renderer"
import { DeepResearchRenderer } from "./deep-research-renderer"
import { DependencyAuditRenderer } from "./dependency-audit-renderer"
import { DevServerRenderer } from "./dev-server-renderer"
import { DocumentExtractRenderer } from "./document-extract-renderer"
import { DomainInfoRenderer } from "./domain-info-renderer"
import { ExtractTodosRenderer } from "./extract-todos-renderer"
import { FetchManyRenderer } from "./fetch-many-renderer"
import { FileOutlineRenderer } from "./file-outline-renderer"
import { FileReadRenderer } from "./file-read-renderer"
import { FileSearchRenderer } from "./file-search-renderer"
import { FileStatRenderer } from "./file-stat-renderer"
import { GenericResultRenderer } from "./generic-result-renderer"
import { GitBlameRenderer } from "./git-blame-renderer"
import { GitBranchesRenderer } from "./git-branches-renderer"
import { GitCommitSearchRenderer } from "./git-commit-search-renderer"
import { GitConflictsRenderer } from "./git-conflicts-renderer"
import { GitDiffRenderer } from "./git-diff-renderer"
import { GitLogRenderer } from "./git-log-renderer"
import { GitShowRenderer } from "./git-show-renderer"
import { GitStatusRenderer } from "./git-status-renderer"
import { GitTagsRenderer } from "./git-tags-renderer"
import {
  GitCheckoutRenderer,
  GitCommitRenderer,
  GitPushRenderer,
  GitStashRenderer,
} from "./git-write-renderer"
import { GithubRenderer } from "./github-renderer"
import { HashRenderer } from "./hash-renderer"
import { HttpRequestRenderer } from "./http-request-renderer"
import { ImageAnalysisRenderer } from "./image-analysis-renderer"
import { ImageExifRenderer } from "./image-exif-renderer"
import { ImageInfoRenderer } from "./image-info-renderer"
import { ImageCropRenderer, ImageResizeRenderer } from "./image-tools-renderer"
import { JsonResultRenderer } from "./json-result-renderer"
import { LinkPreviewRenderer } from "./link-preview-renderer"
import { ListFilesRenderer } from "./list-files-renderer"
import {
  DnsLookupRenderer,
  PingRenderer,
  SslCheckRenderer,
  WhoisLookupRenderer,
} from "./network-diagnostics-renderer"
import { NpmPackageRenderer } from "./npm-package-renderer"
import { NpmScriptsRenderer } from "./npm-scripts-renderer"
import { PatchPreviewRenderer } from "./patch-preview-renderer"
import { PdfRenderer } from "./pdf-renderer"
import { ReplaySearchRenderer, ReplaySummaryRenderer } from "./replay-renderer"
import { RouteMapRenderer } from "./route-map-renderer"
import { SchemaRenderer } from "./schema-renderer"
import { ScreenshotCompareRenderer } from "./screenshot-compare-renderer"
import { ScriptResultRenderer } from "./script-result-renderer"
import { SecretScanRenderer } from "./secret-scan-renderer"
import { SecurityCheckRenderer } from "./security-check-renderer"
import { SessionInspectRenderer, SessionListRenderer } from "./session-renderer"
import { SettingsSummaryRenderer } from "./settings-summary-renderer"
import { SizeReportRenderer } from "./size-report-renderer"
import { SymbolRenderer } from "./symbol-renderer"
import {
  ClipboardReadRenderer,
  ClipboardWriteRenderer,
  DesktopNotifyRenderer,
  ProcessListRenderer,
  SystemInfoRenderer,
} from "./system-renderer"
import { TableRenderer } from "./table-renderer"
import { TestGapRenderer } from "./test-gap-renderer"
import { TextAnalysisRenderer } from "./text-analysis-renderer"
import { TextOutputRenderer } from "./text-output-renderer"
import { TokenUsageReportRenderer, TraceSummaryRenderer } from "./trace-renderer"
import {
  ColorConvertRenderer,
  CronExplainRenderer,
  JsonDiffRenderer,
  JwtDecodeRenderer,
  RegexMatchRenderer,
  TextDiffRenderer,
  UrlParseRenderer,
  UuidGenerateRenderer,
} from "./utility-renderer"
import { VisitLinkRenderer } from "./visit-link-renderer"
import { WebMetadataRenderer } from "./web-metadata-renderer"
import { WebSearchResultRenderer } from "./web-search-result-renderer"
import { WorkflowCardRenderer } from "./workflow-card-renderer"
import { WorkspaceStatsRenderer } from "./workspace-stats-renderer"
import { WriteFileRenderer } from "./write-file-renderer"

export interface ToolResultContentPart {
  type: string
  name?: string
  toolName?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolInput?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolResult?: any
  command?: string
  stdout?: string
  stderr?: string
  exitCode?: number
  script?: string
  interpreter?: string
  cwd?: string
  status?: "success" | "error" | "running"
  timestamp?: string
  fullJson?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function stringifyFallback(value: unknown) {
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function normalizeContentPart(value: unknown, index: number): ToolResultContentPart {
  if (isRecord(value)) {
    const type = typeof value.type === "string" && value.type ? value.type : "generic"
    const toolName = typeof value.toolName === "string" ? value.toolName : undefined
    const name = typeof value.name === "string" ? value.name : undefined
    return { ...value, type, toolName, name } as ToolResultContentPart
  }

  return {
    type: "generic",
    name: `content-${index + 1}`,
    toolResult: value,
  }
}

function normalizeContent(content: unknown): ToolResultContentPart[] {
  if (!Array.isArray(content)) return []
  return content.map((part, index) => normalizeContentPart(part, index))
}

class ToolRendererErrorBoundary extends React.Component<
  {
    part: ToolResultContentPart
    children: React.ReactNode
  },
  { error: Error | null }
> {
  state = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidUpdate(prevProps: { part: ToolResultContentPart }) {
    if (prevProps.part !== this.props.part && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="space-y-3">
        <div className="border-status-warning/35 bg-status-warning/10 text-status-warning rounded-md border px-3 py-2 text-xs">
          This tool result could not be rendered safely. Showing raw payload instead.
        </div>
        <pre className="rk-code-block max-h-72 text-[11px]">
          {stringifyFallback(this.props.part.toolResult ?? this.props.part)}
        </pre>
      </div>
    )
  }
}

const CONTENT_RENDERERS: Record<
  string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  React.FC<{ part: ToolResultContentPart; onAction?: (action: string, data: any) => void }>
> = {
  command_result: CommandResultRenderer,
  script_result: ScriptResultRenderer,
  json: JsonResultRenderer,
  web_search: WebSearchResultRenderer,
  http_request: HttpRequestRenderer,
  file_read: FileReadRenderer,
  list_files: ListFilesRenderer,
  file_search: FileSearchRenderer,
  write_file: WriteFileRenderer,
  git_diff: GitDiffRenderer,
  git_log: GitLogRenderer,
  git_branches: GitBranchesRenderer,
  git_blame: GitBlameRenderer,
  file_stat: FileStatRenderer,
  file_head_tail: FileStatRenderer,
  workspace_stats: WorkspaceStatsRenderer,
  code_map: WorkspaceStatsRenderer,
  dependency_graph: WorkspaceStatsRenderer,
  symbol_search: SymbolRenderer,
  symbol_references: SymbolRenderer,
  file_outline: FileOutlineRenderer,
  route_map: RouteMapRenderer,
  test_map: RouteMapRenderer,
  config_inventory: RouteMapRenderer,
  env_inventory: RouteMapRenderer,
  lockfile_summary: RouteMapRenderer,
  secret_scan: SecretScanRenderer,
  dependency_audit: DependencyAuditRenderer,
  license_summary: DependencyAuditRenderer,
  lockfile_risk_summary: DependencyAuditRenderer,
  sbom_generate: DependencyAuditRenderer,
  duplicate_code_candidates: CodeQualityRenderer,
  dead_code_candidates: CodeQualityRenderer,
  semgrep_scan: CodeQualityRenderer,
  dockerfile_scan: CodeQualityRenderer,
  csv_preview: TableRenderer,
  csv_query: TableRenderer,
  html_table_extract: TableRenderer,
  sqlite_query: TableRenderer,
  browser_table_extract: TableRenderer,
  json_query: DataQueryRenderer,
  yaml_query: DataQueryRenderer,
  yaml_patch: DataQueryRenderer,
  token_count: TextAnalysisRenderer,
  text_keywords: TextAnalysisRenderer,
  text_entities: TextAnalysisRenderer,
  markdown_frontmatter: TextAnalysisRenderer,
  image_exif: ImageExifRenderer,
  image_ocr: ImageAnalysisRenderer,
  image_diff: ImageAnalysisRenderer,
  svg_optimize: ImageAnalysisRenderer,
  git_status: GitStatusRenderer,
  git_changed_files: GitStatusRenderer,
  git_staged_diff: GitStatusRenderer,
  git_show: GitShowRenderer,
  git_compare_refs: GitShowRenderer,
  git_conflicts: GitConflictsRenderer,
  git_tags: GitTagsRenderer,
  git_remote_info: GitTagsRenderer,
  git_commit_search: GitCommitSearchRenderer,
  git_patch_preview: GitCommitSearchRenderer,
  git_apply_patch: GitCommitSearchRenderer,
  link_preview: LinkPreviewRenderer,
  npm_package_info: NpmPackageRenderer,
  extract_todos: ExtractTodosRenderer,
  hash: HashRenderer,
  base64_encode: Base64Renderer,
  base64_decode: Base64Renderer,
  archive: ArchiveRenderer,
  text_output: TextOutputRenderer,
  image_info: ImageInfoRenderer,
  markdown_to_pdf: PdfRenderer,

  browser_navigate: BrowserResultRenderer,
  browser_result: BrowserResultRenderer,
  browser_screenshot: BrowserResultRenderer,
  browser_get_markdown: BrowserResultRenderer,

  browser_vision_control: BrowserControlRenderer,
  browser_control: BrowserControlRenderer,
  browser_scroll: BrowserControlRenderer,
  browser_hotkey: BrowserControlRenderer,
  browser_key_press: BrowserControlRenderer,
  browser_action: BrowserControlRenderer,

  browser_click: ClickActionRenderer,
  browser_double_click: ClickActionRenderer,
  browser_right_click: ClickActionRenderer,
  browser_hover: HoverActionRenderer,
  browser_drag: DragActionRenderer,
  browser_drag_and_drop: DragActionRenderer,
  browser_form_input_fill: FormFillRenderer,
  browser_type: FormFillRenderer,
  browser_wait: WaitActionRenderer,
  browser_extract: DataExtractionRenderer,
  browser_get_text: DataExtractionRenderer,
  browser_get_links: DataExtractionRenderer,
  browser_get_clickable_elements: DataExtractionRenderer,

  browser_evaluate: BrowserEvalRenderer,
  browser_console_logs: BrowserLogsRenderer,
  browser_network_log: BrowserLogsRenderer,
  browser_storage_snapshot: BrowserStorageRenderer,
  browser_accessibility_snapshot: BrowserStorageRenderer,
  browser_set_viewport: BrowserStorageRenderer,
  browser_selector_screenshot: BrowserScreenshotExtRenderer,
  browser_full_page_screenshot: BrowserScreenshotExtRenderer,
  browser_print_pdf: BrowserScreenshotExtRenderer,
  browser_downloads: BrowserScreenshotExtRenderer,
  browser_form_schema: BrowserScreenshotExtRenderer,
  visit_link: VisitLinkRenderer,
  robots_txt: WebMetadataRenderer,
  sitemap_fetch: WebMetadataRenderer,
  rss_fetch: WebMetadataRenderer,
  page_metadata_batch: WebMetadataRenderer,
  page_diff_snapshot: WebMetadataRenderer,
  domain_info: DomainInfoRenderer,
  github_repo_info: DomainInfoRenderer,
  citation_metadata: DomainInfoRenderer,
  package_compare: DomainInfoRenderer,
  fetch_many: FetchManyRenderer,
  search_batch: FetchManyRenderer,

  node_codeact: CodeActRenderer,
  python_codeact: CodeActRenderer,
  shell_codeact: CodeActRenderer,
  codeact_memory: CodeActRenderer,

  search: DeepResearchRenderer,
  enhanced_visit: DeepResearchRenderer,
  deep_dive: DeepResearchRenderer,
  research_plan: DeepResearchRenderer,
  research_report: DeepResearchRenderer,

  generate_latex_pdf: PdfRenderer,
  latex_pdf: PdfRenderer,
  pdf_generate: PdfRenderer,

  artifact_list: ArtifactRenderer,
  artifact_read: ArtifactRenderer,
  artifact_delete: ArtifactRenderer,
  asset_manifest: ArtifactRenderer,

  dev_server_start: DevServerRenderer,
  dev_server_stop: DevServerRenderer,
  dev_server_status: DevServerRenderer,
  port_probe: DevServerRenderer,
  http_health_check: DevServerRenderer,

  npm_scripts: NpmScriptsRenderer,
  run_npm_script: NpmScriptsRenderer,

  pdf_extract_text: DocumentExtractRenderer,
  docx_extract_text: DocumentExtractRenderer,

  url_safety_check: SecurityCheckRenderer,
  workspace_permissions_scan: SecurityCheckRenderer,

  session_list: SessionListRenderer,
  session_inspect: SessionInspectRenderer,
  replay_summary: ReplaySummaryRenderer,
  replay_search: ReplaySearchRenderer,
  trace_summary: TraceSummaryRenderer,
  token_usage_report: TokenUsageReportRenderer,
  background_jobs_summary: BackgroundJobsRenderer,
  settings_summary: SettingsSummaryRenderer,

  // Audit findings
  tailwind_class_audit: AuditFindingsRenderer,
  accessibility_audit_static: AuditFindingsRenderer,
  component_design_audit: AuditFindingsRenderer,
  responsive_breakpoint_audit: AuditFindingsRenderer,
  module_boundary_check: AuditFindingsRenderer,
  client_boundary_audit: AuditFindingsRenderer,
  auth_flow_audit: AuditFindingsRenderer,
  permission_boundary_audit: AuditFindingsRenderer,
  dangerous_command_detect: AuditFindingsRenderer,
  env_usage_audit: AuditFindingsRenderer,
  client_secret_leak_check: AuditFindingsRenderer,
  render_risk_audit: AuditFindingsRenderer,
  agent_diff_review: AuditFindingsRenderer,
  agent_self_check: AuditFindingsRenderer,
  agents_md_sync: AuditFindingsRenderer,
  docs_missing_report: AuditFindingsRenderer,
  prompt_lint: AuditFindingsRenderer,
  llm_response_audit: AuditFindingsRenderer,

  safe_rename_symbol: PatchPreviewRenderer,
  move_symbol_to_file: PatchPreviewRenderer,
  extract_function: PatchPreviewRenderer,
  extract_component: PatchPreviewRenderer,
  barrel_export_sync: PatchPreviewRenderer,
  import_rewrite: PatchPreviewRenderer,
  dead_imports_fix: PatchPreviewRenderer,
  generate_unit_test_draft: PatchPreviewRenderer,
  tool_contract_test_generate: PatchPreviewRenderer,
  readme_generate_or_update: PatchPreviewRenderer,
  changelog_generate: PatchPreviewRenderer,
  pr_description_generate: PatchPreviewRenderer,
  env_example_generate: PatchPreviewRenderer,

  component_map: CodeMapFlowRenderer,
  hook_map: CodeMapFlowRenderer,
  api_contract_map: CodeMapFlowRenderer,
  api_route_map: CodeMapFlowRenderer,
  state_flow_trace: CodeMapFlowRenderer,
  event_handler_trace: CodeMapFlowRenderer,
  type_dependency_trace: CodeMapFlowRenderer,
  prop_drilling_trace: CodeMapFlowRenderer,

  architecture_summary: ArchitectureRenderer,
  feature_map: ArchitectureRenderer,
  ownership_map: ArchitectureRenderer,
  coupling_report: ArchitectureRenderer,
  circular_dependency_check: ArchitectureRenderer,
  complexity_hotspots: ArchitectureRenderer,

  test_gap_analysis: TestGapRenderer,

  agent_plan_create: AgentPlanRenderer,
  agent_plan_check: AgentPlanRenderer,
  agent_worklog: AgentPlanRenderer,
  agent_regression_risk: AgentPlanRenderer,

  screenshot_compare: ScreenshotCompareRenderer,
  page_visual_audit: ScreenshotCompareRenderer,
  responsive_screenshot_matrix: ScreenshotCompareRenderer,

  prisma_schema_inspect: SchemaRenderer,
  drizzle_schema_inspect: SchemaRenderer,
  sql_schema_map: SchemaRenderer,
  erd_generate: SchemaRenderer,

  github_pr_summary: GithubRenderer,
  github_issue_triage: GithubRenderer,
  github_action_logs_analyze: GithubRenderer,

  bundle_analyze_summary: SizeReportRenderer,
  large_dependency_report: SizeReportRenderer,
  asset_size_audit: SizeReportRenderer,

  workflow_inventory: WorkflowCardRenderer,
  workflow_validate: WorkflowCardRenderer,
  workflow_compare: WorkflowCardRenderer,

  csv_profile: DataProfileRenderer,
  json_profile: DataProfileRenderer,
  log_parse: DataProfileRenderer,
  log_error_cluster: DataProfileRenderer,

  docs_index: ListFilesRenderer,
  json_output_repair: JsonResultRenderer,
  schema_from_examples: JsonResultRenderer,
  examples_validate_against_schema: JsonResultRenderer,
  setup_health_check: SystemInfoRenderer,
  onboarding_summary: TextOutputRenderer,
  release_notes_generate: TextOutputRenderer,
  curl_from_api_call: ScriptResultRenderer,
  postman_collection_generate: JsonResultRenderer,
  migration_diff_summary: TextOutputRenderer,
  branch_cleanup_candidates: GitBranchesRenderer,
  dom_layout_box_map: JsonResultRenderer,
  css_computed_style_extract: JsonResultRenderer,
  eval_case_generate: JsonResultRenderer,
  mock_workspace_create: ListFilesRenderer,

  // Cluster A — developer utilities
  jwt_decode: JwtDecodeRenderer,
  regex_match: RegexMatchRenderer,
  uuid_generate: UuidGenerateRenderer,
  url_parse: UrlParseRenderer,
  cron_explain: CronExplainRenderer,
  color_convert: ColorConvertRenderer,

  // Cluster B — diff & comparison
  text_diff: TextDiffRenderer,
  json_diff: JsonDiffRenderer,

  // Cluster C — git write
  git_commit: GitCommitRenderer,
  git_checkout: GitCheckoutRenderer,
  git_stash: GitStashRenderer,
  git_push: GitPushRenderer,

  // Cluster D — system & process
  process_list: ProcessListRenderer,
  system_info: SystemInfoRenderer,
  clipboard_read: ClipboardReadRenderer,
  clipboard_write: ClipboardWriteRenderer,
  desktop_notify: DesktopNotifyRenderer,

  // Cluster E — network diagnostics
  dns_lookup: DnsLookupRenderer,
  ssl_check: SslCheckRenderer,
  ping: PingRenderer,
  whois_lookup: WhoisLookupRenderer,

  // Cluster F — API development
  openapi_inspect: OpenApiInspectRenderer,
  graphql_introspect: GraphqlIntrospectRenderer,

  // Cluster G — image tools
  image_resize: ImageResizeRenderer,
  image_crop: ImageCropRenderer,

  // Cluster H — data format
  json_schema_validate: JsonSchemaValidateRenderer,
  csv_to_json: CsvToJsonRenderer,
  json_to_csv: JsonToCsvRenderer,
  xml_to_json: XmlToJsonRenderer,
  xpath_query: XpathQueryRenderer,

  generic: GenericResultRenderer,
}

const TOOL_ACCENT_MAP: Record<string, string> = {
  command_result: "border-tool-command/25",
  script_result: "border-tool-command/25",
  json: "border-tool-json/25",
  web_search: "border-tool-search/25",
  http_request: "border-tool-browser/25",
  file_search: "border-tool-command/25",
  markdown_to_pdf: "border-tool-doc/25",
  browser_navigate: "border-tool-browser/25",
  browser_result: "border-tool-browser/25",
  browser_screenshot: "border-tool-browser/25",
  browser_get_markdown: "border-tool-browser/25",
  browser_vision_control: "border-tool-action/25",
  browser_control: "border-tool-action/25",
  browser_scroll: "border-tool-action/25",
  browser_hotkey: "border-tool-action/25",
  browser_key_press: "border-tool-action/25",
  browser_action: "border-tool-action/25",
  browser_click: "border-tool-action/25",
  browser_double_click: "border-tool-action/25",
  browser_right_click: "border-tool-action/25",
  browser_hover: "border-tool-action/25",
  browser_drag: "border-tool-action/25",
  browser_drag_and_drop: "border-tool-action/25",
  browser_form_input_fill: "border-tool-action/25",
  browser_form_fill_batch: "border-tool-action/25",
  browser_type: "border-tool-action/25",
  browser_wait: "border-tool-action/25",
  browser_wait_for: "border-tool-action/25",
  browser_extract: "border-tool-data/25",
  browser_get_text: "border-tool-data/25",
  browser_get_links: "border-tool-data/25",
  browser_get_clickable_elements: "border-tool-data/25",
  node_codeact: "border-tool-code/20",
  python_codeact: "border-tool-code/20",
  shell_codeact: "border-tool-code/20",
  codeact_memory: "border-tool-code/20",
  search: "border-tool-research/25",
  enhanced_visit: "border-tool-research/25",
  deep_dive: "border-tool-research/25",
  research_plan: "border-tool-research/25",
  research_report: "border-tool-research/25",
  generate_latex_pdf: "border-tool-doc/25",
  latex_pdf: "border-tool-doc/25",
  pdf_generate: "border-tool-doc/25",
  execute_command: "border-tool-command/25",
  shell_execute: "border-tool-command/25",
  bash: "border-tool-command/25",
  python_execute: "border-tool-command/25",
  node_execute: "border-tool-command/25",
  visit_link: "border-tool-browser/25",
  file_read: "border-tool-code/25",
  list_files: "border-tool-code/25",
  write_file: "border-tool-command/25",
  file_replace: "border-tool-json/25",
  json_patch: "border-tool-json/25",
  yaml_patch: "border-tool-json/25",
  archive_create: "border-tool-command/25",
  archive_extract: "border-tool-command/25",
  base64_encode: "border-tool-json/25",
  base64_decode: "border-tool-json/25",
  hash: "border-tool-json/25",
  text_summarize: "border-tool-research/25",
  text_rewrite: "border-tool-research/25",
  extract_todos: "border-tool-research/25",
  image_info: "border-tool-json/25",
  image_convert: "border-tool-json/25",
  link_preview: "border-tool-browser/25",
  npm_package_info: "border-tool-browser/25",
  file_stat: "border-tool-code/25",
  file_head_tail: "border-tool-code/25",
  workspace_stats: "border-tool-data/25",
  code_map: "border-tool-data/25",
  dependency_graph: "border-tool-data/25",
  symbol_search: "border-tool-search/25",
  symbol_references: "border-tool-search/25",
  file_outline: "border-tool-code/25",
  route_map: "border-tool-data/25",
  test_map: "border-tool-data/25",
  config_inventory: "border-tool-data/25",
  env_inventory: "border-tool-data/25",
  lockfile_summary: "border-tool-data/25",
  csv_preview: "border-tool-data/25",
  csv_query: "border-tool-data/25",
  html_table_extract: "border-tool-data/25",
  sqlite_query: "border-tool-data/25",
  browser_table_extract: "border-tool-data/25",
  json_query: "border-tool-json/25",
  yaml_query: "border-tool-json/25",
  token_count: "border-tool-research/25",
  text_keywords: "border-tool-research/25",
  text_entities: "border-tool-research/25",
  markdown_frontmatter: "border-tool-json/25",
  image_exif: "border-tool-json/25",
  image_ocr: "border-tool-data/25",
  image_diff: "border-tool-data/25",
  svg_optimize: "border-tool-code/25",
  browser_evaluate: "border-tool-browser/25",
  browser_console_logs: "border-tool-browser/25",
  browser_network_log: "border-tool-browser/25",
  browser_storage_snapshot: "border-tool-data/25",
  browser_accessibility_snapshot: "border-tool-data/25",
  browser_set_viewport: "border-tool-action/25",
  browser_selector_screenshot: "border-tool-browser/25",
  browser_full_page_screenshot: "border-tool-browser/25",
  browser_print_pdf: "border-tool-doc/25",
  browser_downloads: "border-tool-data/25",
  browser_form_schema: "border-tool-data/25",
  robots_txt: "border-tool-data/25",
  sitemap_fetch: "border-tool-data/25",
  rss_fetch: "border-tool-research/25",
  page_metadata_batch: "border-tool-data/25",
  page_diff_snapshot: "border-tool-data/25",
  domain_info: "border-tool-browser/25",
  github_repo_info: "border-tool-browser/25",
  citation_metadata: "border-tool-research/25",
  package_compare: "border-tool-data/25",
  fetch_many: "border-tool-browser/25",
  search_batch: "border-tool-search/25",
  secret_scan: "border-tool-command/25",
  dependency_audit: "border-tool-data/25",
  license_summary: "border-tool-data/25",
  lockfile_risk_summary: "border-tool-data/25",
  sbom_generate: "border-tool-data/25",
  duplicate_code_candidates: "border-tool-search/25",
  dead_code_candidates: "border-tool-search/25",
  semgrep_scan: "border-tool-search/25",
  dockerfile_scan: "border-tool-code/25",
  git_diff_summary: "border-tool-code/25",
  git_log_summary: "border-tool-code/25",
  git_branches: "border-tool-code/25",
  git_blame: "border-tool-code/25",
  git_file_history: "border-tool-code/25",
  git_status: "border-tool-code/25",
  git_changed_files: "border-tool-code/25",
  git_staged_diff: "border-tool-code/25",
  git_show: "border-tool-code/25",
  git_compare_refs: "border-tool-code/25",
  git_conflicts: "border-tool-code/25",
  git_tags: "border-tool-code/25",
  git_remote_info: "border-tool-code/25",
  git_commit_search: "border-tool-code/25",
  git_patch_preview: "border-tool-code/25",
  git_apply_patch: "border-tool-command/25",
  artifact_list: "border-tool-data/25",
  artifact_read: "border-tool-code/25",
  artifact_delete: "border-tool-command/25",
  asset_manifest: "border-tool-data/25",
  dev_server_start: "border-tool-command/25",
  dev_server_stop: "border-tool-command/25",
  dev_server_status: "border-tool-data/25",
  port_probe: "border-tool-browser/25",
  http_health_check: "border-tool-browser/25",
  npm_scripts: "border-tool-data/25",
  run_npm_script: "border-tool-command/25",
  pdf_extract_text: "border-tool-doc/25",
  docx_extract_text: "border-tool-doc/25",
  url_safety_check: "border-tool-search/25",
  workspace_permissions_scan: "border-tool-data/25",
  download_fetch: "border-tool-json/25",
  session_list: "border-tool-data/25",
  session_inspect: "border-tool-data/25",
  replay_summary: "border-tool-data/25",
  replay_search: "border-tool-search/25",
  trace_summary: "border-tool-data/25",
  token_usage_report: "border-tool-data/25",
  background_jobs_summary: "border-tool-data/25",
  settings_summary: "border-tool-json/25",

  // Audit findings
  tailwind_class_audit: "border-tool-search/25",
  accessibility_audit_static: "border-tool-search/25",
  component_design_audit: "border-tool-search/25",
  responsive_breakpoint_audit: "border-tool-search/25",
  module_boundary_check: "border-tool-code/25",
  client_boundary_audit: "border-tool-code/25",
  auth_flow_audit: "border-tool-search/25",
  permission_boundary_audit: "border-tool-search/25",
  dangerous_command_detect: "border-tool-search/25",
  env_usage_audit: "border-tool-search/25",
  client_secret_leak_check: "border-tool-search/25",
  render_risk_audit: "border-tool-code/25",
  agent_diff_review: "border-tool-code/25",
  agent_self_check: "border-tool-code/25",
  agents_md_sync: "border-tool-search/25",
  docs_missing_report: "border-tool-search/25",
  prompt_lint: "border-tool-search/25",
  llm_response_audit: "border-tool-search/25",
  safe_rename_symbol: "border-tool-code/25",
  move_symbol_to_file: "border-tool-code/25",
  extract_function: "border-tool-code/25",
  extract_component: "border-tool-code/25",
  barrel_export_sync: "border-tool-code/25",
  import_rewrite: "border-tool-code/25",
  dead_imports_fix: "border-tool-code/25",
  generate_unit_test_draft: "border-tool-code/25",
  tool_contract_test_generate: "border-tool-code/25",
  readme_generate_or_update: "border-tool-doc/25",
  changelog_generate: "border-tool-doc/25",
  pr_description_generate: "border-tool-code/25",
  env_example_generate: "border-tool-code/25",
  component_map: "border-tool-code/25",
  hook_map: "border-tool-code/25",
  api_contract_map: "border-tool-code/25",
  api_route_map: "border-tool-code/25",
  state_flow_trace: "border-tool-code/25",
  event_handler_trace: "border-tool-code/25",
  type_dependency_trace: "border-tool-code/25",
  prop_drilling_trace: "border-tool-code/25",
  architecture_summary: "border-tool-code/25",
  feature_map: "border-tool-code/25",
  ownership_map: "border-tool-code/25",
  coupling_report: "border-tool-code/25",
  circular_dependency_check: "border-tool-code/25",
  complexity_hotspots: "border-tool-data/25",
  test_gap_analysis: "border-tool-code/25",
  agent_plan_create: "border-tool-code/25",
  agent_plan_check: "border-tool-code/25",
  agent_worklog: "border-tool-code/25",
  agent_regression_risk: "border-tool-code/25",
  screenshot_compare: "border-tool-browser/25",
  page_visual_audit: "border-tool-browser/25",
  responsive_screenshot_matrix: "border-tool-browser/25",
  prisma_schema_inspect: "border-tool-json/25",
  drizzle_schema_inspect: "border-tool-json/25",
  sql_schema_map: "border-tool-json/25",
  erd_generate: "border-tool-json/25",
  github_pr_summary: "border-tool-research/25",
  github_issue_triage: "border-tool-research/25",
  github_action_logs_analyze: "border-tool-research/25",
  bundle_analyze_summary: "border-tool-data/25",
  large_dependency_report: "border-tool-data/25",
  asset_size_audit: "border-tool-data/25",
  workflow_inventory: "border-tool-json/25",
  workflow_validate: "border-tool-json/25",
  workflow_compare: "border-tool-json/25",
  csv_profile: "border-tool-data/25",
  json_profile: "border-tool-data/25",
  log_parse: "border-tool-data/25",
  log_error_cluster: "border-tool-data/25",
  docs_index: "border-tool-code/25",
  json_output_repair: "border-tool-json/25",
  schema_from_examples: "border-tool-json/25",
  examples_validate_against_schema: "border-tool-json/25",
  setup_health_check: "border-tool-data/25",
  onboarding_summary: "border-tool-doc/25",
  release_notes_generate: "border-tool-doc/25",
  curl_from_api_call: "border-tool-code/25",
  postman_collection_generate: "border-tool-json/25",
  migration_diff_summary: "border-tool-doc/25",
  branch_cleanup_candidates: "border-tool-code/25",
  dom_layout_box_map: "border-tool-json/25",
  css_computed_style_extract: "border-tool-json/25",
  eval_case_generate: "border-tool-json/25",
  mock_workspace_create: "border-tool-code/25",

  // Cluster A — developer utilities
  jwt_decode: "border-tool-json/25",
  regex_match: "border-tool-search/25",
  uuid_generate: "border-tool-transforms/25",
  url_parse: "border-tool-browser/25",
  cron_explain: "border-tool-json/25",
  color_convert: "border-tool-transforms/25",

  // Cluster B — diff & comparison
  text_diff: "border-tool-code/25",
  json_diff: "border-tool-json/25",

  // Cluster C — git write
  git_commit: "border-tool-command/25",
  git_checkout: "border-tool-command/25",
  git_stash: "border-tool-command/25",
  git_push: "border-tool-command/25",

  // Cluster D — system & process
  process_list: "border-tool-data/25",
  system_info: "border-tool-data/25",
  clipboard_read: "border-tool-data/25",
  clipboard_write: "border-tool-command/25",
  desktop_notify: "border-tool-command/25",

  // Cluster E — network diagnostics
  dns_lookup: "border-tool-browser/25",
  ssl_check: "border-tool-browser/25",
  ping: "border-tool-browser/25",
  whois_lookup: "border-tool-research/25",

  // Cluster F — API development
  openapi_inspect: "border-tool-data/25",
  graphql_introspect: "border-tool-data/25",

  // Cluster G — image tools
  image_resize: "border-tool-data/25",
  image_crop: "border-tool-data/25",

  // Cluster H — data format
  json_schema_validate: "border-tool-json/25",
  csv_to_json: "border-tool-data/25",
  json_to_csv: "border-tool-data/25",
  xml_to_json: "border-tool-json/25",
  xpath_query: "border-tool-search/25",

  generic: "border-tool-generic/25",
}

/**
 * Routes raw tool result payloads to specialized renderers so the workspace panel can display
 * browser, file, command, git, network, and artifact outputs in a readable form.
 */
export function ToolResultRenderer({
  content,
  onAction,
  className = "",
}: {
  content: ToolResultContentPart[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAction?: (action: string, data: any) => void
  className?: string
}) {
  const safeContent = normalizeContent(content)

  if (safeContent.length === 0) {
    return <div className="rk-empty-state p-4">No content to display</div>
  }

  const getAccent = (toolName?: string, type?: string, rendererKey?: string) => {
    const normalizedTool = toolName?.toLowerCase()
    const normalizedType = type?.toLowerCase()
    const normalizedRenderer = rendererKey?.toLowerCase()
    const direct =
      (normalizedTool && TOOL_ACCENT_MAP[normalizedTool]) ||
      (normalizedRenderer && TOOL_ACCENT_MAP[normalizedRenderer]) ||
      (normalizedType && TOOL_ACCENT_MAP[normalizedType])
    if (direct) return direct
    if (!normalizedTool) return "border-tool-generic/25"
    if (normalizedTool.includes("browser")) return "border-tool-browser/25"
    if (normalizedTool.includes("search")) return "border-tool-search/25"
    if (normalizedTool.includes("code")) return "border-tool-code/20"
    if (
      normalizedTool.includes("command") ||
      normalizedTool.includes("shell") ||
      normalizedTool.includes("execute")
    )
      return "border-tool-command/25"
    if (normalizedTool.includes("pdf") || normalizedTool.includes("latex"))
      return "border-tool-doc/25"
    if (normalizedTool.includes("research") || normalizedTool.includes("enhanced"))
      return "border-tool-research/25"
    if (normalizedTool.includes("extract") || normalizedTool.includes("data"))
      return "border-tool-data/25"
    if (normalizedTool.includes("json")) return "border-tool-json/25"
    return "border-tool-generic/25"
  }

  return (
    <div className={`w-full min-w-0 space-y-4 ${className}`}>
      {safeContent.map((part, index) => {
        let rendererKey = part.type

        if (part.toolName) {
          const directKey = part.toolName
          const toolNameMap: Record<string, string> = {
            execute_command: "command_result",
            shell_execute: "command_result",
            bash: "command_result",

            python_execute: "script_result",
            node_execute: "script_result",

            web_search: "web_search",
            visit_link: "browser_result",
            file_read: "file_read",
            list_files: "list_files",
            write_file: "write_file",
            file_search: "file_search",
            http_request: "http_request",
            download_fetch: "http_request",
            file_replace: "json",
            json_patch: "json",
            yaml_patch: "json",
            archive_create: "archive",
            archive_extract: "archive",
            base64_encode: "base64_encode",
            base64_decode: "base64_decode",
            hash: "hash",
            text_summarize: "text_output",
            text_rewrite: "text_output",
            extract_todos: "extract_todos",
            markdown_to_pdf: "markdown_to_pdf",
            image_info: "image_info",
            image_convert: "json",
            link_preview: "link_preview",
            npm_package_info: "npm_package_info",
            git_diff_summary: "git_diff",
            git_log_summary: "git_log",
            git_branches: "git_branches",
            git_blame: "git_blame",
            git_file_history: "git_log",

            browser_navigate: "browser_navigate",
            browser_screenshot: "browser_screenshot",
            browser_get_markdown: "browser_get_markdown",
            browser_evaluate: "browser_result",

            browser_vision_control: "browser_vision_control",
            browser_control: "browser_control",
            browser_action: "browser_action",
            browser_scroll: "browser_scroll",
            browser_hotkey: "browser_hotkey",
            browser_key_press: "browser_key_press",

            browser_click: "browser_click",
            browser_double_click: "browser_double_click",
            browser_right_click: "browser_right_click",
            browser_hover: "browser_hover",
            browser_drag: "browser_drag",
            browser_drag_and_drop: "browser_drag_and_drop",
            browser_type: "browser_type",
            browser_form_input_fill: "browser_form_input_fill",
            browser_form_fill_batch: "browser_form_input_fill",
            browser_wait: "browser_wait",
            browser_wait_for: "browser_wait",
            browser_extract: "browser_extract",
            browser_get_text: "browser_get_text",
            browser_get_links: "browser_get_links",
            browser_get_clickable_elements: "browser_get_clickable_elements",

            node_codeact: "node_codeact",
            python_codeact: "python_codeact",
            shell_codeact: "shell_codeact",
            codeact_memory: "codeact_memory",

            search: "search",
            enhanced_visit: "enhanced_visit",
            deep_dive: "deep_dive",
            research_plan: "research_plan",
            research_report: "research_report",

            generate_latex_pdf: "generate_latex_pdf",
            latex_pdf: "generate_latex_pdf",
            pdf_generate: "generate_latex_pdf",

            tailwind_class_audit: "tailwind_class_audit",
            accessibility_audit_static: "accessibility_audit_static",
            component_design_audit: "component_design_audit",
            responsive_breakpoint_audit: "responsive_breakpoint_audit",
            module_boundary_check: "module_boundary_check",
            client_boundary_audit: "client_boundary_audit",
            auth_flow_audit: "auth_flow_audit",
            permission_boundary_audit: "permission_boundary_audit",
            dangerous_command_detect: "dangerous_command_detect",
            env_usage_audit: "env_usage_audit",
            client_secret_leak_check: "client_secret_leak_check",
            render_risk_audit: "render_risk_audit",
            agent_diff_review: "agent_diff_review",
            agent_self_check: "agent_self_check",
            agents_md_sync: "agents_md_sync",
            docs_missing_report: "docs_missing_report",
            prompt_lint: "prompt_lint",
            llm_response_audit: "llm_response_audit",
            safe_rename_symbol: "safe_rename_symbol",
            move_symbol_to_file: "move_symbol_to_file",
            extract_function: "extract_function",
            extract_component: "extract_component",
            barrel_export_sync: "barrel_export_sync",
            import_rewrite: "import_rewrite",
            dead_imports_fix: "dead_imports_fix",
            generate_unit_test_draft: "generate_unit_test_draft",
            tool_contract_test_generate: "tool_contract_test_generate",
            readme_generate_or_update: "readme_generate_or_update",
            changelog_generate: "changelog_generate",
            pr_description_generate: "pr_description_generate",
            env_example_generate: "env_example_generate",
            component_map: "component_map",
            hook_map: "hook_map",
            api_contract_map: "api_contract_map",
            api_route_map: "api_route_map",
            state_flow_trace: "state_flow_trace",
            event_handler_trace: "event_handler_trace",
            type_dependency_trace: "type_dependency_trace",
            prop_drilling_trace: "prop_drilling_trace",
            architecture_summary: "architecture_summary",
            feature_map: "feature_map",
            ownership_map: "ownership_map",
            coupling_report: "coupling_report",
            circular_dependency_check: "circular_dependency_check",
            complexity_hotspots: "complexity_hotspots",
            test_gap_analysis: "test_gap_analysis",
            agent_plan_create: "agent_plan_create",
            agent_plan_check: "agent_plan_check",
            agent_worklog: "agent_worklog",
            agent_regression_risk: "agent_regression_risk",
            screenshot_compare: "screenshot_compare",
            page_visual_audit: "page_visual_audit",
            responsive_screenshot_matrix: "responsive_screenshot_matrix",
            prisma_schema_inspect: "prisma_schema_inspect",
            drizzle_schema_inspect: "drizzle_schema_inspect",
            sql_schema_map: "sql_schema_map",
            erd_generate: "erd_generate",
            github_pr_summary: "github_pr_summary",
            github_issue_triage: "github_issue_triage",
            github_action_logs_analyze: "github_action_logs_analyze",
            bundle_analyze_summary: "bundle_analyze_summary",
            large_dependency_report: "large_dependency_report",
            asset_size_audit: "asset_size_audit",
            workflow_inventory: "workflow_inventory",
            workflow_validate: "workflow_validate",
            workflow_compare: "workflow_compare",
            csv_profile: "csv_profile",
            json_profile: "json_profile",
            log_parse: "log_parse",
            log_error_cluster: "log_error_cluster",
            docs_index: "docs_index",
            json_output_repair: "json_output_repair",
            schema_from_examples: "schema_from_examples",
            examples_validate_against_schema: "examples_validate_against_schema",
            setup_health_check: "setup_health_check",
            onboarding_summary: "onboarding_summary",
            release_notes_generate: "release_notes_generate",
            curl_from_api_call: "curl_from_api_call",
            postman_collection_generate: "postman_collection_generate",
            migration_diff_summary: "migration_diff_summary",
            branch_cleanup_candidates: "branch_cleanup_candidates",
            dom_layout_box_map: "dom_layout_box_map",
            css_computed_style_extract: "css_computed_style_extract",
            eval_case_generate: "eval_case_generate",
            mock_workspace_create: "mock_workspace_create",
          }

          const mappedKey = toolNameMap[part.toolName]
          rendererKey = mappedKey || (CONTENT_RENDERERS[directKey] ? directKey : part.type)
        }

        if (part.script || part.interpreter) {
          rendererKey = "script_result"
        }

        if (part.command || (part.stdout && !part.script)) {
          rendererKey = "command_result"
        }

        const Renderer = CONTENT_RENDERERS[rendererKey] || CONTENT_RENDERERS.generic
        const rawSteps =
          part.toolResult && typeof part.toolResult === "object"
            ? (part.toolResult as { steps?: unknown }).steps
            : null
        const steps = Array.isArray(rawSteps) ? rawSteps : []

        const normalizedSteps = steps.map((step, stepIndex) => {
          if (typeof step === "string") {
            return { label: `Step ${stepIndex + 1}`, detail: step, at: "" }
          }
          if (step && typeof step === "object") {
            const record = step as Record<string, unknown>
            const label = typeof record.label === "string" ? record.label : `Step ${stepIndex + 1}`
            const detail =
              typeof record.detail === "string"
                ? record.detail
                : typeof record.text === "string"
                  ? record.text
                  : ""
            const at = typeof record.at === "string" ? record.at : ""
            const fallback = detail ? "" : JSON.stringify(record)
            return { label, detail: detail || fallback, at }
          }
          return { label: `Step ${stepIndex + 1}`, detail: String(step), at: "" }
        })

        const accentClass = getAccent(part.toolName, part.type, rendererKey)

        return (
          <div
            key={index}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            id={`tool-result-${(part as any).id ?? index}`}
            className={`rk-tool-card space-y-3 ${accentClass}`}
          >
            <div className="w-full min-w-0">
              <ToolRendererErrorBoundary part={part}>
                <Renderer part={part} onAction={onAction} />
              </ToolRendererErrorBoundary>
            </div>
            {normalizedSteps.length > 0 ? (
              <div className="border-border border-t pt-3">
                <div className="rk-section-label mb-2">Steps</div>
                <ol className="space-y-3">
                  {normalizedSteps.map((step, stepIndex) => {
                    const timestamp =
                      step.at && !Number.isNaN(new Date(step.at).getTime())
                        ? new Date(step.at).toLocaleTimeString()
                        : step.at
                    return (
                      <li
                        key={stepIndex}
                        className="before:bg-border relative pl-4 before:absolute before:top-1.75 before:left-0 before:h-1.5 before:w-1.5 before:rounded-full"
                      >
                        <div className="flex flex-col items-start gap-1 sm:flex-row sm:justify-between sm:gap-3">
                          <span className="text-foreground min-w-0 text-sm font-medium wrap-anywhere">
                            {step.label}
                          </span>
                          {timestamp ? (
                            <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                              {timestamp}
                            </span>
                          ) : null}
                        </div>
                        {step.detail ? (
                          <div className="text-muted-foreground mt-0.5 text-xs leading-relaxed wrap-anywhere">
                            {step.detail}
                          </div>
                        ) : null}
                      </li>
                    )
                  })}
                </ol>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
