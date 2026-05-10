import { describe, expect, it, vi } from "vitest"

import { POST } from "@/app/api/title/route"

import { generateLocalTitle } from "./title-generator"

describe("local title generation", () => {
  it("creates concise titles without model calls", () => {
    expect(
      generateLocalTitle("please audit the renderer components and fix hydration errors")
    ).toBe("Audit Renderer Components Hydration Errors")
  })

  it("uses the local route path and does not fetch a provider", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const response = await POST(
      new Request("http://localhost/api/title", {
        method: "POST",
        body: JSON.stringify({ prompt: "fix the workspace sidebar scroll behavior" }),
      })
    )
    const data = (await response.json()) as { title: string; source: string }

    expect(data.source).toBe("local")
    expect(data.title).toContain("Workspace")
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})
