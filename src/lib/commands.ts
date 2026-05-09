import { WorkflowPreset } from "@/types/runtime"

export type SlashCommandHandlerType = "workflow" | "client_action"

export type SlashCommandId =
  | "research"
  | "audit"
  | "diff"
  | "workspace"
  | "settings"
  | "export"
  | "clear"
  | "help"

export interface SlashCommandDefinition {
  id: SlashCommandId
  label: string
  usage: string
  description: string
  handlerType: SlashCommandHandlerType
  workflowId?: string
  backgroundPreferred?: boolean
}

export interface ParsedSlashCommand {
  command: SlashCommandDefinition
  args: string
}

export const SLASH_COMMANDS: SlashCommandDefinition[] = [
  {
    id: "research",
    label: "Research",
    usage: "/research <topic>",
    description: "Run the Research Report workflow for a topic.",
    handlerType: "workflow",
    workflowId: "research-report",
  },
  {
    id: "audit",
    label: "Repo Audit",
    usage: "/audit <scope>",
    description: "Queue or run a repository audit against the selected workspace.",
    handlerType: "workflow",
    workflowId: "repo-audit",
    backgroundPreferred: true,
  },
  {
    id: "diff",
    label: "Diff Review",
    usage: "/diff",
    description: "Review current git changes in the selected workspace.",
    handlerType: "workflow",
    workflowId: "diff-review",
  },
  {
    id: "workspace",
    label: "Workspace",
    usage: "/workspace",
    description: "Open workspace settings and the folder browser.",
    handlerType: "client_action",
  },
  {
    id: "settings",
    label: "Settings",
    usage: "/settings",
    description: "Open model, workspace, workflow, and upload settings.",
    handlerType: "client_action",
  },
  {
    id: "export",
    label: "Export",
    usage: "/export",
    description: "Export the current session bundle.",
    handlerType: "client_action",
  },
  {
    id: "clear",
    label: "Clear",
    usage: "/clear",
    description: "Start a new empty session.",
    handlerType: "client_action",
  },
  {
    id: "help",
    label: "Help",
    usage: "/help",
    description: "Show available slash commands.",
    handlerType: "client_action",
  },
]

export function parseSlashCommand(input: string): ParsedSlashCommand | null {
  const trimmed = input.trim()
  if (!trimmed.startsWith("/")) return null
  const [, rawCommand = "", args = ""] = trimmed.match(/^\/(\S+)\s*([\s\S]*)$/) ?? []
  const command = SLASH_COMMANDS.find((entry) => entry.id === rawCommand.toLowerCase())
  if (!command) return null
  return { command, args: args.trim() }
}

export function renderSlashCommandHelp() {
  return SLASH_COMMANDS.map(
    (command) => `${command.usage.padEnd(20, " ")} ${command.description}`
  ).join("\n")
}

export function buildWorkflowPrompt(workflow: WorkflowPreset, args: string) {
  if (!args.trim()) return workflow.prompt
  if (workflow.prompt.includes("[your topic]")) {
    return workflow.prompt.replace("[your topic]", args.trim())
  }
  if (workflow.prompt.includes("[URL or target page]")) {
    return workflow.prompt.replace("[URL or target page]", args.trim())
  }
  if (workflow.prompt.includes("[document type or description]")) {
    return workflow.prompt.replace("[document type or description]", args.trim())
  }
  return `${workflow.prompt}\n\nUser scope: ${args.trim()}`
}
