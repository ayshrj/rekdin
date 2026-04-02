import { describe, expect, it } from "vitest"

import { hasProviderCredentials, normalizeSettings } from "./settings-store"

describe("settings-store helpers", () => {
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
  })
})
