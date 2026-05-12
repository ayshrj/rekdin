import { describe, expect, it } from "vitest"

import {
  requiresToolApproval,
  resolveAllowedToolNames,
  resolveWorkflowAllowedToolNames,
} from "./tool-policy"

describe("resolveAllowedToolNames", () => {
  it("blocks destructive tools in read-only mode", () => {
    const tools = resolveAllowedToolNames("general", "read_only")

    expect(tools).toContain("file_read")
    expect(tools).toContain("web_search")
    expect(tools).toContain("symbol_search")
    expect(tools).toContain("csv_preview")
    expect(tools).toContain("secret_scan")
    expect(tools).toContain("image_ocr")
    expect(tools).not.toContain("write_file")
    expect(tools).not.toContain("execute_command")
    expect(tools).not.toContain("browser_click")
    expect(tools).not.toContain("browser_downloads")
    expect(tools).not.toContain("git_apply_patch")
    expect(tools).not.toContain("artifact_delete")
  })

  it("unlocks execution tools in full-auto workspace mode", () => {
    const tools = resolveAllowedToolNames("workspace", "full_auto")

    expect(tools).toContain("write_file")
    expect(tools).toContain("execute_command")
    expect(tools).toContain("git_diff_summary")
  })

  it("uses the registered tool names for form fill and codeact tools", () => {
    const generalTools = resolveAllowedToolNames("general", "balanced")
    const browserTools = resolveAllowedToolNames("browser", "balanced")
    const workspaceTools = resolveAllowedToolNames("workspace", "full_auto")

    // browser_write tools are only available in browser mode, not general mode
    expect(generalTools).not.toContain("browser_form_input_fill")
    expect(generalTools).not.toContain("browser_click")
    expect(browserTools).toContain("browser_form_input_fill")
    expect(browserTools).not.toContain("browser_form_fill")
    expect(workspaceTools).toContain("node_codeact")
    expect(workspaceTools).toContain("python_codeact")
    expect(workspaceTools).toContain("shell_codeact")
    expect(workspaceTools).not.toContain("node_code_act")
    expect(workspaceTools).not.toContain("python_code_act")
    expect(workspaceTools).not.toContain("shell_code_act")
  })

  it("requires approval for risky balanced tools and host-level full-auto tools", () => {
    expect(requiresToolApproval("write_file", "balanced")).toBe(true)
    expect(requiresToolApproval("browser_form_input_fill", "balanced")).toBe(true)
    expect(requiresToolApproval("git_apply_patch", "balanced")).toBe(true)
    expect(requiresToolApproval("run_npm_script", "balanced")).toBe(true)
    expect(requiresToolApproval("browser_downloads", "balanced")).toBe(true)
    expect(requiresToolApproval("file_read", "balanced")).toBe(false)
    expect(requiresToolApproval("write_file", "full_auto")).toBe(false)
    expect(requiresToolApproval("execute_command", "full_auto")).toBe(true)
    expect(requiresToolApproval("build_project", "full_auto")).toBe(true)
    expect(requiresToolApproval("browser_downloads", "full_auto")).toBe(true)
  })

  it("narrows workflow tools to deterministic low-token sets", () => {
    expect(resolveWorkflowAllowedToolNames("research", "balanced", "research-plan")).toEqual([])

    const researchReportTools = resolveWorkflowAllowedToolNames(
      "research",
      "balanced",
      "research-report"
    )
    expect(researchReportTools).toContain("web_search")
    expect(researchReportTools).toContain("visit_link")
    expect(researchReportTools).not.toContain("file_read")

    const repoAuditTools = resolveWorkflowAllowedToolNames("workspace", "balanced", "repo-audit")
    expect(repoAuditTools).toContain("code_map")
    expect(repoAuditTools).toContain("dependency_graph")
    expect(repoAuditTools).toContain("secret_scan")
    expect(repoAuditTools).toContain("file_search")
    expect(repoAuditTools).not.toContain("write_file")

    const diffReviewTools = resolveWorkflowAllowedToolNames("workspace", "balanced", "diff-review")
    expect(diffReviewTools).toContain("git_diff_summary")
    expect(diffReviewTools).toContain("code_map")
    expect(diffReviewTools).not.toContain("execute_command")
  })
})
