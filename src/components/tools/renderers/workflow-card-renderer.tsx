"use client"

import {
  EmptyState,
  RawPayloadDisclosure,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { getBoolean, getResult, getString, pickArray, stableKey } from "./renderer-utils"
import { type ToolResultContentPart } from "./tool-result-renderer"

export function WorkflowCardRenderer({ part }: { part: ToolResultContentPart }) {
  const result = getResult(part)
  const workflows = pickArray(result, ["workflows", "presets", "items", "results"])
  const builtIn = workflows.filter(
    (workflow) => getString(workflow.kind ?? workflow.source) !== "custom"
  )
  const custom = workflows.filter(
    (workflow) => getString(workflow.kind ?? workflow.source) === "custom"
  )
  const differences = pickArray(result, ["differences", "changes", "diff"])
  const findings = pickArray(result, ["findings", "errors", "warnings", "issues"])

  return (
    <ToolRendererShell
      className="border-tool-json/25"
      header={
        <>
          <span className="text-foreground min-w-0 flex-1 truncate font-mono text-[11px] font-semibold">
            {getString(part.toolName ?? part.type, "workflow_inventory")}
          </span>
          <ToolStatusBadge variant="neutral">{workflows.length} workflows</ToolStatusBadge>
          <ToolStatusBadge variant="neutral">{custom.length} custom</ToolStatusBadge>
          {findings.length ? (
            <ToolStatusBadge variant="warning">{findings.length} issues</ToolStatusBadge>
          ) : null}
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {part.type === "workflow_validate" && findings.length ? (
        <div className="max-h-[44vh] divide-y overflow-auto">
          {findings.map((finding, index) => (
            <div key={stableKey(index, finding.workflow)} className="px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <ToolStatusBadge
                  variant={
                    getString(finding.severity).toLowerCase() === "error" ? "error" : "warning"
                  }
                >
                  {getString(finding.severity, "issue")}
                </ToolStatusBadge>
                <span className="text-foreground/85 min-w-0 truncate font-mono text-[11px]">
                  {getString(finding.workflow ?? finding.id ?? finding.name)}
                </span>
              </div>
              <div className="text-muted-foreground mt-1 font-mono text-[10px]">
                {getString(finding.message ?? finding.reason ?? finding.detail)}
              </div>
            </div>
          ))}
        </div>
      ) : part.type === "workflow_compare" && differences.length ? (
        <div className="max-h-[44vh] divide-y overflow-auto">
          {differences.map((difference, index) => (
            <div
              key={stableKey(index, difference.field)}
              className="grid gap-2 px-3 py-2 font-mono text-[11px] sm:grid-cols-[9rem_1fr_1fr]"
            >
              <span className="text-muted-foreground">
                {getString(difference.field ?? difference.name)}
              </span>
              <span className="bg-surface-4 rounded px-2 py-1">
                {getString(difference.left ?? difference.before)}
              </span>
              <span className="bg-surface-4 rounded px-2 py-1">
                {getString(difference.right ?? difference.after)}
              </span>
            </div>
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <EmptyState>No workflows returned</EmptyState>
      ) : (
        <div className="max-h-[44vh] divide-y overflow-auto">
          {workflows.map((workflow, index) => (
            <div
              key={stableKey(index, workflow.id)}
              className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-3 py-1.5 font-mono text-[11px]"
            >
              <div className="min-w-0">
                <div className="text-foreground/85 truncate">
                  {getString(workflow.id ?? workflow.name)}
                </div>
                <div className="text-muted-foreground text-[10px]">
                  {getString(workflow.title ?? workflow.description)}
                </div>
              </div>
              <ToolStatusBadge variant="neutral">
                {getString(workflow.mode, "mode")}
              </ToolStatusBadge>
              <ToolStatusBadge variant="neutral">
                {getString(workflow.policy ?? workflow.toolPolicy, "policy")}
              </ToolStatusBadge>
              <ToolStatusBadge
                variant={
                  getBoolean(workflow.supportsBackground ?? workflow.background)
                    ? "success"
                    : "neutral"
                }
              >
                bg {getBoolean(workflow.supportsBackground ?? workflow.background) ? "yes" : "no"}
              </ToolStatusBadge>
            </div>
          ))}
          {builtIn.length || custom.length ? (
            <div className="text-muted-foreground px-3 py-1.5 font-mono text-[10px]">
              built-in: {builtIn.length} · custom: {custom.length}
            </div>
          ) : null}
        </div>
      )}
    </ToolRendererShell>
  )
}
