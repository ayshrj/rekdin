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
  visit_link: ["network"],
  http_request: ["network"],
  download_fetch: ["network"],
  link_preview: ["network"],
  npm_package_info: ["network"],
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
  browser_wait: ["browser_read"],
  browser_wait_for: ["browser_read"],
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
  generate_latex_pdf: ["documents"],
  markdown_to_pdf: ["documents"],
  base64_encode: ["transforms"],
  base64_decode: ["transforms"],
  hash: ["transforms"],
  text_summarize: ["transforms"],
  text_rewrite: ["transforms"],
  extract_todos: ["transforms"],
  image_info: ["transforms"],
  image_convert: ["transforms"],
  git_log_summary: ["repo"],
  git_branches: ["repo"],
  git_diff_summary: ["repo"],
}

const GROUPS_BY_MODE: Record<AgentMode, ToolGroup[]> = {
  general: [
    "network",
    "browser_read",
    "browser_write",
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
  "generate_latex_pdf",
  "markdown_to_pdf",
  "image_convert",
])

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
