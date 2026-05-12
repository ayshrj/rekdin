"use client"

import React from "react"

export { toolLabels } from "../tool-labels"

import { GraphqlIntrospectRenderer, OpenApiInspectRenderer } from "./api-spec-renderer"
import { ArchiveRenderer } from "./archive-renderer"
import { ArtifactRenderer } from "./artifact-renderer"
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
import { CodeQualityRenderer } from "./code-quality-renderer"
import { CommandResultRenderer } from "./command-result-renderer"
import {
  CsvToJsonRenderer,
  JsonSchemaValidateRenderer,
  JsonToCsvRenderer,
  XmlToJsonRenderer,
  XpathQueryRenderer,
} from "./data-format-renderer"
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
import { PdfRenderer } from "./pdf-renderer"
import { ReplaySearchRenderer, ReplaySummaryRenderer } from "./replay-renderer"
import { RouteMapRenderer } from "./route-map-renderer"
import { ScriptResultRenderer } from "./script-result-renderer"
import { SecretScanRenderer } from "./secret-scan-renderer"
import { SecurityCheckRenderer } from "./security-check-renderer"
import { SessionInspectRenderer, SessionListRenderer } from "./session-renderer"
import { SettingsSummaryRenderer } from "./settings-summary-renderer"
import { SymbolRenderer } from "./symbol-renderer"
import {
  ClipboardReadRenderer,
  ClipboardWriteRenderer,
  DesktopNotifyRenderer,
  ProcessListRenderer,
  SystemInfoRenderer,
} from "./system-renderer"
import { TableRenderer } from "./table-renderer"
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
