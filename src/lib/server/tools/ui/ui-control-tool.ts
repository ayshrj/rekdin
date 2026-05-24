import { tool } from "@langchain/core/tools"
import { z } from "zod"

const UI_ACTION_SCHEMA = z.object({
  action: z
    .enum(["navigate", "set_tool_policy", "set_theme", "compact", "new_session", "open_settings"])
    .describe("The UI action to perform"),
  target: z
    .enum(["chat", "workspace", "timeline", "artifacts", "replay", "traces", "background_jobs"])
    .optional()
    .describe(
      "navigate: destination. Sub-tab targets (artifacts, timeline, replay, traces, background_jobs) automatically open the Workspace panel — do NOT call navigate twice. Use 'chat' to go back to chat, 'workspace' to open the panel without selecting a specific sub-tab."
    ),
  policy: z
    .enum(["read_only", "balanced", "full_auto"])
    .optional()
    .describe("set_tool_policy: the policy to apply"),
  theme: z.enum(["light", "dark", "system"]).optional().describe("set_theme: the theme to apply"),
  tab: z
    .enum(["model", "workspace", "uploads"])
    .optional()
    .describe("open_settings: which settings tab to open"),
})

type UiActionInput = z.infer<typeof UI_ACTION_SCHEMA>

function buildConfirmation(input: UiActionInput): string {
  switch (input.action) {
    case "navigate":
      return `Navigating to ${input.target ?? "workspace"}.`
    case "set_tool_policy":
      return `Tool policy set to ${input.policy}.`
    case "set_theme":
      return `Theme set to ${input.theme}.`
    case "compact":
      return "Compacting context."
    case "new_session":
      return "Starting a new session."
    case "open_settings":
      return `Opening settings${input.tab ? ` (${input.tab} tab)` : ""}.`
  }
}

export const uiControlTool = tool(
  async (input: UiActionInput) => ({
    type: "ui_action",
    action: input.action,
    payload: { target: input.target, policy: input.policy, theme: input.theme, tab: input.tab },
    message: buildConfirmation(input),
  }),
  {
    name: "ui_control",
    description:
      "Control the Rekdin UI — navigate panels, change tool policy, switch theme, compact context, open settings, or start a new session. Use this whenever the user asks to go somewhere in the UI or change a UI setting.",
    schema: UI_ACTION_SCHEMA,
  }
)
