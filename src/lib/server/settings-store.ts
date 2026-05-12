import { OPENROUTER_MODEL } from "@/configs"
import {
  getProviderDefaultModel,
  hasProviderCredentials as providerHasCredentials,
  normalizeLlmProvider,
} from "@/lib/llm-providers"
import {
  AgentMode,
  ProviderSettings,
  ServerSettings,
  ToolPolicyProfile,
  WorkflowPreset,
} from "@/types/runtime"

import { readJsonFile, withFileWriteLock, writeJsonFileAtomic } from "./json-store"
import {
  ensureWorkspaceDirs,
  getDefaultWorkspaceRoot,
  getSettingsFilePath,
  setWorkspaceRoot,
} from "./workspace"

const DEFAULT_SETTINGS: ServerSettings = {
  currentSessionId: null,
  workspaceRoot: getDefaultWorkspaceRoot(),
  llmProvider: "openrouter",
  customWorkflows: [],
  openRouterModel: OPENROUTER_MODEL,
  openRouterApiKey: "",
  openAIModel: "gpt-4o-mini",
  openAIApiKey: "",
  geminiModel: getProviderDefaultModel("gemini"),
  geminiApiKey: "",
  claudeModel: getProviderDefaultModel("claude"),
  claudeApiKey: "",
  grokModel: getProviderDefaultModel("grok"),
  grokApiKey: "",
  azureOpenAIApiKey: "",
  azureOpenAIEndpoint: "",
  azureOpenAIApiVersion: "2024-02-15-preview",
  azureOpenAIDeployment: "",
  liveModeEnabled: true,
  contextBudget: 12_000,
  customSystemPrompt: "",
  extendedThinking: {
    enabled: false,
    budgetTokens: 4_000,
  },
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY ?? "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
}

const VALID_MODES = new Set(["general", "research", "browser", "workspace", "document"])
const VALID_POLICIES = new Set(["read_only", "balanced", "full_auto"])
const VALID_CATEGORIES = new Set(["research", "browser", "workspace", "document", "code"])

function isAgentMode(value: unknown): value is AgentMode {
  return typeof value === "string" && VALID_MODES.has(value)
}

function isToolPolicy(value: unknown): value is ToolPolicyProfile {
  return typeof value === "string" && VALID_POLICIES.has(value)
}

function isWorkflowCategory(value: unknown): value is NonNullable<WorkflowPreset["category"]> {
  return typeof value === "string" && VALID_CATEGORIES.has(value)
}

function slugifyWorkflowId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
}

function normalizeCustomWorkflows(value: unknown): WorkflowPreset[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const workflows: WorkflowPreset[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue
    const raw = entry as Partial<WorkflowPreset>
    const id = slugifyWorkflowId(String(raw.id || raw.title || ""))
    const title = String(raw.title || "").trim()
    const prompt = String(raw.prompt || "").trim()
    if (!id || !title || !prompt || seen.has(id)) continue
    seen.add(id)
    workflows.push({
      id,
      title: title.slice(0, 80),
      description: String(raw.description || "")
        .trim()
        .slice(0, 240),
      prompt: prompt.slice(0, 10_000),
      mode: isAgentMode(raw.mode) ? raw.mode : "general",
      toolPolicy: isToolPolicy(raw.toolPolicy) ? raw.toolPolicy : undefined,
      responseSchema:
        raw.responseSchema && typeof raw.responseSchema === "object" ? raw.responseSchema : null,
      category: isWorkflowCategory(raw.category) ? raw.category : "workspace",
      supportsBackground: Boolean(raw.supportsBackground),
      custom: true,
    })
  }
  return workflows
}

/**
 * Merges partial persisted settings with safe defaults and canonical provider names/models.
 */
function normalizeSettings(raw?: Partial<ServerSettings> | null): ServerSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    currentSessionId:
      typeof raw?.currentSessionId === "string" || raw?.currentSessionId === null
        ? raw.currentSessionId
        : DEFAULT_SETTINGS.currentSessionId,
    workspaceRoot: setWorkspaceRoot(raw?.workspaceRoot?.trim() || DEFAULT_SETTINGS.workspaceRoot),
    llmProvider: normalizeLlmProvider(raw?.llmProvider),
    customWorkflows: normalizeCustomWorkflows(raw?.customWorkflows),
    openRouterModel: raw?.openRouterModel?.trim() || DEFAULT_SETTINGS.openRouterModel,
    openRouterApiKey: raw?.openRouterApiKey?.trim() || DEFAULT_SETTINGS.openRouterApiKey,
    openAIModel: raw?.openAIModel?.trim() || DEFAULT_SETTINGS.openAIModel,
    openAIApiKey: raw?.openAIApiKey?.trim() ?? DEFAULT_SETTINGS.openAIApiKey,
    geminiModel: raw?.geminiModel?.trim() || DEFAULT_SETTINGS.geminiModel,
    geminiApiKey: raw?.geminiApiKey?.trim() ?? DEFAULT_SETTINGS.geminiApiKey,
    claudeModel: raw?.claudeModel?.trim() || DEFAULT_SETTINGS.claudeModel,
    claudeApiKey: raw?.claudeApiKey?.trim() ?? DEFAULT_SETTINGS.claudeApiKey,
    grokModel: raw?.grokModel?.trim() || DEFAULT_SETTINGS.grokModel,
    grokApiKey: raw?.grokApiKey?.trim() ?? DEFAULT_SETTINGS.grokApiKey,
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
    contextBudget:
      typeof raw?.contextBudget === "number" && Number.isFinite(raw.contextBudget)
        ? Math.min(Math.max(Math.floor(raw.contextBudget), 4_000), 200_000)
        : DEFAULT_SETTINGS.contextBudget,
    customSystemPrompt:
      typeof raw?.customSystemPrompt === "string"
        ? raw.customSystemPrompt.trim().slice(0, 20_000)
        : DEFAULT_SETTINGS.customSystemPrompt,
    extendedThinking: {
      enabled: Boolean(raw?.extendedThinking?.enabled),
      budgetTokens:
        typeof raw?.extendedThinking?.budgetTokens === "number" &&
        Number.isFinite(raw.extendedThinking.budgetTokens)
          ? Math.min(Math.max(Math.floor(raw.extendedThinking.budgetTokens), 1_000), 10_000)
          : DEFAULT_SETTINGS.extendedThinking.budgetTokens,
    },
    cloudinaryCloudName: raw?.cloudinaryCloudName?.trim() ?? DEFAULT_SETTINGS.cloudinaryCloudName,
    cloudinaryApiKey: raw?.cloudinaryApiKey?.trim() ?? DEFAULT_SETTINGS.cloudinaryApiKey,
    cloudinaryApiSecret: raw?.cloudinaryApiSecret?.trim() ?? DEFAULT_SETTINGS.cloudinaryApiSecret,
  }
}

class SettingsStore {
  private cache: ServerSettings | null = null

  async load(): Promise<ServerSettings> {
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
      const current = await this.load()
      const next = normalizeSettings({ ...current, ...partial })
      await writeJsonFileAtomic(filePath, next)
      setWorkspaceRoot(next.workspaceRoot)
      this.cache = next
      return { ...next }
    })
  }
}

declare global {
  var __REKDIN_SETTINGS_STORE: SettingsStore | undefined
}

/**
 * Returns the singleton JSON-backed settings store shared by settings routes and runtime startup.
 */
export function getSettingsStore() {
  if (!globalThis.__REKDIN_SETTINGS_STORE) {
    globalThis.__REKDIN_SETTINGS_STORE = new SettingsStore()
  }
  return globalThis.__REKDIN_SETTINGS_STORE
}

/**
 * Extracts only model/provider credential fields needed by the agent runtime.
 */
export async function getProviderSettings(
  loadedSettings?: ServerSettings
): Promise<ProviderSettings> {
  const settings = loadedSettings ?? (await getSettingsStore().load())
  return {
    provider: settings.llmProvider,
    openRouterModel: settings.openRouterModel,
    openRouterApiKey: settings.openRouterApiKey,
    openAIModel: settings.openAIModel,
    openAIApiKey: settings.openAIApiKey,
    geminiModel: settings.geminiModel,
    geminiApiKey: settings.geminiApiKey,
    claudeModel: settings.claudeModel,
    claudeApiKey: settings.claudeApiKey,
    grokModel: settings.grokModel,
    grokApiKey: settings.grokApiKey,
    azureOpenAIApiKey: settings.azureOpenAIApiKey,
    azureOpenAIEndpoint: settings.azureOpenAIEndpoint,
    azureOpenAIApiVersion: settings.azureOpenAIApiVersion,
    azureOpenAIDeployment: settings.azureOpenAIDeployment,
    contextBudget: settings.contextBudget,
    customSystemPrompt: settings.customSystemPrompt,
    extendedThinking: settings.extendedThinking,
  }
}

/**
 * Checks whether the currently selected provider has the credentials/model values required to run.
 */
export function hasProviderCredentials(settings: ServerSettings) {
  return providerHasCredentials(settings.llmProvider, settings)
}

export { DEFAULT_SETTINGS, normalizeLlmProvider as normalizeProvider, normalizeSettings }
