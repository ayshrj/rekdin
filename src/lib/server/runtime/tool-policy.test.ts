import { describe, expect, it } from "vitest"

import { resolveAllowedToolNames } from "./tool-policy"

describe("resolveAllowedToolNames", () => {
  it("blocks destructive tools in read-only mode", () => {
    const tools = resolveAllowedToolNames("general", "read_only")

    expect(tools).toContain("file_read")
    expect(tools).toContain("web_search")
    expect(tools).not.toContain("write_file")
    expect(tools).not.toContain("execute_command")
    expect(tools).not.toContain("browser_click")
  })

  it("unlocks execution tools in full-auto workspace mode", () => {
    const tools = resolveAllowedToolNames("workspace", "full_auto")

    expect(tools).toContain("write_file")
    expect(tools).toContain("execute_command")
    expect(tools).toContain("git_diff_summary")
  })
})
