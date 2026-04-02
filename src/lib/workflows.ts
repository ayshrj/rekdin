import { WorkflowPreset } from "@/types/runtime"

export const WORKFLOW_PRESETS: WorkflowPreset[] = [
  {
    id: "research-plan",
    title: "Research Plan",
    description: "Turn a topic into a scoped research plan with search angles and deliverables.",
    mode: "research",
    category: "research",
    supportsBackground: true,
    prompt:
      "Create a research plan for this topic. Identify the core questions, propose concrete search queries, and define the deliverable shape before full research begins.",
    responseSchema: {
      type: "object",
      required: ["topic", "objective", "questions", "searchQueries", "deliverables"],
      properties: {
        topic: { type: "string" },
        objective: { type: "string" },
        questions: { type: "array", items: { type: "string" }, minItems: 3 },
        searchQueries: { type: "array", items: { type: "string" }, minItems: 3 },
        deliverables: { type: "array", items: { type: "string" }, minItems: 2 },
      },
    },
  },
  {
    id: "research-report",
    title: "Research Report",
    description: "Collect evidence and return a structured report with findings and sources.",
    mode: "research",
    category: "research",
    supportsBackground: true,
    prompt:
      "Research this topic carefully, compare sources, and produce a concise report with findings, tradeoffs, confidence notes, and citations.",
    responseSchema: {
      type: "object",
      required: ["title", "executiveSummary", "keyFindings", "sources"],
      properties: {
        title: { type: "string" },
        executiveSummary: { type: "string" },
        keyFindings: {
          type: "array",
          items: {
            type: "object",
            required: ["claim", "evidence", "confidence"],
            properties: {
              claim: { type: "string" },
              evidence: { type: "string" },
              confidence: { type: "string" },
            },
          },
          minItems: 2,
        },
        tradeoffs: {
          type: "array",
          items: { type: "string" },
        },
        nextSteps: {
          type: "array",
          items: { type: "string" },
        },
        sources: {
          type: "array",
          items: {
            type: "object",
            required: ["title", "url", "whyItMatters"],
            properties: {
              title: { type: "string" },
              url: { type: "string" },
              whyItMatters: { type: "string" },
            },
          },
          minItems: 2,
        },
      },
    },
  },
  {
    id: "browser-extract",
    title: "Browse & Extract",
    description: "Use browser tools to inspect a page and return structured extracted data.",
    mode: "browser",
    category: "browser",
    supportsBackground: true,
    prompt:
      "Use the browser to inspect the target page, extract the requested information, and verify the result before finishing.",
  },
  {
    id: "workspace-edit",
    title: "Workspace Edit",
    description: "Inspect files, make targeted edits, and verify the outcome before completion.",
    mode: "workspace",
    category: "workspace",
    prompt:
      "Inspect the relevant files first, make the minimum necessary edits, and verify the final state before reporting completion.",
  },
  {
    id: "repo-audit",
    title: "Repo Audit",
    description: "Inspect the codebase and return a structured architecture and risk summary.",
    mode: "workspace",
    category: "code",
    supportsBackground: true,
    prompt:
      "Inspect this repository, identify the main entry points and risky areas, and return a structured audit with priorities and next steps.",
    responseSchema: {
      type: "object",
      required: ["summary", "entryPoints", "risks", "recommendedNextSteps"],
      properties: {
        summary: { type: "string" },
        entryPoints: { type: "array", items: { type: "string" }, minItems: 2 },
        risks: {
          type: "array",
          items: {
            type: "object",
            required: ["title", "severity", "reason"],
            properties: {
              title: { type: "string" },
              severity: { type: "string" },
              reason: { type: "string" },
            },
          },
        },
        recommendedNextSteps: { type: "array", items: { type: "string" }, minItems: 2 },
      },
    },
  },
  {
    id: "diff-review",
    title: "Diff Review",
    description: "Review current git changes and return a structured summary with findings.",
    mode: "workspace",
    category: "code",
    prompt:
      "Review the current git changes. Summarize the diff, call out the most important risks, and list follow-up validation steps.",
    responseSchema: {
      type: "object",
      required: ["summary", "findings", "validation"],
      properties: {
        summary: { type: "string" },
        findings: {
          type: "array",
          items: {
            type: "object",
            required: ["title", "severity", "detail"],
            properties: {
              title: { type: "string" },
              severity: { type: "string" },
              detail: { type: "string" },
            },
          },
        },
        validation: { type: "array", items: { type: "string" }, minItems: 1 },
      },
    },
  },
  {
    id: "generate-document",
    title: "Generate Document",
    description: "Create a polished markdown/LaTeX document and verify the produced artifact.",
    mode: "document",
    category: "document",
    prompt:
      "Generate the requested document, produce the artifact, and verify the output path or URL before claiming success.",
  },
]

export function getWorkflowPreset(workflowId?: string | null) {
  if (!workflowId) return null
  return WORKFLOW_PRESETS.find((workflow) => workflow.id === workflowId) ?? null
}

export function parseStructuredWorkflowContent(content: string) {
  const trimmed = content.trim()
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null
  try {
    return JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    return null
  }
}
