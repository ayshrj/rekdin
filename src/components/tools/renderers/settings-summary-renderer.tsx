"use client"

import { useState } from "react"

import {
  EmptyState,
  RawPayloadDisclosure,
  RendererTab,
  RendererTabBar,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

export function SettingsSummaryRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined
  const [tab, setTab] = useState<"providers" | "workspace" | "workflows">("providers")

  const providerLabel = result?.selectedProviderLabel
    ? String(result.selectedProviderLabel)
    : result?.selectedProvider
      ? String(result.selectedProvider)
      : undefined
  const providerReady = result?.selectedProviderReady === true
  const selectedModel = result?.selectedModel ? String(result.selectedModel) : undefined

  const providers = Array.isArray(result?.providers)
    ? (result.providers as Record<string, unknown>[])
    : []

  const workspaceRoot = result?.workspaceRoot ? String(result.workspaceRoot) : undefined
  const currentSessionId = result?.currentSessionId ? String(result.currentSessionId) : undefined
  const liveModeEnabled = result?.liveModeEnabled === true

  const uploads =
    result?.uploads && typeof result.uploads === "object" && !Array.isArray(result.uploads)
      ? (result.uploads as Record<string, unknown>)
      : {}

  const workflows =
    result?.workflows && typeof result.workflows === "object" && !Array.isArray(result.workflows)
      ? (result.workflows as Record<string, unknown>)
      : {}
  const builtInCount = typeof workflows.builtInCount === "number" ? workflows.builtInCount : 0
  const customCount = typeof workflows.customCount === "number" ? workflows.customCount : 0
  const customWorkflows = Array.isArray(workflows.customWorkflows)
    ? (workflows.customWorkflows as Record<string, unknown>[])
    : []

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Settings</span>
          {providerLabel && (
            <span className="rk-path-chip max-w-28 min-w-0 truncate">{providerLabel}</span>
          )}
          <ToolStatusBadge variant={providerReady ? "success" : "warning"}>
            {providerReady ? "ready" : "not ready"}
          </ToolStatusBadge>
          {selectedModel && (
            <span className="rk-path-chip max-w-32 min-w-0 truncate">{selectedModel}</span>
          )}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      <RendererTabBar>
        <RendererTab active={tab === "providers"} onClick={() => setTab("providers")}>
          Providers
        </RendererTab>
        <RendererTab active={tab === "workspace"} onClick={() => setTab("workspace")}>
          Workspace
        </RendererTab>
        <RendererTab active={tab === "workflows"} onClick={() => setTab("workflows")}>
          Workflows
        </RendererTab>
      </RendererTabBar>

      {tab === "providers" && (
        <div className="rk-scrollbar max-h-[45vh] divide-y overflow-auto">
          {providers.length === 0 ? (
            <EmptyState>No provider data</EmptyState>
          ) : (
            providers.map((p, i) => {
              const label = String(p.label ?? p.provider ?? `Provider ${i + 1}`)
              const selected = p.selected === true
              const configured = p.configured === true
              const model = p.model ? String(p.model) : undefined

              return (
                <div key={i} className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
                  {selected && (
                    <span className="text-primary shrink-0 font-mono text-[10px]">★</span>
                  )}
                  <span
                    className={`min-w-0 flex-1 truncate font-mono text-[11px] ${
                      selected ? "text-foreground font-medium" : "text-foreground/70"
                    }`}
                  >
                    {label}
                  </span>
                  {model && <span className="rk-path-chip max-w-32 min-w-0 truncate">{model}</span>}
                  <ToolStatusBadge variant={configured ? "success" : "neutral"}>
                    {configured ? "✓" : "✗"}
                  </ToolStatusBadge>
                </div>
              )
            })
          )}
        </div>
      )}

      {tab === "workspace" && (
        <div className="rk-scrollbar max-h-[45vh] divide-y overflow-auto">
          {workspaceRoot && (
            <div className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
              <span className="text-muted-foreground w-28 min-w-0 shrink-0 font-mono text-[10px]">
                workspace
              </span>
              <span className="rk-path-chip min-w-0 flex-1 truncate">{workspaceRoot}</span>
            </div>
          )}
          {currentSessionId && (
            <div className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
              <span className="text-muted-foreground w-28 shrink-0 font-mono text-[10px]">
                session
              </span>
              <span className="text-foreground/70 min-w-0 flex-1 truncate font-mono text-[11px]">
                {currentSessionId}
              </span>
            </div>
          )}
          <div className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
            <span className="text-muted-foreground w-28 shrink-0 font-mono text-[10px]">
              live mode
            </span>
            <ToolStatusBadge variant={liveModeEnabled ? "success" : "neutral"}>
              {liveModeEnabled ? "on" : "off"}
            </ToolStatusBadge>
          </div>
          <div className="px-3 py-1.5">
            <span className="rk-section-label">Uploads (Cloudinary)</span>
          </div>
          {(
            [
              ["cloud name", "cloudNameConfigured"],
              ["api key", "apiKeyConfigured"],
              ["api secret", "apiSecretConfigured"],
            ] as [string, string][]
          ).map(([label, key]) => (
            <div key={key} className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
              <span className="text-muted-foreground w-28 shrink-0 font-mono text-[10px]">
                {label}
              </span>
              <ToolStatusBadge variant={uploads[key] === true ? "success" : "neutral"}>
                {uploads[key] === true ? "✓" : "✗"}
              </ToolStatusBadge>
            </div>
          ))}
        </div>
      )}

      {tab === "workflows" && (
        <div className="rk-scrollbar max-h-[45vh] overflow-auto">
          <div className="flex items-center gap-3 border-b px-3 py-1.5">
            <span className="text-foreground/70 font-mono text-[11px]">
              {builtInCount} built-in
            </span>
            <span className="text-muted-foreground font-mono text-[10px]">·</span>
            <span className="text-foreground/70 font-mono text-[11px]">{customCount} custom</span>
          </div>
          {customWorkflows.length === 0 ? (
            <EmptyState>No custom workflows</EmptyState>
          ) : (
            <div className="divide-y">
              {customWorkflows.map((wf, i) => {
                const title = String(wf.title ?? wf.id ?? `Workflow ${i + 1}`)
                const mode = wf.mode ? String(wf.mode) : undefined
                const bg = wf.supportsBackground === true

                return (
                  <div key={i} className="hover:bg-surface-4 flex items-center gap-2 px-3 py-1.5">
                    <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-[11px]">
                      {title}
                    </span>
                    {mode && <span className="rk-path-chip shrink-0">{mode}</span>}
                    {bg && (
                      <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                        bg
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </ToolRendererShell>
  )
}
