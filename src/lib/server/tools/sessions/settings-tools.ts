import { tool } from "@langchain/core/tools"
import { z } from "zod"

import {
  getProviderApiKey,
  getProviderLabel,
  getProviderModel,
  hasProviderCredentials as hasLlmProviderCredentials,
} from "@/lib/llm-providers"
import { getAllWorkflowPresets } from "@/lib/workflows"
import { ServerSettings } from "@/types/runtime"

import {
  getSettingsStore,
  hasProviderCredentials as settingsHaveProviderCredentials,
} from "../../settings-store"

function configuredProviderSummary(settings: ServerSettings) {
  const providers = ["openrouter", "openai", "gemini", "claude", "grok", "azure_openai"] as const
  return providers.map((provider) => ({
    provider,
    label: getProviderLabel(provider),
    selected: settings.llmProvider === provider,
    configured: hasLlmProviderCredentials(provider, settings),
    hasApiKey: Boolean(getProviderApiKey(provider, settings)),
    modelConfigured: Boolean(getProviderModel(provider, settings)),
    model: getProviderModel(provider, settings) || undefined,
    endpointConfigured:
      provider === "azure_openai" ? Boolean(settings.azureOpenAIEndpoint) : undefined,
  }))
}

export const settingsSummaryTool = tool(
  async () => {
    const settings = await getSettingsStore().load()
    const allWorkflows = getAllWorkflowPresets(settings.customWorkflows)
    const customWorkflows = settings.customWorkflows.slice(0, 20).map((workflow) => ({
      id: workflow.id,
      title: workflow.title,
      mode: workflow.mode,
      toolPolicy: workflow.toolPolicy,
      category: workflow.category,
      supportsBackground: Boolean(workflow.supportsBackground),
      responseSchemaConfigured: Boolean(workflow.responseSchema),
      promptChars: workflow.prompt.length,
    }))
    return {
      type: "settings_summary",
      currentSessionId: settings.currentSessionId ?? null,
      workspaceRoot: settings.workspaceRoot,
      selectedProvider: settings.llmProvider,
      selectedProviderLabel: getProviderLabel(settings.llmProvider),
      selectedProviderReady: settingsHaveProviderCredentials(settings),
      selectedModel: getProviderModel(settings.llmProvider, settings) || null,
      liveModeEnabled: settings.liveModeEnabled,
      runtime: {
        contextBudget: settings.contextBudget,
        customSystemPromptConfigured: settings.customSystemPrompt.trim().length > 0,
        customSystemPromptChars: settings.customSystemPrompt.length,
        extendedThinkingEnabled: settings.extendedThinking.enabled,
        extendedThinkingBudgetTokens: settings.extendedThinking.budgetTokens,
      },
      uploads: {
        cloudinaryConfigured: Boolean(
          settings.cloudinaryCloudName && settings.cloudinaryApiKey && settings.cloudinaryApiSecret
        ),
        cloudNameConfigured: Boolean(settings.cloudinaryCloudName),
        apiKeyConfigured: Boolean(settings.cloudinaryApiKey),
        apiSecretConfigured: Boolean(settings.cloudinaryApiSecret),
      },
      providers: configuredProviderSummary(settings),
      workflows: {
        builtInCount: allWorkflows.filter((workflow) => !workflow.custom).length,
        customCount: settings.customWorkflows.length,
        totalCount: allWorkflows.length,
        customWorkflows,
        omittedCustomWorkflows: Math.max(
          settings.customWorkflows.length - customWorkflows.length,
          0
        ),
      },
      redaction: {
        credentials: "redacted",
        providerSecretsIncluded: false,
        uploadSecretsIncluded: false,
      },
    }
  },
  {
    name: "settings_summary",
    description:
      "Return redacted Rekdin runtime settings: selected provider/model presence, workspace root, uploads, workflows, and feature flags.",
    schema: z.object({}),
  }
)
