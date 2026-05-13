import path from "path"
import { z } from "zod"

import { codeFiles, linesOf, readBounded, UI_EXTENSIONS } from "../shared/code-utils"
import { boundedLimit } from "../shared/formatting"
import { unifiedPatch } from "../shared/patching"
import { type Finding, finding, pathLimitSchema, toolDefinition } from "../shared/tool-base"
import { collectWorkspaceFiles } from "../workspace/workspace-fs"

export const tailwindClassAuditTool = toolDefinition(
  "tailwind_class_audit",
  "Find Tailwind anti-patterns such as arbitrary values, conflicts, and hardcoded colors.",
  pathLimitSchema,
  async ({ path: pathName, limit }) => {
    const { files } = await collectWorkspaceFiles({
      path: pathName,
      extensions: [".tsx", ".jsx", ".ts", ".css"],
      maxFiles: boundedLimit(limit, 800, 2000),
    })
    const findings: Finding[] = []
    for (const file of files) {
      const content = await readBounded(file)
      linesOf(content).forEach((line, index) => {
        if (/[a-z]+-\[[^\]]+\]/.test(line))
          findings.push(
            finding(
              "warning",
              file.path,
              index + 1,
              "Arbitrary Tailwind value detected.",
              "Prefer a design token or scale class."
            )
          )
        if (/text-#[0-9A-Fa-f]{3,6}|bg-#[0-9A-Fa-f]{3,6}/.test(line))
          findings.push(finding("error", file.path, index + 1, "Hardcoded color class detected."))
        if (/\bflex\b.*\binline-block\b|\binline-block\b.*\bflex\b/.test(line))
          findings.push(
            finding("warning", file.path, index + 1, "Conflicting display utilities detected.")
          )
      })
    }
    return { type: "tailwind_class_audit", findings: findings.slice(0, 300) }
  }
)

export const componentDesignAuditTool = toolDefinition(
  "component_design_audit",
  "Audit React components for UX/design states, accessibility, and mobile behavior.",
  pathLimitSchema,
  async ({ path: pathName, limit }) => {
    const { files } = await collectWorkspaceFiles({
      path: pathName,
      extensions: UI_EXTENSIONS,
      maxFiles: boundedLimit(limit, 500, 1500),
    })
    const findings: Finding[] = []
    for (const file of files) {
      const content = await readBounded(file)
      if (/loading/i.test(content) && !/error/i.test(content))
        findings.push(
          finding("info", file.path, undefined, "Loading state found without nearby error state.")
        )
      if (/<button/.test(content) && !/disabled=|aria-disabled/.test(content))
        findings.push(
          finding(
            "warning",
            file.path,
            undefined,
            "Buttons may be missing disabled/loading affordances."
          )
        )
      if (/empty/i.test(content) === false && /map\(/.test(content))
        findings.push(
          finding("info", file.path, undefined, "List rendering found; verify empty state exists.")
        )
    }
    return { type: "component_design_audit", findings: findings.slice(0, 200) }
  }
)

export const responsiveBreakpointAuditTool = toolDefinition(
  "responsive_breakpoint_audit",
  "Find components that likely break on small screens.",
  pathLimitSchema,
  async ({ path: pathName, limit }) => {
    const { files } = await collectWorkspaceFiles({
      path: pathName,
      extensions: UI_EXTENSIONS,
      maxFiles: boundedLimit(limit, 500, 1500),
    })
    const findings: Finding[] = []
    for (const file of files) {
      const content = await readBounded(file)
      linesOf(content).forEach((line, index) => {
        if (/\bw-\[(?:[6-9]\d\d|\d{4,})px\]|\bmin-w-\[(?:[6-9]\d\d|\d{4,})px\]/.test(line))
          findings.push(
            finding(
              "warning",
              file.path,
              index + 1,
              "Large fixed width may overflow mobile viewports."
            )
          )
        if (/\bgrid-cols-[4-9]\b/.test(line) && !/\b(sm|md|lg):/.test(line))
          findings.push(
            finding(
              "warning",
              file.path,
              index + 1,
              "Dense grid lacks responsive breakpoint prefix."
            )
          )
      })
    }
    return { type: "responsive_breakpoint_audit", findings: findings.slice(0, 200) }
  }
)

export const accessibilityAuditStaticTool = toolDefinition(
  "accessibility_audit_static",
  "Run static accessibility checks for labels, alt text, clickable divs, and keyboard handlers.",
  pathLimitSchema,
  async ({ path: pathName, limit }) => {
    const { files } = await collectWorkspaceFiles({
      path: pathName,
      extensions: UI_EXTENSIONS,
      maxFiles: boundedLimit(limit, 500, 1500),
    })
    const findings: Finding[] = []
    for (const file of files) {
      const content = await readBounded(file)
      linesOf(content).forEach((line, index) => {
        if (/<img\b(?![^>]*\balt=)/.test(line))
          findings.push(finding("error", file.path, index + 1, "Image is missing alt text."))
        if (/<button\b(?![^>]*(aria-label|title)>)/.test(line) && !/>[^<]+</.test(line))
          findings.push(
            finding("warning", file.path, index + 1, "Button may lack an accessible label.")
          )
        if (/<div\b[^>]*onClick=/.test(line) && !/role=|onKeyDown=|tabIndex=/.test(line))
          findings.push(
            finding("error", file.path, index + 1, "Clickable div lacks keyboard/role semantics.")
          )
      })
    }
    return { type: "accessibility_audit_static", findings: findings.slice(0, 250) }
  }
)

export const storybookStoryGenerateTool = toolDefinition(
  "storybook_story_generate",
  "Generate a Storybook story draft for a React component.",
  z.object({
    path: z.string().min(1),
    componentName: z.string().min(1),
    dryRun: z.boolean().optional().default(true),
  }),
  async ({ path: pathName, componentName, dryRun }) => {
    const storyPath = pathName.replace(/\.[tj]sx?$/, ".stories.tsx")
    const body = `import type { Meta, StoryObj } from "@storybook/react"\n\nimport { ${componentName} } from "./${path.basename(pathName).replace(/\.[tj]sx?$/, "")}"\n\nconst meta = { component: ${componentName} } satisfies Meta<typeof ${componentName}>\nexport default meta\n\ntype Story = StoryObj<typeof meta>\n\nexport const Default: Story = {}\n`
    return { type: "storybook_story_generate", dryRun, patch: unifiedPatch(storyPath, "", body) }
  }
)

export const shadcnUsageAuditTool = toolDefinition(
  "shadcn_usage_audit",
  "Check whether shadcn-style components are used consistently.",
  pathLimitSchema,
  async ({ path: pathName, limit }) => {
    const { files } = await collectWorkspaceFiles({
      path: pathName,
      extensions: UI_EXTENSIONS,
      maxFiles: boundedLimit(limit, 500, 1500),
    })
    const findings: Finding[] = []
    for (const file of files) {
      const content = await readBounded(file)
      if (/<Dialog\b/.test(content) && !/<DialogContent\b/.test(content))
        findings.push(
          finding("warning", file.path, undefined, "Dialog usage without DialogContent detected.")
        )
      if (/<Button\b/.test(content) && !/variant=/.test(content))
        findings.push(
          finding("info", file.path, undefined, "Button usage without explicit variant.")
        )
    }
    return { type: "shadcn_usage_audit", findings }
  }
)

export const iconUsageMapTool = toolDefinition(
  "icon_usage_map",
  "Find icons used from lucide-react or the project icon wrapper.",
  pathLimitSchema,
  async ({ path: pathName, limit }) => {
    const { files } = await codeFiles(pathName, boundedLimit(limit, 800, 2000))
    const icons = []
    for (const file of files) {
      const content = await readBounded(file)
      for (const match of content.matchAll(
        /import\s+\{([^}]+)\}\s+from\s+["'](?:lucide-react|@\/lib\/icons)["']/g
      )) {
        icons.push({
          file: file.path,
          icons: match[1]
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean),
        })
      }
    }
    return { type: "icon_usage_map", icons }
  }
)
