import { tool } from "@langchain/core/tools"
import { spawn } from "child_process"
import os from "os"
import { z } from "zod"

import { getWorkspaceRoot } from "../../workspace"
import { runCommandUnsafe } from "../shared/command"
import { truncateString } from "../shared/formatting"
import { readWorkspaceText } from "../workspace/workspace-fs"

async function readPackageJson() {
  try {
    return JSON.parse(await readWorkspaceText("package.json")) as Record<string, unknown>
  } catch {
    return null
  }
}

export const DEV_SERVERS = new Map<
  string,
  {
    child: ReturnType<typeof spawn>
    startedAt: string
    command: string
    port?: number
    cwd: string
  }
>()

export const devServerStartTool = tool(
  async ({ script, port }) => {
    const key = `${script ?? "dev"}:${port ?? ""}`
    const existing = DEV_SERVERS.get(key)
    if (existing && !existing.child.killed)
      return {
        type: "dev_server_start",
        key,
        status: "already_running",
        port: existing.port,
        startedAt: existing.startedAt,
      }
    const pkg = await readPackageJson()
    const scripts = (pkg?.scripts as Record<string, string> | undefined) ?? {}
    const scriptName = script ?? "dev"
    if (!scripts[scriptName]) throw new Error(`package.json script not found: ${scriptName}`)
    const child = spawn(
      "npm",
      ["run", scriptName, ...(port ? ["--", "--port", String(port)] : [])],
      {
        cwd: getWorkspaceRoot(),
        env: process.env,
        stdio: "ignore",
        detached: true,
      }
    )
    DEV_SERVERS.set(key, {
      child,
      startedAt: new Date().toISOString(),
      command: `npm run ${scriptName}`,
      port,
      cwd: getWorkspaceRoot(),
    })
    child.unref()
    return { type: "dev_server_start", key, status: "started", script: scriptName, port }
  },
  {
    name: "dev_server_start",
    description: "Start a package.json dev server in the background.",
    schema: z.object({
      script: z.string().optional(),
      port: z.number().int().min(1).max(65535).optional(),
    }),
  }
)

export const devServerStopTool = tool(
  async ({ key }) => {
    const entries = key ? [[key, DEV_SERVERS.get(key)] as const] : Array.from(DEV_SERVERS.entries())
    const stopped: string[] = []
    for (const [entryKey, entry] of entries) {
      if (!entry) continue
      entry.child.kill("SIGTERM")
      DEV_SERVERS.delete(entryKey)
      stopped.push(entryKey)
    }
    return { type: "dev_server_stop", stopped }
  },
  {
    name: "dev_server_stop",
    description: "Stop Rekdin-started dev servers.",
    schema: z.object({ key: z.string().optional() }),
  }
)

export const devServerStatusTool = tool(
  async () => ({
    type: "dev_server_status",
    servers: Array.from(DEV_SERVERS.entries()).map(([key, value]) => ({
      key,
      startedAt: value.startedAt,
      command: value.command,
      port: value.port,
      killed: value.child.killed,
    })),
  }),
  {
    name: "dev_server_status",
    description: "List Rekdin-started dev servers.",
    schema: z.object({}),
  }
)

export const portProbeTool = tool(
  async ({ port, host }) => {
    const started = Date.now()
    try {
      const res = await fetch(`http://${host ?? "127.0.0.1"}:${port}`, { method: "HEAD" })
      return {
        type: "port_probe",
        port,
        host: host ?? "127.0.0.1",
        open: true,
        status: res.status,
        duration: Date.now() - started,
      }
    } catch (err) {
      return {
        type: "port_probe",
        port,
        host: host ?? "127.0.0.1",
        open: false,
        error: err instanceof Error ? err.message : "Probe failed",
        duration: Date.now() - started,
      }
    }
  },
  {
    name: "port_probe",
    description: "Probe a local HTTP port.",
    schema: z.object({ port: z.number().int().min(1).max(65535), host: z.string().optional() }),
  }
)

export const httpHealthCheckTool = tool(
  async ({ url, timeoutMs }) => {
    const controller = new AbortController()
    const started = Date.now()
    const timer = setTimeout(() => controller.abort(), timeoutMs ?? 10000)
    try {
      const res = await fetch(url, { method: "GET", signal: controller.signal })
      return {
        type: "http_health_check",
        url,
        ok: res.ok,
        status: res.status,
        contentType: res.headers.get("content-type"),
        duration: Date.now() - started,
      }
    } catch (err) {
      return {
        type: "http_health_check",
        url,
        ok: false,
        error: err instanceof Error ? err.message : "Health check failed",
        duration: Date.now() - started,
      }
    } finally {
      clearTimeout(timer)
    }
  },
  {
    name: "http_health_check",
    description: "Check a URL and return status/latency metadata.",
    schema: z.object({
      url: z.string().url(),
      timeoutMs: z.number().int().min(1000).max(60000).optional(),
    }),
  }
)

export const processListTool = tool(
  async ({ filter }: { filter?: string }) => {
    const isPosix = os.platform() !== "win32"
    const cmd = isPosix ? "ps aux" : "tasklist /fo csv"
    const result = await runCommandUnsafe(cmd, undefined, 10000)
    const lines = result.stdout.trim().split("\n")
    if (!isPosix) {
      return { type: "process_list", platform: "win32", raw: truncateString(result.stdout, 8000) }
    }
    const processes = lines
      .slice(1)
      .map((line) => {
        const parts = line.trim().split(/\s+/)
        return {
          user: parts[0] ?? "",
          pid: parseInt(parts[1] ?? "0"),
          cpu: parts[2] ?? "0",
          mem: parts[3] ?? "0",
          command: parts.slice(10).join(" "),
        }
      })
      .filter((p) => {
        if (!filter) return true
        const q = filter.toLowerCase()
        return p.command.toLowerCase().includes(q) || p.user.toLowerCase().includes(q)
      })
      .slice(0, 100)
    return {
      type: "process_list",
      platform: os.platform(),
      filter: filter ?? null,
      totalShown: processes.length,
      processes,
    }
  },
  {
    name: "process_list",
    description:
      "List running processes with optional name/command filter. Returns PID, CPU%, MEM%, command.",
    schema: z.object({ filter: z.string().optional() }),
  }
)

export const systemInfoTool = tool(
  async () => {
    const platform = os.platform()
    const cpus = os.cpus()
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const dfResult = await runCommandUnsafe("df -h .", undefined, 5000).catch(() => ({
      stdout: "",
      stderr: "",
      exitCode: 1,
      duration: 0,
    }))
    const dfLine = dfResult.stdout.split("\n")[1] ?? ""
    const dfParts = dfLine.trim().split(/\s+/)
    return {
      type: "system_info",
      platform,
      arch: os.arch(),
      nodeVersion: process.version,
      hostname: os.hostname(),
      uptime: os.uptime(),
      uptimeHuman: `${Math.floor(os.uptime() / 3600)}h ${Math.floor((os.uptime() % 3600) / 60)}m`,
      cpu: {
        model: cpus[0]?.model ?? "unknown",
        cores: cpus.length,
        speedMhz: cpus[0]?.speed ?? 0,
      },
      memory: {
        totalBytes: totalMem,
        freeBytes: freeMem,
        usedBytes: totalMem - freeMem,
        usedPercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
        totalGb: +(totalMem / 1024 ** 3).toFixed(1),
        freeGb: +(freeMem / 1024 ** 3).toFixed(1),
      },
      disk:
        dfParts.length >= 5
          ? { size: dfParts[1], used: dfParts[2], available: dfParts[3], usePercent: dfParts[4] }
          : undefined,
      workspaceRoot: getWorkspaceRoot(),
    }
  },
  {
    name: "system_info",
    description:
      "Return CPU, memory, disk usage, uptime, platform, and Node.js version for the current host.",
    schema: z.object({}),
  }
)

export const clipboardReadTool = tool(
  async () => {
    const platform = os.platform()
    const cmd = platform === "darwin" ? "pbpaste" : "xclip -o -selection clipboard"
    const result = await runCommandUnsafe(cmd, undefined, 5000).catch((err) => ({
      stdout: "",
      stderr: String(err),
      exitCode: 1,
      duration: 0,
    }))
    if (result.exitCode !== 0) {
      return { type: "clipboard_read", error: result.stderr || "Clipboard read failed." }
    }
    return {
      type: "clipboard_read",
      content: truncateString(result.stdout, 8000),
      chars: result.stdout.length,
    }
  },
  {
    name: "clipboard_read",
    description: "Read text content from the system clipboard (macOS pbpaste / Linux xclip).",
    schema: z.object({}),
  }
)

export const clipboardWriteTool = tool(
  async ({ text }: { text: string }) => {
    const platform = os.platform()
    const child = spawn(platform === "darwin" ? "pbcopy" : "xclip -selection clipboard", {
      shell: true,
    })
    await new Promise<void>((resolve) => {
      child.stdin.write(text, "utf-8")
      child.stdin.end()
      child.on("close", () => resolve())
    })
    return { type: "clipboard_write", chars: text.length, success: true }
  },
  {
    name: "clipboard_write",
    description: "Write text to the system clipboard (macOS pbcopy / Linux xclip).",
    schema: z.object({ text: z.string() }),
  }
)

export const desktopNotifyTool = tool(
  async ({ title, message }: { title: string; message: string }) => {
    const platform = os.platform()
    let cmd: string
    if (platform === "darwin") {
      cmd = `osascript -e ${JSON.stringify(`display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)}`)}`
    } else {
      cmd = `notify-send ${JSON.stringify(title)} ${JSON.stringify(message)}`
    }
    const result = await runCommandUnsafe(cmd, undefined, 5000).catch((err) => ({
      stdout: "",
      stderr: String(err),
      exitCode: 1,
      duration: 0,
    }))
    return {
      type: "desktop_notify",
      title,
      message,
      success: result.exitCode === 0,
      error: result.exitCode !== 0 ? result.stderr : undefined,
    }
  },
  {
    name: "desktop_notify",
    description: "Send a desktop notification (macOS osascript / Linux notify-send).",
    schema: z.object({ title: z.string().min(1), message: z.string().min(1) }),
  }
)
