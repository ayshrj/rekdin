import { OPENROUTER_API_KEY, OPENROUTER_MODEL } from "@/configs"
import { LlmProvider, ProviderSettings, ServerSettings } from "@/types/runtime"

import { readJsonFile, withFileWriteLock, writeJsonFileAtomic } from "./json-store"
import { ensureWorkspaceDirs, getSettingsFilePath } from "./workspace"

const DEFAULT_SETTINGS: ServerSettings = {
  currentSessionId: null,
  llmProvider: "openrouter",
  openRouterModel: OPENROUTER_MODEL,
  openRouterApiKey: OPENROUTER_API_KEY,
  openAIModel: "gpt-4o-mini",
  openAIApiKey: "",
  azureOpenAIApiKey: "",
  azureOpenAIEndpoint: "",
  azureOpenAIApiVersion: "2024-02-15-preview",
  azureOpenAIDeployment: "",
  liveModeEnabled: true,
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY ?? "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
}

function normalizeProvider(value: string | null | undefined): LlmProvider {
  const normalized = (value ?? "").trim().toLowerCase()
  if (normalized === "openai") return "openai"
  if (normalized === "azure" || normalized === "azure-openai" || normalized === "azure_openai") {
    return "azure_openai"
  }
  return "openrouter"
}

function normalizeSettings(raw?: Partial<ServerSettings> | null): ServerSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    currentSessionId:
      typeof raw?.currentSessionId === "string" || raw?.currentSessionId === null
        ? raw.currentSessionId
        : DEFAULT_SETTINGS.currentSessionId,
    llmProvider: normalizeProvider(raw?.llmProvider),
    openRouterModel: raw?.openRouterModel?.trim() || DEFAULT_SETTINGS.openRouterModel,
    openRouterApiKey: raw?.openRouterApiKey?.trim() || DEFAULT_SETTINGS.openRouterApiKey,
    openAIModel: raw?.openAIModel?.trim() || DEFAULT_SETTINGS.openAIModel,
    openAIApiKey: raw?.openAIApiKey?.trim() ?? DEFAULT_SETTINGS.openAIApiKey,
    azureOpenAIApiKey: raw?.azureOpenAIApiKey?.trim() ?? DEFAULT_SETTINGS.azureOpenAIApiKey,
    azureOpenAIEndpoint: raw?.azureOpenAIEndpoint?.trim() ?? DEFAULT_SETTINGS.azureOpenAIEndpoint,
    azureOpenAIApiVersion:
      raw?.azureOpenAIApiVersion?.trim() || DEFAULT_SETTINGS.azureOpenAIApiVersion,
    azureOpenAIDeployment:
      raw?.azureOpenAIDeployment?.trim() ?? DEFAULT_SETTINGS.azureOpenAIDeployment,
    liveModeEnabled:
      typeof raw?.liveModeEnabled === "boolean"
        ? raw.liveModeEnabled
        : DEFAULT_SETTINGS.liveModeEnabled,
    cloudinaryCloudName: raw?.cloudinaryCloudName?.trim() ?? DEFAULT_SETTINGS.cloudinaryCloudName,
    cloudinaryApiKey: raw?.cloudinaryApiKey?.trim() ?? DEFAULT_SETTINGS.cloudinaryApiKey,
    cloudinaryApiSecret: raw?.cloudinaryApiSecret?.trim() ?? DEFAULT_SETTINGS.cloudinaryApiSecret,
  }
}

class SettingsStore {
  private cache: ServerSettings | null = null

  async load(): Promise<ServerSettings> {
    if (this.cache) return { ...this.cache }
    await ensureWorkspaceDirs()
    const settings = normalizeSettings(
      await readJsonFile<Partial<ServerSettings>>(getSettingsFilePath(), DEFAULT_SETTINGS)
    )
    this.cache = settings
    return { ...settings }
  }

  async save(partial: Partial<ServerSettings>): Promise<ServerSettings> {
    const filePath = getSettingsFilePath()
    return withFileWriteLock(filePath, async () => {
      const current = this.cache ?? (await this.load())
      const next = normalizeSettings({ ...current, ...partial })
      await writeJsonFileAtomic(filePath, next)
      this.cache = next
      return { ...next }
    })
  }
}

declare global {
  var __REKDIN_SETTINGS_STORE: SettingsStore | undefined
}

export function getSettingsStore() {
  if (!globalThis.__REKDIN_SETTINGS_STORE) {
    globalThis.__REKDIN_SETTINGS_STORE = new SettingsStore()
  }
  return globalThis.__REKDIN_SETTINGS_STORE
}

export async function getProviderSettings(): Promise<ProviderSettings> {
  const settings = await getSettingsStore().load()
  return {
    provider: settings.llmProvider,
    openRouterModel: settings.openRouterModel,
    openRouterApiKey: settings.openRouterApiKey,
    openAIModel: settings.openAIModel,
    openAIApiKey: settings.openAIApiKey,
    azureOpenAIApiKey: settings.azureOpenAIApiKey,
    azureOpenAIEndpoint: settings.azureOpenAIEndpoint,
    azureOpenAIApiVersion: settings.azureOpenAIApiVersion,
    azureOpenAIDeployment: settings.azureOpenAIDeployment,
  }
}

export function hasProviderCredentials(settings: ServerSettings) {
  if (settings.llmProvider === "openrouter") {
    return Boolean(settings.openRouterApiKey && settings.openRouterModel)
  }
  if (settings.llmProvider === "openai") {
    return Boolean(settings.openAIApiKey && settings.openAIModel)
  }
  return Boolean(
    settings.azureOpenAIApiKey && settings.azureOpenAIEndpoint && settings.azureOpenAIDeployment
  )
}

export { DEFAULT_SETTINGS, normalizeProvider, normalizeSettings }
