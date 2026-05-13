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
import { getResult, getString, pickArray, pickStringArray, stableKey } from "./renderer-utils"
import { type ToolResultContentPart } from "./tool-result-renderer"

function normalizeStatus(value: unknown): "done" | "pending" | "blocked" {
  const status = getString(value).toLowerCase()
  if (["done", "completed", "complete", "success"].includes(status)) return "done"
  if (["blocked", "failed", "error"].includes(status)) return "blocked"
  return "pending"
}

export function AgentPlanRenderer({ part }: { part: ToolResultContentPart }) {
  const result = getResult(part)
  const [tab, setTab] = useState<"plan" | "risks" | "raw">(
    part.type === "agent_regression_risk" ? "risks" : "plan"
  )
  const steps = (() => {
    // agent_worklog may return separate completed/pending/blocked arrays instead of a unified steps array
    const unified = pickArray(result, ["steps", "items"])
    if (unified.length) {
      return unified.map((step) => ({
        text: getString(step.step ?? step.text ?? step.title ?? step.description),
        status: normalizeStatus(step.status ?? step.state),
        detail: getString(step.detail ?? step.reason ?? step.blockedReason),
      }))
    }
    const completed = pickArray(result, ["completed"]).map((step) => ({
      text: getString(step.step ?? step.text ?? step.title ?? step.description),
      status: "done" as const,
      detail: getString(step.detail ?? step.reason),
    }))
    const pending = pickArray(result, ["pending"]).map((step) => ({
      text: getString(step.step ?? step.text ?? step.title ?? step.description),
      status: "pending" as const,
      detail: getString(step.detail ?? step.reason),
    }))
    const blocked = pickArray(result, ["blocked"]).map((step) => ({
      text: getString(step.step ?? step.text ?? step.title ?? step.description),
      status: "blocked" as const,
      detail: getString(step.detail ?? step.reason ?? step.blockedReason),
    }))
    return [...completed, ...pending, ...blocked]
  })()
  const risks = pickArray(result, ["risks", "impacts", "regressions", "files", "items"])
  const riskCount = risks.length || pickStringArray(result, ["risks"]).length

  return (
    <ToolRendererShell
      className="border-tool-code/25"
      header={
        <>
          <span className="text-foreground min-w-0 flex-1 truncate font-mono text-[11px] font-semibold">
            {getString(part.toolName ?? part.type, "agent_plan")}
          </span>
          <ToolStatusBadge variant="neutral">{steps.length} steps</ToolStatusBadge>
          <ToolStatusBadge variant={riskCount ? "warning" : "neutral"}>
            {riskCount} risks
          </ToolStatusBadge>
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      <RendererTabBar>
        <RendererTab active={tab === "plan"} onClick={() => setTab("plan")}>
          Plan
        </RendererTab>
        <RendererTab active={tab === "risks"} onClick={() => setTab("risks")}>
          Risks
        </RendererTab>
        <RendererTab active={tab === "raw"} onClick={() => setTab("raw")}>
          Raw
        </RendererTab>
      </RendererTabBar>
      {tab === "plan" ? (
        steps.length === 0 ? (
          <EmptyState>No plan steps returned</EmptyState>
        ) : (
          <ol className="divide-y">
            {steps.map((step, index) => (
              <li key={stableKey(index, step.text)} className="px-3 py-2">
                <div className="flex gap-2">
                  <ToolStatusBadge
                    variant={
                      step.status === "done"
                        ? "success"
                        : step.status === "blocked"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {step.status}
                  </ToolStatusBadge>
                  <span className="text-foreground/85 font-mono text-[11px]">
                    {index + 1}. {step.text || "Untitled step"}
                  </span>
                </div>
                {step.detail ? (
                  <div className="text-muted-foreground mt-1 pl-16 text-[10px]">{step.detail}</div>
                ) : null}
              </li>
            ))}
          </ol>
        )
      ) : tab === "risks" ? (
        risks.length === 0 ? (
          <EmptyState>No risks returned</EmptyState>
        ) : (
          <div className="divide-y">
            {risks.map((risk, index) => (
              <div key={stableKey(index, risk.file)} className="px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <ToolStatusBadge variant="warning">
                    {getString(risk.severity ?? risk.level, "risk")}
                  </ToolStatusBadge>
                  <span className="rk-path-chip min-w-0 truncate">
                    {getString(risk.file ?? risk.path ?? risk.name, "affected area")}
                  </span>
                </div>
                <div className="text-muted-foreground mt-1 font-mono text-[10px]">
                  {getString(risk.reason ?? risk.message ?? risk.impact ?? risk.detail)}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <RawPayloadDisclosure payload={result} defaultOpen />
      )}
    </ToolRendererShell>
  )
}
