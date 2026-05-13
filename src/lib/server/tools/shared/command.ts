import { spawn } from "child_process"
import os from "os"

import { ensureWorkspaceDirs, getWorkspaceRoot, resolveWorkspacePath } from "../../workspace"
import { truncateString } from "./formatting"

/**
 * Runs a shell command inside the configured Rekdin workspace boundary.
 */
export async function runCommand(command: string, cwd?: string, timeoutMs = 30000) {
  await ensureWorkspaceDirs()
  const workingDir = cwd ? resolveWorkspacePath(cwd) : getWorkspaceRoot()
  return await new Promise<{ stdout: string; stderr: string; exitCode: number; duration: number }>(
    (resolve) => {
      const child = spawn(command, {
        shell: os.platform() === "win32" ? "powershell.exe" : "bash",
        cwd: workingDir,
        env: process.env,
      })
      const start = Date.now()
      let stdout = ""
      let stderr = ""
      let finished = false

      child.stdout.on("data", (chunk) => (stdout += chunk.toString()))
      child.stderr.on("data", (chunk) => (stderr += chunk.toString()))

      const timer = setTimeout(() => {
        if (finished) return
        child.kill("SIGTERM")
      }, timeoutMs)

      child.on("close", (code) => {
        finished = true
        clearTimeout(timer)
        resolve({ stdout, stderr, exitCode: code ?? 0, duration: Date.now() - start })
      })
    }
  )
}

/**
 * Runs a shell command without forcing Rekdin workspace path resolution.
 * This is used for host-level discovery such as git and local executable checks.
 */
export async function runCommandUnsafe(command: string, cwd?: string, timeoutMs = 30000) {
  return await new Promise<{ stdout: string; stderr: string; exitCode: number; duration: number }>(
    (resolve) => {
      const child = spawn(command, {
        shell: os.platform() === "win32" ? "powershell.exe" : "bash",
        cwd,
        env: process.env,
      })
      const start = Date.now()
      let stdout = ""
      let stderr = ""
      let finished = false

      child.stdout.on("data", (chunk) => (stdout += chunk.toString()))
      child.stderr.on("data", (chunk) => (stderr += chunk.toString()))

      const timer = setTimeout(() => {
        if (finished) return
        child.kill("SIGTERM")
      }, timeoutMs)

      child.on("close", (code) => {
        finished = true
        clearTimeout(timer)
        resolve({ stdout, stderr, exitCode: code ?? 0, duration: Date.now() - start })
      })
    }
  )
}

export function safeShellArg(value: string) {
  return `'${value.replace(/'/g, "'\"'\"'")}'`
}

export async function gitOutput(command: string, timeoutMs = 30_000) {
  const result = await runCommandUnsafe(command, getWorkspaceRoot(), timeoutMs)
  return {
    exitCode: result.exitCode,
    stdout: truncateString(result.stdout, 20_000),
    stderr: truncateString(result.stderr, 4000),
  }
}
