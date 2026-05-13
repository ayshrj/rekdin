import { z } from "zod"

import { previewString } from "../shared/formatting"
import { emptySchema, finding, toolDefinition } from "../shared/tool-base"

export const workflowInventoryTool = toolDefinition(
  "workflow_inventory",
  "List Rekdin workflows and settings.",
  emptySchema,
  async () => {
    const workflows = await import("@/lib/workflows")
    const presets = workflows.getAllWorkflowPresets?.() ?? []
    return { type: "workflow_inventory", workflows: presets }
  }
)

export const workflowValidateTool = toolDefinition(
  "workflow_validate",
  "Check workflows for missing tools, models, schemas, or invalid mode settings.",
  emptySchema,
  async () => {
    const inventory = (await workflowInventoryTool.invoke({})) as {
      workflows?: Array<Record<string, unknown>>
    }
    const findings = (inventory.workflows ?? [])
      .filter((workflow) => !workflow.id || !workflow.mode)
      .map((workflow) =>
        finding(
          "error",
          "workflow",
          undefined,
          `Invalid workflow: ${JSON.stringify(workflow).slice(0, 120)}`
        )
      )
    return { type: "workflow_validate", findings, workflows: inventory.workflows ?? [] }
  }
)

export const workflowRunDryTool = toolDefinition(
  "workflow_run_dry",
  "Dry-run a workflow with a sample prompt and return trace metadata without calling a model.",
  z.object({ workflowId: z.string().min(1), prompt: z.string().optional() }),
  async ({ workflowId, prompt }) => ({
    type: "workflow_run_dry",
    workflowId,
    promptPreview: previewString(prompt, 300),
    wouldRun: true,
    modelCalled: false,
  })
)

export const workflowCompareTool = toolDefinition(
  "workflow_compare",
  "Compare two workflow presets.",
  z.object({ left: z.string().min(1), right: z.string().min(1) }),
  async ({ left, right }) => {
    const inventory = (await workflowInventoryTool.invoke({})) as {
      workflows?: Array<Record<string, unknown>>
    }
    const leftWorkflow = (inventory.workflows ?? []).find((workflow) => workflow.id === left)
    const rightWorkflow = (inventory.workflows ?? []).find((workflow) => workflow.id === right)
    const keys = new Set([...Object.keys(leftWorkflow ?? {}), ...Object.keys(rightWorkflow ?? {})])
    return {
      type: "workflow_compare",
      differences: [...keys]
        .filter(
          (key) => JSON.stringify(leftWorkflow?.[key]) !== JSON.stringify(rightWorkflow?.[key])
        )
        .map((key) => ({ field: key, left: leftWorkflow?.[key], right: rightWorkflow?.[key] })),
    }
  }
)
