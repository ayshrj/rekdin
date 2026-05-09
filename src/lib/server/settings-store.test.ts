import { mkdtemp, writeFile } from "fs/promises"
import os from "os"
import path from "path"
import { afterEach, describe, expect, it, vi } from "vitest"

import { hasProviderCredentials, normalizeSettings } from "./settings-store"

const ORIGINAL_DATA_DIR = process.env.REKDIN_DATA_DIR

async function loadFreshStores(dataDir: string) {
  process.env.REKDIN_DATA_DIR = dataDir
  vi.resetModules()
  const settingsStore = await import("./settings-store")
  const workspace = await import("./workspace")
  return { settingsStore, workspace }
}

describe("settings-store helpers", () => {
  afterEach(() => {
    vi.resetModules()
    if (ORIGINAL_DATA_DIR === undefined) {
      delete process.env.REKDIN_DATA_DIR
    } else {
      process.env.REKDIN_DATA_DIR = ORIGINAL_DATA_DIR
    }
    delete globalThis.__REKDIN_SETTINGS_STORE
  })

  it("normalizes provider aliases and default values", () => {
    const settings = normalizeSettings({
      llmProvider: "azure" as never,
      openRouterModel: "",
      azureOpenAIApiVersion: "",
      liveModeEnabled: false,
    })

    expect(settings.llmProvider).toBe("azure_openai")
    expect(settings.openRouterModel.length).toBeGreaterThan(0)
    expect(settings.azureOpenAIApiVersion).toBe("2024-02-15-preview")
    expect(settings.liveModeEnabled).toBe(false)
  })

  it("normalizes gemini, claude, and grok provider aliases", () => {
    expect(normalizeSettings({ llmProvider: "google" as never }).llmProvider).toBe("gemini")
    expect(normalizeSettings({ llmProvider: "anthropic" as never }).llmProvider).toBe("claude")
    expect(normalizeSettings({ llmProvider: "xai" as never }).llmProvider).toBe("grok")
  })

  it("detects whether the configured provider is ready to run", () => {
    expect(
      hasProviderCredentials(
        normalizeSettings({
          llmProvider: "openrouter",
          openRouterApiKey: "sk-openrouter",
        })
      )
    ).toBe(true)

    expect(
      hasProviderCredentials(
        normalizeSettings({
          llmProvider: "azure_openai",
          azureOpenAIApiKey: "azure-key",
          azureOpenAIEndpoint: "https://example.openai.azure.com",
          azureOpenAIDeployment: "gpt-4o",
        })
      )
    ).toBe(true)

    expect(
      hasProviderCredentials(
        normalizeSettings({
          llmProvider: "openai",
          openAIApiKey: "",
          openAIModel: "gpt-4o-mini",
        })
      )
    ).toBe(false)

    expect(
      hasProviderCredentials(
        normalizeSettings({
          llmProvider: "claude",
          claudeApiKey: "sk-ant-test",
          claudeModel: "claude-sonnet-4-20250514",
        })
      )
    ).toBe(true)
  })

  it("normalizes custom workflows and drops invalid entries", () => {
    const settings = normalizeSettings({
      customWorkflows: [
        {
          id: "My Workflow!",
          title: "My Workflow",
          description: "Useful custom workflow",
          prompt: "Inspect the repo",
          mode: "workspace",
          toolPolicy: "read_only",
          supportsBackground: true,
        },
        { id: "", title: "", prompt: "" },
      ] as never,
    })

    expect(settings.customWorkflows).toHaveLength(1)
    expect(settings.customWorkflows[0]).toMatchObject({
      id: "my-workflow",
      mode: "workspace",
      toolPolicy: "read_only",
      supportsBackground: true,
      custom: true,
    })
  })

  it("refreshes the active workspace root from persisted settings on each load", async () => {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), "rekdin-settings-test-"))
    const firstWorkspace = path.join(dataDir, "first-workspace")
    const secondWorkspace = path.join(dataDir, "second-workspace")
    const { settingsStore, workspace } = await loadFreshStores(dataDir)
    const store = settingsStore.getSettingsStore()

    await store.save({ workspaceRoot: firstWorkspace })
    expect(workspace.getWorkspaceRoot()).toBe(path.resolve(firstWorkspace))

    await writeFile(
      workspace.getSettingsFilePath(),
      JSON.stringify(
        {
          ...settingsStore.DEFAULT_SETTINGS,
          workspaceRoot: secondWorkspace,
        },
        null,
        2
      ),
      "utf-8"
    )

    const loaded = await store.load()
    expect(loaded.workspaceRoot).toBe(path.resolve(secondWorkspace))
    expect(workspace.getWorkspaceRoot()).toBe(path.resolve(secondWorkspace))
  })
})
