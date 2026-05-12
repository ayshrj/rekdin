import { tool } from "@langchain/core/tools"
import { mkdtemp, writeFile } from "fs/promises"
import os from "os"
import path from "path"
import { z } from "zod"

import { runCommand } from "../shared/command"
import { assertNoBlockedDirectoryReference } from "../workspace/workspace-fs"

/**
 * Runs JavaScript with Node.js in a temporary file and returns process output.
 */
export const nodeExecuteTool = tool(
  async ({ code }) => {
    assertNoBlockedDirectoryReference(code)
    const dir = await mkdtemp(path.join(os.tmpdir(), "Rekdin-node-"))
    const filePath = path.join(dir, "script.js")
    await writeFile(filePath, code, "utf-8")
    const res = await runCommand(`node ${filePath}`)
    return {
      type: "node_execute",
      script: code,
      interpreter: "node",
      stdout: res.stdout,
      stderr: res.stderr,
      exitCode: res.exitCode,
      duration: res.duration,
    }
  },
  {
    name: "node_execute",
    description: "Execute JavaScript using Node.js and return stdout/stderr.",
    schema: z.object({ code: z.string().min(1) }),
  }
)

/**
 * Runs Python with python3 in a temporary file and returns process output.
 */
export const pythonExecuteTool = tool(
  async ({ code }) => {
    assertNoBlockedDirectoryReference(code)
    const dir = await mkdtemp(path.join(os.tmpdir(), "Rekdin-python-"))
    const filePath = path.join(dir, "script.py")
    await writeFile(filePath, code, "utf-8")
    const res = await runCommand(`python3 ${filePath}`)
    return {
      type: "python_execute",
      script: code,
      interpreter: "python3",
      stdout: res.stdout,
      stderr: res.stderr,
      exitCode: res.exitCode,
      duration: res.duration,
    }
  },
  {
    name: "python_execute",
    description: "Execute Python code using python3 and return stdout/stderr.",
    schema: z.object({ code: z.string().min(1) }),
  }
)

/**
 * Executes Node.js code in the CodeAct result shape expected by the UI.
 */
export const nodeCodeActTool = tool(
  async ({ code, filename }) => {
    const started = Date.now()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = (await nodeExecuteTool.invoke({ code })) as any
    return {
      type: "node_codeact",
      success: (res?.exitCode ?? 0) === 0,
      output: res?.stdout ?? "",
      error: res?.stderr ?? "",
      duration: Date.now() - started,
      filename: filename ?? "code.js",
    }
  },
  {
    name: "node_codeact",
    description: "Execute Node.js code (CodeAct-style).",
    schema: z.object({ code: z.string().min(1), filename: z.string().optional() }),
  }
)

/**
 * Executes Python code in the CodeAct result shape expected by the UI.
 */
export const pythonCodeActTool = tool(
  async ({ code, filename }) => {
    const started = Date.now()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = (await pythonExecuteTool.invoke({ code })) as any
    return {
      type: "python_codeact",
      success: (res?.exitCode ?? 0) === 0,
      output: res?.stdout ?? "",
      error: res?.stderr ?? "",
      duration: Date.now() - started,
      filename: filename ?? "code.py",
    }
  },
  {
    name: "python_codeact",
    description: "Execute Python code (CodeAct-style).",
    schema: z.object({ code: z.string().min(1), filename: z.string().optional() }),
  }
)

/**
 * Executes shell code in the CodeAct result shape expected by the UI.
 */
export const shellCodeActTool = tool(
  async ({ code, filename }) => {
    assertNoBlockedDirectoryReference(code)
    const started = Date.now()
    const dir = await mkdtemp(path.join(os.tmpdir(), "Rekdin-shell-"))
    const filePath = path.join(dir, filename ?? "code.sh")
    await writeFile(filePath, code, "utf-8")
    const res = await runCommand(`bash ${filePath}`)
    return {
      type: "shell_codeact",
      success: res.exitCode === 0,
      output: res.stdout,
      error: res.stderr,
      duration: Date.now() - started,
      filename: filename ?? "code.sh",
    }
  },
  {
    name: "shell_codeact",
    description: "Execute shell code (CodeAct-style).",
    schema: z.object({ code: z.string().min(1), filename: z.string().optional() }),
  }
)

/**
 * Compatibility alias for workspace shell execution.
 */
export const shellExecuteTool = tool(
  async ({ command, cwd, timeout }) => {
    const { executeCommandTool } = await import("../workspace/workspace-tools")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = (await executeCommandTool.invoke({ command, cwd, timeout })) as any
    return {
      ...(typeof res === "object" && res ? res : {}),
      type: "shell_execute",
    }
  },
  {
    name: "shell_execute",
    description: "Alias for execute_command for compatibility with Rekdin renderers.",
    schema: z.object({
      command: z.string().min(1),
      cwd: z.string().optional(),
      timeout: z.number().optional(),
    }),
  }
)
