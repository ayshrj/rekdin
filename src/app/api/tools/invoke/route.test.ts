import { mkdtemp } from "fs/promises"
import os from "os"
import path from "path"
import { afterEach, describe, expect, it, vi } from "vitest"

const ORIGINAL_DATA_DIR = process.env.REKDIN_DATA_DIR

function resetGlobals() {
  delete globalThis.__REKDIN_SETTINGS_STORE
}

describe("/api/tools/invoke", () => {
  afterEach(() => {
    vi.resetModules()
    resetGlobals()
    if (ORIGINAL_DATA_DIR === undefined) {
      delete process.env.REKDIN_DATA_DIR
    } else {
      process.env.REKDIN_DATA_DIR = ORIGINAL_DATA_DIR
    }
  })

  it("allows direct invocation of read-only inspectability tools", async () => {
    process.env.REKDIN_DATA_DIR = await mkdtemp(path.join(os.tmpdir(), "rekdin-invoke-test-"))
    vi.resetModules()
    const { POST } = await import("./route")

    const response = await POST(
      new Request("http://localhost/api/tools/invoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: "direct-session",
          toolName: "settings_summary",
          toolInput: {},
        }),
      })
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.result.type).toBe("settings_summary")
  })
})
