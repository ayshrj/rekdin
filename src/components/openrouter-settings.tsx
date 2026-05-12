"use client"

import * as React from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Dialog, DialogShell, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useChat } from "@/contexts/chat-context"
import {
  ArrowDownTray,
  ArrowUpTray,
  Check,
  Cog8Tooth as Settings,
  Eye,
  EyeSlash,
  PlayCircle,
} from "@/lib/icons"
import type { LlmProvider } from "@/lib/llm-providers"
import {
  getProviderDefaultModel,
  LLM_PROVIDER_METADATA,
  LLM_PROVIDER_OPTIONS,
  normalizeLlmProvider,
} from "@/lib/llm-providers"
import { cn } from "@/lib/utils"
import { CUSTOM_WORKFLOW_SCHEMA_PRESETS, WORKFLOW_PRESETS } from "@/lib/workflows"
import type { AgentMode, ToolPolicyProfile, WorkflowPreset } from "@/types/runtime"

type OpenRouterModel = {
  id: string
  name: string
  description?: string
  contextLength?: number | null
}

type OpenAIModel = {
  id: string
  owned_by: string
}

type SettingsExport = {
  llmProvider: string
  openRouterApiKey: string
  openRouterModel: string
  openAIApiKey: string
  openAIModel: string
  geminiApiKey: string
  geminiModel: string
  claudeApiKey: string
  claudeModel: string
  grokApiKey: string
  grokModel: string
  azureOpenAIApiKey: string
  azureOpenAIEndpoint: string
  azureOpenAIApiVersion: string
  azureOpenAIDeployment: string
  liveModeEnabled: boolean
  workspaceRoot: string
  customWorkflows?: WorkflowPreset[]
  cloudinaryCloudName: string
  cloudinaryApiKey: string
  cloudinaryApiSecret: string
}

const AGENT_MODE_OPTIONS: AgentMode[] = ["general", "research", "browser", "workspace", "document"]
const TOOL_POLICY_OPTIONS: ToolPolicyProfile[] = ["read_only", "balanced", "full_auto"]

function slugifyWorkflowId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
}

export function OpenRouterSettings({
  onRestartTour,
  triggerClassName,
  triggerVariant = "outline",
  triggerSize = "icon",
  triggerChildren,
  triggerAriaLabel = "Open settings",
}: {
  onRestartTour?: () => void
  triggerClassName?: string
  triggerVariant?: React.ComponentProps<typeof Button>["variant"]
  triggerSize?: React.ComponentProps<typeof Button>["size"]
  triggerChildren?: React.ReactNode
  triggerAriaLabel?: string
} = {}) {
  const {
    llmProvider,
    openRouterApiKey,
    openRouterModel,
    openAIApiKey,
    openAIModel,
    geminiApiKey,
    geminiModel,
    claudeApiKey,
    claudeModel,
    grokApiKey,
    grokModel,
    azureOpenAIApiKey,
    azureOpenAIEndpoint,
    azureOpenAIApiVersion,
    azureOpenAIDeployment,
    liveModeEnabled,
    workspaceRoot,
    customWorkflows,
    cloudinaryCloudName,
    cloudinaryApiKey,
    cloudinaryApiSecret,
    updateLlmSettings,
    updateWorkspaceSettings,
    updateCustomWorkflows,
    updateCloudinarySettings,
  } = useChat()
  const [open, setOpen] = React.useState(false)
  const [showOpenRouterKey, setShowOpenRouterKey] = React.useState(false)
  const [showOpenAIKey, setShowOpenAIKey] = React.useState(false)
  const [showGeminiKey, setShowGeminiKey] = React.useState(false)
  const [showClaudeKey, setShowClaudeKey] = React.useState(false)
  const [showGrokKey, setShowGrokKey] = React.useState(false)
  const [showAzureKey, setShowAzureKey] = React.useState(false)
  const [showCloudinaryKey, setShowCloudinaryKey] = React.useState(false)
  const [showCloudinarySecret, setShowCloudinarySecret] = React.useState(false)

  const [providerDraft, setProviderDraft] = React.useState<LlmProvider>(() =>
    normalizeLlmProvider(llmProvider)
  )
  const [openRouterApiKeyDraft, setOpenRouterApiKeyDraft] = React.useState("")
  const [openRouterModelDraft, setOpenRouterModelDraft] = React.useState("")
  const [openAIApiKeyDraft, setOpenAIApiKeyDraft] = React.useState("")
  const [openAIModelDraft, setOpenAIModelDraft] = React.useState("")
  const [geminiApiKeyDraft, setGeminiApiKeyDraft] = React.useState("")
  const [geminiModelDraft, setGeminiModelDraft] = React.useState("")
  const [claudeApiKeyDraft, setClaudeApiKeyDraft] = React.useState("")
  const [claudeModelDraft, setClaudeModelDraft] = React.useState("")
  const [grokApiKeyDraft, setGrokApiKeyDraft] = React.useState("")
  const [grokModelDraft, setGrokModelDraft] = React.useState("")
  const [azureOpenAIApiKeyDraft, setAzureOpenAIApiKeyDraft] = React.useState("")
  const [azureOpenAIEndpointDraft, setAzureOpenAIEndpointDraft] = React.useState("")
  const [azureOpenAIApiVersionDraft, setAzureOpenAIApiVersionDraft] = React.useState("")
  const [azureOpenAIDeploymentDraft, setAzureOpenAIDeploymentDraft] = React.useState("")
  const [liveModeDraft, setLiveModeDraft] = React.useState(true)
  const [workspaceRootDraft, setWorkspaceRootDraft] = React.useState("")
  const [cloudNameDraft, setCloudNameDraft] = React.useState("")
  const [cloudKeyDraft, setCloudKeyDraft] = React.useState("")
  const [cloudSecretDraft, setCloudSecretDraft] = React.useState("")
  const [models, setModels] = React.useState<OpenRouterModel[]>([])
  const [isLoadingModels, setIsLoadingModels] = React.useState(false)
  const [openAIModels, setOpenAIModels] = React.useState<OpenAIModel[]>([])
  const [isLoadingOpenAIModels, setIsLoadingOpenAIModels] = React.useState(false)
  const [settingsTab, setSettingsTab] = React.useState<"model" | "workflows" | "uploads">("model")
  const [customWorkflowsDraft, setCustomWorkflowsDraft] = React.useState<WorkflowPreset[]>([])
  const [workflowTitleDraft, setWorkflowTitleDraft] = React.useState("")
  const [workflowDescriptionDraft, setWorkflowDescriptionDraft] = React.useState("")
  const [workflowPromptDraft, setWorkflowPromptDraft] = React.useState("")
  const [workflowModeDraft, setWorkflowModeDraft] = React.useState<AgentMode>("general")
  const [workflowPolicyDraft, setWorkflowPolicyDraft] =
    React.useState<ToolPolicyProfile>("balanced")
  const [workflowBackgroundDraft, setWorkflowBackgroundDraft] = React.useState(false)
  const [workflowSchemaPresetDraft, setWorkflowSchemaPresetDraft] = React.useState("none")

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!open) return
    setProviderDraft(normalizeLlmProvider(llmProvider))
    setOpenRouterApiKeyDraft(openRouterApiKey)
    setOpenRouterModelDraft(openRouterModel)
    setOpenAIApiKeyDraft(openAIApiKey)
    setOpenAIModelDraft(openAIModel)
    setGeminiApiKeyDraft(geminiApiKey)
    setGeminiModelDraft(geminiModel)
    setClaudeApiKeyDraft(claudeApiKey)
    setClaudeModelDraft(claudeModel)
    setGrokApiKeyDraft(grokApiKey)
    setGrokModelDraft(grokModel)
    setAzureOpenAIApiKeyDraft(azureOpenAIApiKey)
    setAzureOpenAIEndpointDraft(azureOpenAIEndpoint)
    setAzureOpenAIApiVersionDraft(azureOpenAIApiVersion)
    setAzureOpenAIDeploymentDraft(azureOpenAIDeployment)
    setLiveModeDraft(liveModeEnabled)
    setWorkspaceRootDraft(workspaceRoot)
    setCustomWorkflowsDraft(customWorkflows)
    setCloudNameDraft(cloudinaryCloudName)
    setCloudKeyDraft(cloudinaryApiKey)
    setCloudSecretDraft(cloudinaryApiSecret)
  }, [
    open,
    llmProvider,
    openRouterApiKey,
    openRouterModel,
    openAIApiKey,
    openAIModel,
    geminiApiKey,
    geminiModel,
    claudeApiKey,
    claudeModel,
    grokApiKey,
    grokModel,
    azureOpenAIApiKey,
    azureOpenAIEndpoint,
    azureOpenAIApiVersion,
    azureOpenAIDeployment,
    liveModeEnabled,
    workspaceRoot,
    customWorkflows,
    cloudinaryCloudName,
    cloudinaryApiKey,
    cloudinaryApiSecret,
  ])

  React.useEffect(() => {
    const onOpenSettings = (event: Event) => {
      const detail = (event as CustomEvent<{ tab?: typeof settingsTab | "workspace" }>).detail
      if (detail?.tab === "workspace") {
        window.dispatchEvent(new CustomEvent("rekdin:open-workspace"))
        return
      }
      setOpen(true)
      if (detail?.tab === "model" || detail?.tab === "workflows" || detail?.tab === "uploads") {
        setSettingsTab(detail.tab)
      }
    }
    window.addEventListener("rekdin:open-settings", onOpenSettings)
    return () => window.removeEventListener("rekdin:open-settings", onOpenSettings)
  }, [])

  const fetchModels = React.useCallback(async () => {
    if (providerDraft !== "openrouter") {
      toast.error("Model fetch is available only for OpenRouter")
      return
    }
    if (!openRouterApiKeyDraft.trim()) {
      toast.error("Enter your OpenRouter API key first")
      return
    }
    try {
      setIsLoadingModels(true)
      const res = await fetch("/api/openrouter/models", {
        headers: openRouterApiKeyDraft ? { "X-OpenRouter-Api-Key": openRouterApiKeyDraft } : {},
      })
      const data = (await res.json()) as {
        models?: OpenRouterModel[]
        error?: string
        details?: string
      }
      if (!res.ok) {
        toast.error(data.error ?? "Failed to load models")
        return
      }
      setModels(data.models ?? [])
      toast.success(`Loaded ${data.models?.length ?? 0} models`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load models")
    } finally {
      setIsLoadingModels(false)
    }
  }, [openRouterApiKeyDraft, providerDraft])

  const fetchOpenAIModels = React.useCallback(async () => {
    if (!openAIApiKeyDraft.trim()) {
      toast.error("Enter your OpenAI API key first")
      return
    }
    try {
      setIsLoadingOpenAIModels(true)
      const res = await fetch("/api/openai/models", {
        headers: { "X-OpenAI-Api-Key": openAIApiKeyDraft },
      })
      const data = (await res.json()) as { models?: OpenAIModel[]; error?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Failed to load models")
        return
      }
      setOpenAIModels(data.models ?? [])
      toast.success(`Loaded ${data.models?.length ?? 0} models`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load models")
    } finally {
      setIsLoadingOpenAIModels(false)
    }
  }, [openAIApiKeyDraft])

  const save = React.useCallback(() => {
    updateLlmSettings({
      provider: providerDraft,
      openRouterApiKey: openRouterApiKeyDraft,
      openRouterModel: openRouterModelDraft,
      openAIApiKey: openAIApiKeyDraft,
      openAIModel: openAIModelDraft,
      geminiApiKey: geminiApiKeyDraft,
      geminiModel: geminiModelDraft,
      claudeApiKey: claudeApiKeyDraft,
      claudeModel: claudeModelDraft,
      grokApiKey: grokApiKeyDraft,
      grokModel: grokModelDraft,
      azureOpenAIApiKey: azureOpenAIApiKeyDraft,
      azureOpenAIEndpoint: azureOpenAIEndpointDraft,
      azureOpenAIApiVersion: azureOpenAIApiVersionDraft,
      azureOpenAIDeployment: azureOpenAIDeploymentDraft,
      liveModeEnabled: liveModeDraft,
    })
    updateCloudinarySettings({
      cloudName: cloudNameDraft,
      apiKey: cloudKeyDraft,
      apiSecret: cloudSecretDraft,
    })
    updateWorkspaceSettings({
      workspaceRoot: workspaceRootDraft,
    })
    updateCustomWorkflows(customWorkflowsDraft)
    toast.success("Settings saved")
    setOpen(false)
  }, [
    providerDraft,
    openRouterApiKeyDraft,
    openRouterModelDraft,
    openAIApiKeyDraft,
    openAIModelDraft,
    geminiApiKeyDraft,
    geminiModelDraft,
    claudeApiKeyDraft,
    claudeModelDraft,
    grokApiKeyDraft,
    grokModelDraft,
    azureOpenAIApiKeyDraft,
    azureOpenAIEndpointDraft,
    azureOpenAIApiVersionDraft,
    azureOpenAIDeploymentDraft,
    liveModeDraft,
    workspaceRootDraft,
    customWorkflowsDraft,
    cloudNameDraft,
    cloudKeyDraft,
    cloudSecretDraft,
    updateLlmSettings,
    updateWorkspaceSettings,
    updateCustomWorkflows,
    updateCloudinarySettings,
  ])

  const clear = React.useCallback(() => {
    setProviderDraft("openrouter")
    setOpenRouterApiKeyDraft("")
    setOpenRouterModelDraft(getProviderDefaultModel("openrouter"))
    setOpenAIApiKeyDraft("")
    setOpenAIModelDraft(getProviderDefaultModel("openai"))
    setGeminiApiKeyDraft("")
    setGeminiModelDraft(getProviderDefaultModel("gemini"))
    setClaudeApiKeyDraft("")
    setClaudeModelDraft(getProviderDefaultModel("claude"))
    setGrokApiKeyDraft("")
    setGrokModelDraft(getProviderDefaultModel("grok"))
    setAzureOpenAIApiKeyDraft("")
    setAzureOpenAIEndpointDraft("")
    setAzureOpenAIApiVersionDraft("2024-02-15-preview")
    setAzureOpenAIDeploymentDraft("")
    setLiveModeDraft(true)
    setWorkspaceRootDraft("")
    setCustomWorkflowsDraft([])
    setCloudNameDraft("")
    setCloudKeyDraft("")
    setCloudSecretDraft("")
    updateLlmSettings({
      provider: "openrouter",
      openRouterApiKey: "",
      openRouterModel: getProviderDefaultModel("openrouter"),
      openAIApiKey: "",
      openAIModel: getProviderDefaultModel("openai"),
      geminiApiKey: "",
      geminiModel: getProviderDefaultModel("gemini"),
      claudeApiKey: "",
      claudeModel: getProviderDefaultModel("claude"),
      grokApiKey: "",
      grokModel: getProviderDefaultModel("grok"),
      azureOpenAIApiKey: "",
      azureOpenAIEndpoint: "",
      azureOpenAIApiVersion: "2024-02-15-preview",
      azureOpenAIDeployment: "",
      liveModeEnabled: true,
    })
    updateCloudinarySettings({ cloudName: "", apiKey: "", apiSecret: "" })
    updateWorkspaceSettings({ workspaceRoot: "" })
    updateCustomWorkflows([])
    toast.success("Cleared saved settings")
  }, [updateCloudinarySettings, updateCustomWorkflows, updateLlmSettings, updateWorkspaceSettings])

  const exportSettings = React.useCallback(() => {
    const settings: SettingsExport = {
      llmProvider: providerDraft,
      openRouterApiKey: openRouterApiKeyDraft,
      openRouterModel: openRouterModelDraft,
      openAIApiKey: openAIApiKeyDraft,
      openAIModel: openAIModelDraft,
      geminiApiKey: geminiApiKeyDraft,
      geminiModel: geminiModelDraft,
      claudeApiKey: claudeApiKeyDraft,
      claudeModel: claudeModelDraft,
      grokApiKey: grokApiKeyDraft,
      grokModel: grokModelDraft,
      azureOpenAIApiKey: azureOpenAIApiKeyDraft,
      azureOpenAIEndpoint: azureOpenAIEndpointDraft,
      azureOpenAIApiVersion: azureOpenAIApiVersionDraft,
      azureOpenAIDeployment: azureOpenAIDeploymentDraft,
      liveModeEnabled: liveModeDraft,
      workspaceRoot: workspaceRootDraft,
      customWorkflows: customWorkflowsDraft,
      cloudinaryCloudName: cloudNameDraft,
      cloudinaryApiKey: cloudKeyDraft,
      cloudinaryApiSecret: cloudSecretDraft,
    }

    const json = JSON.stringify(settings, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `settings-${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success("Settings exported")
  }, [
    providerDraft,
    openRouterApiKeyDraft,
    openRouterModelDraft,
    openAIApiKeyDraft,
    openAIModelDraft,
    geminiApiKeyDraft,
    geminiModelDraft,
    claudeApiKeyDraft,
    claudeModelDraft,
    grokApiKeyDraft,
    grokModelDraft,
    azureOpenAIApiKeyDraft,
    azureOpenAIEndpointDraft,
    azureOpenAIApiVersionDraft,
    azureOpenAIDeploymentDraft,
    liveModeDraft,
    workspaceRootDraft,
    customWorkflowsDraft,
    cloudNameDraft,
    cloudKeyDraft,
    cloudSecretDraft,
  ])

  const importSettings = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const json = event.target?.result as string
        const settings = JSON.parse(json) as SettingsExport

        setProviderDraft(normalizeLlmProvider(settings.llmProvider || "openrouter"))
        setOpenRouterApiKeyDraft(settings.openRouterApiKey || "")
        setOpenRouterModelDraft(settings.openRouterModel || "")
        setOpenAIApiKeyDraft(settings.openAIApiKey || "")
        setOpenAIModelDraft(settings.openAIModel || "")
        setGeminiApiKeyDraft(settings.geminiApiKey || "")
        setGeminiModelDraft(settings.geminiModel || "")
        setClaudeApiKeyDraft(settings.claudeApiKey || "")
        setClaudeModelDraft(settings.claudeModel || "")
        setGrokApiKeyDraft(settings.grokApiKey || "")
        setGrokModelDraft(settings.grokModel || "")
        setAzureOpenAIApiKeyDraft(settings.azureOpenAIApiKey || "")
        setAzureOpenAIEndpointDraft(settings.azureOpenAIEndpoint || "")
        setAzureOpenAIApiVersionDraft(settings.azureOpenAIApiVersion || "")
        setAzureOpenAIDeploymentDraft(settings.azureOpenAIDeployment || "")
        setLiveModeDraft(settings.liveModeEnabled ?? true)
        setWorkspaceRootDraft(settings.workspaceRoot || "")
        setCustomWorkflowsDraft(settings.customWorkflows ?? [])
        setCloudNameDraft(settings.cloudinaryCloudName || "")
        setCloudKeyDraft(settings.cloudinaryApiKey || "")
        setCloudSecretDraft(settings.cloudinaryApiSecret || "")

        toast.success("Settings imported successfully")
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err) {
        toast.error("Failed to parse JSON file")
      }
    }
    reader.readAsText(file)

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [])

  const triggerImport = React.useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const addCustomWorkflow = React.useCallback(() => {
    const title = workflowTitleDraft.trim()
    const prompt = workflowPromptDraft.trim()
    if (!title || !prompt) {
      toast.error("Custom workflows need a title and prompt.")
      return
    }
    const id = slugifyWorkflowId(title)
    const reservedIds = new Set([
      ...WORKFLOW_PRESETS.map((workflow) => workflow.id),
      ...customWorkflowsDraft.map((workflow) => workflow.id),
    ])
    if (!id || reservedIds.has(id)) {
      toast.error("Use a unique workflow title.")
      return
    }
    const schemaPreset = CUSTOM_WORKFLOW_SCHEMA_PRESETS.find(
      (preset) => preset.id === workflowSchemaPresetDraft
    )
    setCustomWorkflowsDraft((prev) => [
      ...prev,
      {
        id,
        title,
        description: workflowDescriptionDraft.trim() || "Custom workflow",
        prompt,
        mode: workflowModeDraft,
        toolPolicy: workflowPolicyDraft,
        responseSchema: schemaPreset?.responseSchema ?? null,
        category: workflowModeDraft === "research" ? "research" : "workspace",
        supportsBackground: workflowBackgroundDraft,
        custom: true,
      },
    ])
    setWorkflowTitleDraft("")
    setWorkflowDescriptionDraft("")
    setWorkflowPromptDraft("")
    setWorkflowModeDraft("general")
    setWorkflowPolicyDraft("balanced")
    setWorkflowBackgroundDraft(false)
    setWorkflowSchemaPresetDraft("none")
  }, [
    customWorkflowsDraft,
    workflowBackgroundDraft,
    workflowDescriptionDraft,
    workflowModeDraft,
    workflowPolicyDraft,
    workflowPromptDraft,
    workflowSchemaPresetDraft,
    workflowTitleDraft,
  ])

  const removeCustomWorkflow = React.useCallback((workflowId: string) => {
    setCustomWorkflowsDraft((prev) => prev.filter((workflow) => workflow.id !== workflowId))
  }, [])

  const selected = models.find((m) => m.id === openRouterModelDraft)
  const activeProviderMeta = LLM_PROVIDER_METADATA[providerDraft]
  const directProviderState =
    providerDraft === "gemini"
      ? {
          apiKeyId: "gemini-key",
          modelId: "gemini-model",
          apiKeyDraft: geminiApiKeyDraft,
          setApiKeyDraft: setGeminiApiKeyDraft,
          modelDraft: geminiModelDraft,
          setModelDraft: setGeminiModelDraft,
          showApiKey: showGeminiKey,
          setShowApiKey: setShowGeminiKey,
        }
      : providerDraft === "claude"
        ? {
            apiKeyId: "claude-key",
            modelId: "claude-model",
            apiKeyDraft: claudeApiKeyDraft,
            setApiKeyDraft: setClaudeApiKeyDraft,
            modelDraft: claudeModelDraft,
            setModelDraft: setClaudeModelDraft,
            showApiKey: showClaudeKey,
            setShowApiKey: setShowClaudeKey,
          }
        : providerDraft === "grok"
          ? {
              apiKeyId: "grok-key",
              modelId: "grok-model",
              apiKeyDraft: grokApiKeyDraft,
              setApiKeyDraft: setGrokApiKeyDraft,
              modelDraft: grokModelDraft,
              setModelDraft: setGrokModelDraft,
              showApiKey: showGrokKey,
              setShowApiKey: setShowGrokKey,
            }
          : null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={triggerVariant}
          size={triggerSize}
          className={cn("rounded-lg", triggerClassName)}
          aria-label={triggerAriaLabel}
        >
          <Settings className="h-4 w-4" />
          {triggerChildren}
        </Button>
      </DialogTrigger>
      <DialogShell
        className="bg-surface-2 w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] border shadow-none sm:w-140 sm:max-w-140"
        footer={
          <>
            {onRestartTour ? (
              <Button
                type="button"
                variant="ghost"
                className="gap-1.5"
                onClick={() => {
                  setOpen(false)
                  onRestartTour()
                }}
              >
                <PlayCircle className="h-4 w-4" />
                Tour
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={clear}>
              Reset
            </Button>
            <Button type="button" variant="outline" onClick={triggerImport} className="gap-2">
              <ArrowUpTray className="h-4 w-4" />
              Import
            </Button>
            <Button type="button" variant="outline" onClick={exportSettings} className="gap-2">
              <ArrowDownTray className="h-4 w-4" />
              Export
            </Button>
            <Button type="button" onClick={save}>
              Save
            </Button>
          </>
        }
        title={"Settings"}
        description={"Configure model, workflow, and upload settings."}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={importSettings}
          className="hidden"
        />

        {/* Tab bar */}
        <div className="bg-surface-2 border-border sticky top-0 z-10 flex shrink-0 border-b px-6">
          {(["model", "workflows", "uploads"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setSettingsTab(tab)}
              className={cn(
                "-mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                settingsTab === tab
                  ? "border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground border-transparent"
              )}
            >
              {tab === "model" ? "Model" : tab === "workflows" ? "Workflows" : "Uploads"}
            </button>
          ))}
        </div>

        {settingsTab === "model" ? (
          <div className="min-w-0 space-y-4 px-6 py-5">
            <div className="space-y-2">
              <Label>LLM provider</Label>
              <Select
                value={providerDraft}
                onValueChange={(value) => setProviderDraft(normalizeLlmProvider(value))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent>
                  {LLM_PROVIDER_OPTIONS.map((providerId) => (
                    <SelectItem key={providerId} value={providerId}>
                      {LLM_PROVIDER_METADATA[providerId].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                {activeProviderMeta.description} Keys are stored by the local server and reused
                across chat turns.
              </p>
            </div>

            <div className="bg-surface-3 border-border flex items-center justify-between gap-6 rounded-lg border px-3 py-2">
              <div className="min-w-0">
                <Label className="text-sm">Live mode</Label>
                <p className="text-muted-foreground text-xs">
                  Stream the assistant response as it generates.
                </p>
              </div>
              <Switch
                checked={liveModeDraft}
                onCheckedChange={setLiveModeDraft}
                aria-label="Toggle live mode"
              />
            </div>

            {providerDraft === "openrouter" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="openrouter-key">OpenRouter API key</Label>
                  <div className="flex gap-2">
                    <Input
                      id="openrouter-key"
                      type={showOpenRouterKey ? "text" : "password"}
                      placeholder="sk-or-v1-..."
                      value={openRouterApiKeyDraft}
                      onChange={(e) => setOpenRouterApiKeyDraft(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowOpenRouterKey((v) => !v)}
                      aria-label={showOpenRouterKey ? "Hide API key" : "Show API key"}
                    >
                      {showOpenRouterKey ? (
                        <EyeSlash className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Model</Label>
                  <div className="flex w-full min-w-0 flex-col gap-y-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void fetchModels()}
                      disabled={isLoadingModels}
                    >
                      {isLoadingModels ? "Fetching..." : "Fetch models"}
                    </Button>

                    <Command className="bg-surface-3 border-border w-full max-w-full min-w-0 rounded-lg border shadow-none">
                      <CommandInput placeholder="Search models..." />
                      <CommandList className="max-w-full">
                        {models.length === 0 && (
                          <CommandEmpty>
                            No models found. Click &quot;Fetch models&quot; to load, or type a model
                            id.
                          </CommandEmpty>
                        )}
                        {models.length !== 0 && (
                          <CommandGroup heading="OpenRouter models">
                            {models.map((m) => (
                              <CommandItem
                                key={m.id}
                                value={m.id}
                                className="min-w-0"
                                onSelect={() => {
                                  setOpenRouterModelDraft(m.id)
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    openRouterModelDraft === m.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="min-w-0">
                                  <div className="truncate">{m.id}</div>
                                  {m.contextLength ? (
                                    <div className="text-muted-foreground truncate text-xs">
                                      {m.name} • {m.contextLength.toLocaleString()} ctx
                                    </div>
                                  ) : m.name ? (
                                    <div className="text-muted-foreground truncate text-xs">
                                      {m.name}
                                    </div>
                                  ) : null}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </div>

                  <p className="text-muted-foreground text-xs">
                    Model list scrolls inside the dropdown.
                  </p>

                  <div className="space-y-1">
                    <Label htmlFor="openrouter-model" className="text-muted-foreground text-xs">
                      Or paste model id
                    </Label>
                    <Input
                      id="openrouter-model"
                      placeholder="openai/gpt-4o-mini"
                      value={openRouterModelDraft}
                      onChange={(e) => setOpenRouterModelDraft(e.target.value)}
                    />
                    {selected?.description ? (
                      <p className="text-muted-foreground text-xs">{selected.description}</p>
                    ) : null}
                  </div>
                </div>
              </>
            ) : providerDraft === "openai" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="openai-key">OpenAI API key</Label>
                  <div className="flex gap-2">
                    <Input
                      id="openai-key"
                      type={showOpenAIKey ? "text" : "password"}
                      placeholder="sk-..."
                      value={openAIApiKeyDraft}
                      onChange={(e) => setOpenAIApiKeyDraft(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowOpenAIKey((v) => !v)}
                      aria-label={showOpenAIKey ? "Hide API key" : "Show API key"}
                    >
                      {showOpenAIKey ? (
                        <EyeSlash className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Model</Label>
                  <div className="flex w-full min-w-0 flex-col gap-y-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void fetchOpenAIModels()}
                      disabled={isLoadingOpenAIModels}
                    >
                      {isLoadingOpenAIModels ? "Fetching..." : "Fetch models"}
                    </Button>

                    <Command className="bg-surface-3 border-border w-full max-w-full min-w-0 rounded-lg border shadow-none">
                      <CommandInput placeholder="Search models..." />
                      <CommandList className="max-w-full">
                        {openAIModels.length === 0 && (
                          <CommandEmpty>
                            No models found. Click &quot;Fetch models&quot; to load, or paste a
                            model id below.
                          </CommandEmpty>
                        )}
                        {openAIModels.length !== 0 && (
                          <CommandGroup heading="OpenAI models">
                            {openAIModels.map((m) => (
                              <CommandItem
                                key={m.id}
                                value={m.id}
                                className="min-w-0"
                                onSelect={() => setOpenAIModelDraft(m.id)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    openAIModelDraft === m.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="min-w-0">
                                  <div className="truncate">{m.id}</div>
                                  <div className="text-muted-foreground truncate text-xs">
                                    {m.owned_by}
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </div>

                  <p className="text-muted-foreground text-xs">
                    Model list scrolls inside the dropdown.
                  </p>

                  <div className="space-y-1">
                    <Label htmlFor="openai-model" className="text-muted-foreground text-xs">
                      Or paste model id
                    </Label>
                    <Input
                      id="openai-model"
                      placeholder="gpt-4o"
                      value={openAIModelDraft}
                      onChange={(e) => setOpenAIModelDraft(e.target.value)}
                    />
                  </div>
                </div>
              </>
            ) : directProviderState ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor={directProviderState.apiKeyId}>
                    {activeProviderMeta.apiKeyLabel}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id={directProviderState.apiKeyId}
                      type={directProviderState.showApiKey ? "text" : "password"}
                      placeholder={activeProviderMeta.apiKeyPlaceholder}
                      value={directProviderState.apiKeyDraft}
                      onChange={(e) => directProviderState.setApiKeyDraft(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => directProviderState.setShowApiKey((v) => !v)}
                      aria-label={directProviderState.showApiKey ? "Hide API key" : "Show API key"}
                    >
                      {directProviderState.showApiKey ? (
                        <EyeSlash className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={directProviderState.modelId}>
                    {activeProviderMeta.modelLabel}
                  </Label>
                  <Input
                    id={directProviderState.modelId}
                    placeholder={activeProviderMeta.modelPlaceholder}
                    value={directProviderState.modelDraft}
                    onChange={(e) => directProviderState.setModelDraft(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="azure-openai-key">Azure OpenAI API key</Label>
                  <div className="flex gap-2">
                    <Input
                      id="azure-openai-key"
                      type={showAzureKey ? "text" : "password"}
                      placeholder="..."
                      value={azureOpenAIApiKeyDraft}
                      onChange={(e) => setAzureOpenAIApiKeyDraft(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowAzureKey((v) => !v)}
                      aria-label={showAzureKey ? "Hide API key" : "Show API key"}
                    >
                      {showAzureKey ? (
                        <EyeSlash className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="azure-openai-endpoint">Azure OpenAI endpoint</Label>
                  <Input
                    id="azure-openai-endpoint"
                    placeholder="https://your-resource.openai.azure.com"
                    value={azureOpenAIEndpointDraft}
                    onChange={(e) => setAzureOpenAIEndpointDraft(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="azure-openai-deployment">Deployment</Label>
                  <Input
                    id="azure-openai-deployment"
                    placeholder="your-deployment-name"
                    value={azureOpenAIDeploymentDraft}
                    onChange={(e) => setAzureOpenAIDeploymentDraft(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="azure-openai-api-version">API version</Label>
                  <Input
                    id="azure-openai-api-version"
                    placeholder="2024-02-15-preview"
                    value={azureOpenAIApiVersionDraft}
                    onChange={(e) => setAzureOpenAIApiVersionDraft(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        ) : settingsTab === "workflows" ? (
          <div className="min-w-0 space-y-4 px-6 py-5">
            <div className="space-y-1">
              <div className="text-sm font-semibold">Custom workflow presets</div>
              <p className="text-muted-foreground text-xs">
                Saved workflows appear beside the built-in presets and reuse Rekdin mode, policy,
                background, and structured-output controls.
              </p>
            </div>

            <div className="bg-surface-3 border-border space-y-3 rounded-lg border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="workflow-title">Title</Label>
                  <Input
                    id="workflow-title"
                    placeholder="Security Review"
                    value={workflowTitleDraft}
                    onChange={(event) => setWorkflowTitleDraft(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workflow-description">Description</Label>
                  <Input
                    id="workflow-description"
                    placeholder="Review auth, secrets, and risky routes"
                    value={workflowDescriptionDraft}
                    onChange={(event) => setWorkflowDescriptionDraft(event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="workflow-prompt">Prompt template</Label>
                <Textarea
                  id="workflow-prompt"
                  value={workflowPromptDraft}
                  onChange={(event) => setWorkflowPromptDraft(event.target.value)}
                  placeholder="Inspect the selected workspace for security risks. Return findings, severity, evidence, and next steps."
                  className="min-h-24"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Agent mode</Label>
                  <Select
                    value={workflowModeDraft}
                    onValueChange={(value) => setWorkflowModeDraft(value as AgentMode)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AGENT_MODE_OPTIONS.map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {mode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tool policy</Label>
                  <Select
                    value={workflowPolicyDraft}
                    onValueChange={(value) => setWorkflowPolicyDraft(value as ToolPolicyProfile)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TOOL_POLICY_OPTIONS.map((policy) => (
                        <SelectItem key={policy} value={policy}>
                          {policy}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Response shape</Label>
                  <Select
                    value={workflowSchemaPresetDraft}
                    onValueChange={setWorkflowSchemaPresetDraft}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CUSTOM_WORKFLOW_SCHEMA_PRESETS.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="border-border flex flex-col items-start gap-3 rounded-lg border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <Label className="text-sm">Background capable</Label>
                    <p className="text-muted-foreground text-xs">Allow queueing this workflow.</p>
                  </div>
                  <Switch
                    checked={workflowBackgroundDraft}
                    onCheckedChange={setWorkflowBackgroundDraft}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="button" onClick={addCustomWorkflow}>
                  Add workflow
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {customWorkflowsDraft.length === 0 ? (
                <div className="text-muted-foreground border-border rounded-lg border px-3 py-6 text-center text-sm">
                  No custom workflows yet.
                </div>
              ) : (
                customWorkflowsDraft.map((workflow) => (
                  <div
                    key={workflow.id}
                    className="bg-surface-3 border-border rounded-lg border p-3"
                  >
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="min-w-0 text-sm font-semibold wrap-anywhere">
                            {workflow.title}
                          </p>
                          <Badge variant="secondary" className="shrink-0">
                            {workflow.mode}
                          </Badge>
                          {workflow.toolPolicy ? (
                            <Badge variant="outline" className="shrink-0">
                              {workflow.toolPolicy}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-muted-foreground mt-1 text-xs wrap-anywhere">
                          {workflow.description}
                        </p>
                        <p className="text-muted-foreground mt-2 line-clamp-2 text-xs">
                          {workflow.prompt}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() => removeCustomWorkflow(workflow.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="min-w-0 space-y-4 px-6 py-5">
            <div className="space-y-1">
              <div className="text-sm font-semibold">Cloudinary uploads</div>
              <p className="text-muted-foreground text-xs">
                Optional. When empty, Rekdin stores uploads locally under its data directory.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cloudinary-cloud-name">CLOUDINARY_CLOUD_NAME</Label>
              <Input
                id="cloudinary-cloud-name"
                placeholder="your-cloud-name"
                value={cloudNameDraft}
                onChange={(e) => setCloudNameDraft(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cloudinary-api-key">CLOUDINARY_API_KEY</Label>
              <div className="flex gap-2">
                <Input
                  id="cloudinary-api-key"
                  type={showCloudinaryKey ? "text" : "password"}
                  placeholder="cloudinary-api-key"
                  value={cloudKeyDraft}
                  onChange={(e) => setCloudKeyDraft(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowCloudinaryKey((v) => !v)}
                  aria-label={
                    showCloudinaryKey ? "Hide Cloudinary API key" : "Show Cloudinary API key"
                  }
                >
                  {showCloudinaryKey ? (
                    <EyeSlash className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cloudinary-api-secret">CLOUDINARY_API_SECRET</Label>
              <div className="flex gap-2">
                <Input
                  id="cloudinary-api-secret"
                  type={showCloudinarySecret ? "text" : "password"}
                  placeholder="cloudinary-api-secret"
                  value={cloudSecretDraft}
                  onChange={(e) => setCloudSecretDraft(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowCloudinarySecret((v) => !v)}
                  aria-label={
                    showCloudinarySecret
                      ? "Hide Cloudinary API secret"
                      : "Show Cloudinary API secret"
                  }
                >
                  {showCloudinarySecret ? (
                    <EyeSlash className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogShell>
    </Dialog>
  )
}
