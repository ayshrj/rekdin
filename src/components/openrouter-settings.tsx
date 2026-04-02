"use client"

import * as React from "react"
import { toast } from "sonner"

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
import { cn } from "@/lib/utils"

type OpenRouterModel = {
  id: string
  name: string
  description?: string
  contextLength?: number | null
}

type ProviderValue = "openrouter" | "openai" | "azure_openai"

function coerceProvider(value: string): ProviderValue {
  if (value === "openai" || value === "azure_openai") return value
  return "openrouter"
}

type SettingsExport = {
  llmProvider: string
  openRouterApiKey: string
  openRouterModel: string
  openAIApiKey: string
  openAIModel: string
  azureOpenAIApiKey: string
  azureOpenAIEndpoint: string
  azureOpenAIApiVersion: string
  azureOpenAIDeployment: string
  liveModeEnabled: boolean
  cloudinaryCloudName: string
  cloudinaryApiKey: string
  cloudinaryApiSecret: string
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
    hasOpenRouterApiKey,
    openRouterModel,
    openAIApiKey,
    openAIModel,
    azureOpenAIApiKey,
    azureOpenAIEndpoint,
    azureOpenAIApiVersion,
    azureOpenAIDeployment,
    liveModeEnabled,
    cloudinaryCloudName,
    cloudinaryApiKey,
    cloudinaryApiSecret,
    updateLlmSettings,
    updateCloudinarySettings,
  } = useChat()
  const [open, setOpen] = React.useState(false)
  const [showOpenRouterKey, setShowOpenRouterKey] = React.useState(false)
  const [showOpenAIKey, setShowOpenAIKey] = React.useState(false)
  const [showAzureKey, setShowAzureKey] = React.useState(false)
  const [showCloudinaryKey, setShowCloudinaryKey] = React.useState(false)
  const [showCloudinarySecret, setShowCloudinarySecret] = React.useState(false)

  const [providerDraft, setProviderDraft] = React.useState<ProviderValue>(() =>
    coerceProvider(llmProvider)
  )
  const [openRouterApiKeyDraft, setOpenRouterApiKeyDraft] = React.useState("")
  const [openRouterModelDraft, setOpenRouterModelDraft] = React.useState("")
  const [openAIApiKeyDraft, setOpenAIApiKeyDraft] = React.useState("")
  const [openAIModelDraft, setOpenAIModelDraft] = React.useState("")
  const [azureOpenAIApiKeyDraft, setAzureOpenAIApiKeyDraft] = React.useState("")
  const [azureOpenAIEndpointDraft, setAzureOpenAIEndpointDraft] = React.useState("")
  const [azureOpenAIApiVersionDraft, setAzureOpenAIApiVersionDraft] = React.useState("")
  const [azureOpenAIDeploymentDraft, setAzureOpenAIDeploymentDraft] = React.useState("")
  const [liveModeDraft, setLiveModeDraft] = React.useState(true)
  const [cloudNameDraft, setCloudNameDraft] = React.useState("")
  const [cloudKeyDraft, setCloudKeyDraft] = React.useState("")
  const [cloudSecretDraft, setCloudSecretDraft] = React.useState("")
  const [models, setModels] = React.useState<OpenRouterModel[]>([])
  const [isLoadingModels, setIsLoadingModels] = React.useState(false)

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!open) return
    setProviderDraft(coerceProvider(llmProvider))
    setOpenRouterApiKeyDraft(openRouterApiKey)
    setOpenRouterModelDraft(openRouterModel)
    setOpenAIApiKeyDraft(openAIApiKey)
    setOpenAIModelDraft(openAIModel)
    setAzureOpenAIApiKeyDraft(azureOpenAIApiKey)
    setAzureOpenAIEndpointDraft(azureOpenAIEndpoint)
    setAzureOpenAIApiVersionDraft(azureOpenAIApiVersion)
    setAzureOpenAIDeploymentDraft(azureOpenAIDeployment)
    setLiveModeDraft(liveModeEnabled)
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
    azureOpenAIApiKey,
    azureOpenAIEndpoint,
    azureOpenAIApiVersion,
    azureOpenAIDeployment,
    liveModeEnabled,
    cloudinaryCloudName,
    cloudinaryApiKey,
    cloudinaryApiSecret,
  ])

  const fetchModels = React.useCallback(async () => {
    if (providerDraft !== "openrouter") {
      toast.error("Model fetch is available only for OpenRouter")
      return
    }
    if (!openRouterApiKeyDraft.trim() && !hasOpenRouterApiKey) {
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
  }, [hasOpenRouterApiKey, openRouterApiKeyDraft, providerDraft])

  const save = React.useCallback(() => {
    updateLlmSettings({
      provider: providerDraft as "openrouter" | "openai" | "azure_openai",
      openRouterApiKey: openRouterApiKeyDraft,
      openRouterModel: openRouterModelDraft,
      openAIApiKey: openAIApiKeyDraft,
      openAIModel: openAIModelDraft,
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
    toast.success("Settings saved")
    setOpen(false)
  }, [
    providerDraft,
    openRouterApiKeyDraft,
    openRouterModelDraft,
    openAIApiKeyDraft,
    openAIModelDraft,
    azureOpenAIApiKeyDraft,
    azureOpenAIEndpointDraft,
    azureOpenAIApiVersionDraft,
    azureOpenAIDeploymentDraft,
    liveModeDraft,
    cloudNameDraft,
    cloudKeyDraft,
    cloudSecretDraft,
    updateLlmSettings,
    updateCloudinarySettings,
  ])

  const clear = React.useCallback(() => {
    setProviderDraft("openrouter")
    setOpenRouterApiKeyDraft("")
    setOpenRouterModelDraft("openai/gpt-4o-mini")
    setOpenAIApiKeyDraft("")
    setOpenAIModelDraft("gpt-4o-mini")
    setAzureOpenAIApiKeyDraft("")
    setAzureOpenAIEndpointDraft("")
    setAzureOpenAIApiVersionDraft("2024-02-15-preview")
    setAzureOpenAIDeploymentDraft("")
    setLiveModeDraft(true)
    setCloudNameDraft("")
    setCloudKeyDraft("")
    setCloudSecretDraft("")
    updateLlmSettings({
      provider: "openrouter",
      openRouterApiKey: "",
      openRouterModel: "openai/gpt-4o-mini",
      openAIApiKey: "",
      openAIModel: "gpt-4o-mini",
      azureOpenAIApiKey: "",
      azureOpenAIEndpoint: "",
      azureOpenAIApiVersion: "2024-02-15-preview",
      azureOpenAIDeployment: "",
      liveModeEnabled: true,
    })
    updateCloudinarySettings({ cloudName: "", apiKey: "", apiSecret: "" })
    toast.success("Cleared saved settings")
  }, [updateCloudinarySettings, updateLlmSettings])

  const exportSettings = React.useCallback(() => {
    const settings: SettingsExport = {
      llmProvider: providerDraft,
      openRouterApiKey: openRouterApiKeyDraft,
      openRouterModel: openRouterModelDraft,
      openAIApiKey: openAIApiKeyDraft,
      openAIModel: openAIModelDraft,
      azureOpenAIApiKey: azureOpenAIApiKeyDraft,
      azureOpenAIEndpoint: azureOpenAIEndpointDraft,
      azureOpenAIApiVersion: azureOpenAIApiVersionDraft,
      azureOpenAIDeployment: azureOpenAIDeploymentDraft,
      liveModeEnabled: liveModeDraft,
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
    azureOpenAIApiKeyDraft,
    azureOpenAIEndpointDraft,
    azureOpenAIApiVersionDraft,
    azureOpenAIDeploymentDraft,
    liveModeDraft,
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

        setProviderDraft(coerceProvider(settings.llmProvider || "openrouter"))
        setOpenRouterApiKeyDraft(settings.openRouterApiKey || "")
        setOpenRouterModelDraft(settings.openRouterModel || "")
        setOpenAIApiKeyDraft(settings.openAIApiKey || "")
        setOpenAIModelDraft(settings.openAIModel || "")
        setAzureOpenAIApiKeyDraft(settings.azureOpenAIApiKey || "")
        setAzureOpenAIEndpointDraft(settings.azureOpenAIEndpoint || "")
        setAzureOpenAIApiVersionDraft(settings.azureOpenAIApiVersion || "")
        setAzureOpenAIDeploymentDraft(settings.azureOpenAIDeployment || "")
        setLiveModeDraft(settings.liveModeEnabled ?? true)
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

  const selected = models.find((m) => m.id === openRouterModelDraft)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={triggerVariant}
          size={triggerSize}
          className={cn("rounded-full", triggerClassName)}
          aria-label={triggerAriaLabel}
        >
          <Settings className="h-4 w-4" />
          {triggerChildren}
        </Button>
      </DialogTrigger>
      <DialogShell
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
        description={
          "Configure model and upload settings for this local Rekdin server. Settings are persisted on the server and used by chat, uploads, and cleanup routes."
        }
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={importSettings}
          className="hidden"
        />

        <div className="space-y-4 px-6 py-4">
          <div className="space-y-2">
            <Label>LLM provider</Label>
            <Select
              value={providerDraft}
              onValueChange={(value) => setProviderDraft(coerceProvider(value))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openrouter">OpenRouter</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="azure_openai">Azure OpenAI</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Keys are stored by the local server and reused across chat turns.
            </p>
          </div>

          <div className="flex items-center justify-between gap-6 rounded-lg border px-3 py-2">
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
                <div className="flex w-full flex-col gap-y-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void fetchModels()}
                    disabled={isLoadingModels}
                  >
                    {isLoadingModels ? "Fetching..." : "Fetch models"}
                  </Button>

                  <Command className="rounded-lg border shadow-md md:min-w-112.5">
                    <CommandInput placeholder="Search models..." />
                    <CommandList>
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
                    {showOpenAIKey ? <EyeSlash className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="openai-model">Model</Label>
                <Input
                  id="openai-model"
                  placeholder="gpt-4o-mini"
                  value={openAIModelDraft}
                  onChange={(e) => setOpenAIModelDraft(e.target.value)}
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
                    {showAzureKey ? <EyeSlash className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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

          <div className="space-y-2 border-t pt-4">
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
                {showCloudinaryKey ? <EyeSlash className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                  showCloudinarySecret ? "Hide Cloudinary API secret" : "Show Cloudinary API secret"
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
      </DialogShell>
    </Dialog>
  )
}
