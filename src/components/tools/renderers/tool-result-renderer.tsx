"use client"

import React from "react"

export { toolLabels } from "../tool-labels"

import { ArchiveRenderer } from "./archive-renderer"
import { Base64Renderer } from "./base64-renderer"
import {
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
import { CommandResultRenderer } from "./command-result-renderer"
import { DeepResearchRenderer } from "./deep-research-renderer"
import { ExtractTodosRenderer } from "./extract-todos-renderer"
import { FileReadRenderer } from "./file-read-renderer"
import { FileSearchRenderer } from "./file-search-renderer"
import { GenericResultRenderer } from "./generic-result-renderer"
import { GitBlameRenderer } from "./git-blame-renderer"
import { GitBranchesRenderer } from "./git-branches-renderer"
import { GitDiffRenderer } from "./git-diff-renderer"
import { GitLogRenderer } from "./git-log-renderer"
import { HashRenderer } from "./hash-renderer"
import { HttpRequestRenderer } from "./http-request-renderer"
import { ImageInfoRenderer } from "./image-info-renderer"
import { JsonResultRenderer } from "./json-result-renderer"
import { LinkPreviewRenderer } from "./link-preview-renderer"
import { ListFilesRenderer } from "./list-files-renderer"
import { NpmPackageRenderer } from "./npm-package-renderer"
import { PdfRenderer } from "./pdf-renderer"
import { ScriptResultRenderer } from "./script-result-renderer"
import { TextOutputRenderer } from "./text-output-renderer"
import { WebSearchResultRenderer } from "./web-search-result-renderer"
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
  git_diff_summary: "border-tool-code/25",
  git_log_summary: "border-tool-code/25",
  git_branches: "border-tool-code/25",
  git_blame: "border-tool-code/25",
  git_file_history: "border-tool-code/25",
  download_fetch: "border-tool-json/25",
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
