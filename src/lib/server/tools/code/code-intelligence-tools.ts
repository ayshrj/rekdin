import { z } from "zod"

import {
  codeFiles,
  componentNames,
  hookNames,
  importedSpecifiers,
  linesOf,
  readBounded,
} from "../shared/code-utils"
import { boundedLimit, previewString } from "../shared/formatting"
import { pathLimitSchema, toolDefinition, type TraceStep } from "../shared/tool-base"

export const componentMapTool = toolDefinition(
  "component_map",
  "Map React components, props, imports, and likely usage locations.",
  pathLimitSchema,
  async ({ path: pathName, limit }) => {
    const maxFiles = boundedLimit(limit, 300, 1000)
    const { files, skipped, truncated } = await codeFiles(pathName, maxFiles)
    const components = []
    const usage = new Map<string, string[]>()
    for (const file of files) {
      const content = await readBounded(file)
      const names = componentNames(content)
      for (const name of names) {
        const props = Array.from(
          content.matchAll(new RegExp(`${name}\\s*\\([^)]*\\{([^}]*)\\}`, "s"))
        )
          .flatMap((match) => match[1].split(/[,:\n]/).map((part) => part.trim()))
          .filter((part) => /^[A-Za-z_$][\w$]*$/.test(part))
          .slice(0, 20)
        components.push({
          name,
          file: file.path,
          props,
          imports: importedSpecifiers(content),
          usedBy: usage.get(name) ?? [],
        })
      }
      for (const tag of Array.from(content.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)).map((m) => m[1])) {
        usage.set(tag, [...(usage.get(tag) ?? []), file.path])
      }
    }
    return {
      type: "component_map",
      components: components.map((component) => ({
        ...component,
        usedBy:
          usage
            .get(component.name)
            ?.filter((file) => file !== component.file)
            .slice(0, 30) ?? [],
      })),
      skipped,
      truncated,
    }
  }
)

export const hookMapTool = toolDefinition(
  "hook_map",
  "Find custom React hooks, dependencies, rough return values, and usage locations.",
  pathLimitSchema,
  async ({ path: pathName, limit }) => {
    const { files } = await codeFiles(pathName, boundedLimit(limit, 300, 1000))
    const hooks: Array<Record<string, unknown>> = []
    const usage = new Map<string, string[]>()
    for (const file of files) {
      const content = await readBounded(file)
      for (const hookName of hookNames(content)) {
        const block = content.slice(content.indexOf(hookName), content.indexOf(hookName) + 2000)
        hooks.push({
          name: hookName,
          file: file.path,
          dependencies: importedSpecifiers(content).filter((value) =>
            /react|store|context|local|idb/i.test(value)
          ),
          touchesLocalStorage: /localStorage/.test(block),
          returns: Array.from(block.matchAll(/return\s+([^;\n]+)/g))
            .map((m) => previewString(m[1], 120))
            .slice(0, 5),
        })
      }
      for (const call of Array.from(content.matchAll(/\b(use[A-Z][A-Za-z0-9]*)\s*\(/g)).map(
        (m) => m[1]
      )) {
        usage.set(call, [...(usage.get(call) ?? []), file.path])
      }
    }
    return {
      type: "hook_map",
      hooks: hooks.map((hookItem) => ({
        ...hookItem,
        usedBy:
          usage
            .get(String(hookItem.name))
            ?.filter((file) => file !== hookItem.file)
            .slice(0, 30) ?? [],
      })),
    }
  }
)

export const stateFlowTraceTool = toolDefinition(
  "state_flow_trace",
  "Trace a variable or state value from definitions to likely usages across workspace files.",
  z.object({
    symbol: z.string().min(1),
    path: z.string().optional(),
    limit: z.number().int().optional(),
  }),
  async ({ symbol, path: pathName, limit }) => {
    const { files } = await codeFiles(pathName, boundedLimit(limit, 500, 1500))
    const steps: TraceStep[] = []
    for (const file of files) {
      const content = await readBounded(file)
      linesOf(content).forEach((line, index) => {
        if (!line.includes(symbol)) return
        const action = /\b(const|let|var|function|type|interface)\s+/.test(line)
          ? "defined"
          : /set[A-Z]|update|dispatch|assign/.test(line)
            ? "updated"
            : /props|return|<[^>]+/.test(line)
              ? "passed/consumed"
              : "referenced"
        steps.push({ action, file: file.path, line: index + 1, detail: previewString(line, 220) })
      })
    }
    return {
      type: "state_flow_trace",
      symbol,
      steps: steps.slice(0, 200),
      omitted: Math.max(0, steps.length - 200),
    }
  }
)

export const typeDependencyTraceTool = toolDefinition(
  "type_dependency_trace",
  "Trace TypeScript type/interface definition, imports, extensions, and usage sites.",
  z.object({
    typeName: z.string().min(1),
    path: z.string().optional(),
    limit: z.number().int().optional(),
  }),
  async ({ typeName, path: pathName, limit }) => {
    const { files } = await codeFiles(pathName, boundedLimit(limit, 500, 1500))
    const steps: TraceStep[] = []
    for (const file of files) {
      const content = await readBounded(file)
      linesOf(content).forEach((line, index) => {
        if (!line.includes(typeName)) return
        const action = new RegExp(`\\b(type|interface)\\s+${typeName}\\b`).test(line)
          ? "defined"
          : /import\s+/.test(line)
            ? "imported"
            : /extends|implements/.test(line)
              ? "extended"
              : /:\s*|as\s+|<.*>/.test(line)
                ? "used"
                : "referenced"
        steps.push({ action, file: file.path, line: index + 1, detail: previewString(line, 220) })
      })
    }
    return { type: "type_dependency_trace", symbol: typeName, steps: steps.slice(0, 200) }
  }
)

export const propDrillingTraceTool = toolDefinition(
  "prop_drilling_trace",
  "Trace a prop name through likely React parent and child usages.",
  z.object({
    prop: z.string().min(1),
    path: z.string().optional(),
    limit: z.number().int().optional(),
  }),
  async ({ prop, path: pathName, limit }) => {
    const { files } = await codeFiles(pathName, boundedLimit(limit, 500, 1500))
    const steps: TraceStep[] = []
    for (const file of files) {
      const content = await readBounded(file)
      linesOf(content).forEach((line, index) => {
        if (!line.includes(prop)) return
        const action = line.includes(`${prop}=`)
          ? "passed as prop"
          : line.includes(`{ ${prop}`) || line.includes(`{${prop}`)
            ? "destructured"
            : "referenced"
        steps.push({ action, file: file.path, line: index + 1, detail: previewString(line, 220) })
      })
    }
    return { type: "prop_drilling_trace", prop, steps: steps.slice(0, 200) }
  }
)

export const eventHandlerTraceTool = toolDefinition(
  "event_handler_trace",
  "Trace an event handler to triggers, state reads, function calls, and API calls.",
  z.object({
    handler: z.string().min(1),
    path: z.string().optional(),
    limit: z.number().int().optional(),
  }),
  async ({ handler, path: pathName, limit }) => {
    const { files } = await codeFiles(pathName, boundedLimit(limit, 500, 1500))
    const steps: TraceStep[] = []
    for (const file of files) {
      const content = await readBounded(file)
      linesOf(content).forEach((line, index) => {
        if (!line.includes(handler)) return
        const action = /on[A-Z][A-Za-z]+\s*=/.test(line)
          ? "triggered by UI"
          : /function|const/.test(line)
            ? "defined"
            : /fetch\(|axios|ky\./.test(line)
              ? "API call path"
              : "referenced"
        steps.push({ action, file: file.path, line: index + 1, detail: previewString(line, 220) })
      })
    }
    return { type: "event_handler_trace", handler, steps: steps.slice(0, 200) }
  }
)
