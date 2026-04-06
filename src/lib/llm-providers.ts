export type LlmProvider = "openrouter" | "openai" | "gemini" | "claude" | "grok" | "azure_openai"

export interface ProviderCredentialFields {
  openRouterModel: string
  openRouterApiKey: string
  openAIModel: string
  openAIApiKey: string
  geminiModel: string
  geminiApiKey: string
  claudeModel: string
  claudeApiKey: string
  grokModel: string
  grokApiKey: string
  azureOpenAIApiKey: string
  azureOpenAIEndpoint: string
  azureOpenAIApiVersion: string
  azureOpenAIDeployment: string
}

type ProviderMetadata = {
  label: string
  apiKeyLabel: string
  modelLabel: string
  apiKeyPlaceholder: string
  modelPlaceholder: string
  defaultModel: string
  description: string
  supportsModelFetch?: boolean
}

export const LLM_PROVIDER_METADATA: Record<LlmProvider, ProviderMetadata> = {
  openrouter: {
    label: "OpenRouter",
    apiKeyLabel: "OpenRouter API key",
    modelLabel: "Model",
    apiKeyPlaceholder: "sk-or-v1-...",
    modelPlaceholder: "openai/gpt-4o-mini",
    defaultModel: "openai/gpt-4o-mini",
    description: "Access many providers through one API and fetch models directly.",
    supportsModelFetch: true,
  },
  openai: {
    label: "OpenAI",
    apiKeyLabel: "OpenAI API key",
    modelLabel: "Model",
    apiKeyPlaceholder: "sk-...",
    modelPlaceholder: "gpt-4o-mini",
    defaultModel: "gpt-4o-mini",
    description: "Direct OpenAI API access for GPT models.",
  },
  gemini: {
    label: "Gemini",
    apiKeyLabel: "Gemini API key",
    modelLabel: "Model",
    apiKeyPlaceholder: "AIza...",
    modelPlaceholder: "gemini-2.5-flash",
    defaultModel: "gemini-2.5-flash",
    description: "Direct Gemini API access using LangChain's native Google GenAI client.",
  },
  claude: {
    label: "Claude",
    apiKeyLabel: "Anthropic API key",
    modelLabel: "Model",
    apiKeyPlaceholder: "sk-ant-...",
    modelPlaceholder: "claude-sonnet-4-20250514",
    defaultModel: "claude-sonnet-4-20250514",
    description: "Direct Claude access using LangChain's native Anthropic client.",
  },
  grok: {
    label: "Grok",
    apiKeyLabel: "xAI API key",
    modelLabel: "Model",
    apiKeyPlaceholder: "xai-...",
    modelPlaceholder: "grok-4",
    defaultModel: "grok-4",
    description: "Direct xAI API access for Grok models.",
  },
  azure_openai: {
    label: "Azure OpenAI",
    apiKeyLabel: "Azure OpenAI API key",
    modelLabel: "Deployment",
    apiKeyPlaceholder: "...",
    modelPlaceholder: "your-deployment-name",
    defaultModel: "",
    description: "Azure-hosted OpenAI deployment with endpoint and API version.",
  },
}

export const LLM_PROVIDER_OPTIONS = Object.keys(LLM_PROVIDER_METADATA) as LlmProvider[]

export type OpenAICompatibleProvider = Exclude<LlmProvider, "azure_openai">

export function normalizeLlmProvider(value: string | null | undefined): LlmProvider {
  const normalized = (value ?? "").trim().toLowerCase()
  if (normalized === "openai") return "openai"
  if (normalized === "gemini" || normalized === "google" || normalized === "google_gemini") {
    return "gemini"
  }
  if (normalized === "claude" || normalized === "anthropic") return "claude"
  if (normalized === "grok" || normalized === "xai" || normalized === "x_ai") return "grok"
  if (normalized === "azure" || normalized === "azure-openai" || normalized === "azure_openai") {
    return "azure_openai"
  }
  return "openrouter"
}

export function getProviderLabel(provider: LlmProvider) {
  return LLM_PROVIDER_METADATA[provider].label
}

export function getProviderDefaultModel(provider: LlmProvider) {
  return LLM_PROVIDER_METADATA[provider].defaultModel
}

export function getProviderApiKey(provider: LlmProvider, settings: ProviderCredentialFields) {
  switch (provider) {
    case "openrouter":
      return settings.openRouterApiKey
    case "openai":
      return settings.openAIApiKey
    case "gemini":
      return settings.geminiApiKey
    case "claude":
      return settings.claudeApiKey
    case "grok":
      return settings.grokApiKey
    case "azure_openai":
      return settings.azureOpenAIApiKey
  }
}

export function getProviderModel(provider: LlmProvider, settings: ProviderCredentialFields) {
  switch (provider) {
    case "openrouter":
      return settings.openRouterModel
    case "openai":
      return settings.openAIModel
    case "gemini":
      return settings.geminiModel
    case "claude":
      return settings.claudeModel
    case "grok":
      return settings.grokModel
    case "azure_openai":
      return settings.azureOpenAIDeployment
  }
}

export function hasProviderCredentials(provider: LlmProvider, settings: ProviderCredentialFields) {
  if (provider === "azure_openai") {
    return Boolean(
      settings.azureOpenAIApiKey && settings.azureOpenAIEndpoint && settings.azureOpenAIDeployment
    )
  }
  return Boolean(getProviderApiKey(provider, settings) && getProviderModel(provider, settings))
}

export function getProviderMissingConfigMessage(provider: LlmProvider) {
  switch (provider) {
    case "openrouter":
      return "Set your OpenRouter API key + model in Settings first."
    case "openai":
      return "Set your OpenAI API key + model in Settings first."
    case "gemini":
      return "Set your Gemini API key + model in Settings first."
    case "claude":
      return "Set your Claude API key + model in Settings first."
    case "grok":
      return "Set your Grok API key + model in Settings first."
    case "azure_openai":
      return "Set your Azure OpenAI key + endpoint + deployment in Settings first."
  }
}

export function isOpenAICompatibleProvider(
  provider: LlmProvider
): provider is OpenAICompatibleProvider {
  return provider !== "azure_openai"
}

export function getOpenAICompatibleProviderConfig(
  provider: OpenAICompatibleProvider,
  origin?: string
) {
  const referer = typeof origin === "string" ? origin : "http://localhost:3000"

  switch (provider) {
    case "openrouter":
      return {
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": referer,
          "X-Title": "Rekdin Next",
        },
      }
    case "openai":
      return {
        baseURL: "https://api.openai.com/v1",
      }
    case "gemini":
      return {
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      }
    case "claude":
      return {
        baseURL: "https://api.anthropic.com/v1/",
      }
    case "grok":
      return {
        baseURL: "https://api.x.ai/v1",
      }
  }
}
