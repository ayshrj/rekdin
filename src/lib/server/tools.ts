import { tool } from "@langchain/core/tools"
import { z } from "zod"
import { Readability } from "@mozilla/readability"
import TurndownService from "turndown"
import { JSDOM } from "jsdom"
import { readFile, writeFile, stat, readdir } from "fs/promises"
import { spawn } from "child_process"
import os from "os"
import puppeteer, { Browser, Page } from "puppeteer"

import { ensureWorkspaceDirs, getWorkspaceRoot, resolveWorkspacePath } from "./workspace"

const turndown = new TurndownService({ headingStyle: "atx" })

let browserPromise: Promise<Browser> | null = null

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    })
  }
  return browserPromise
}

async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    return await fn(page)
  } finally {
    await page.close()
  }
}

async function fetchJson<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": "Terminator/NextJS" } })
  if (!res.ok) throw new Error(`Failed request (${res.status})`)
  return (await res.json()) as T
}

export const webSearchTool = tool(
  async ({ query, maxResults, domains, excludeDomains }) => {
    const encoded = encodeURIComponent(query)
    const url = `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`
    const data = await fetchJson<{
      Abstract?: string
      AbstractURL?: string
      Heading?: string
      AbstractSource?: string
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Result?: string }>
    }>(url)
    const results: Array<Record<string, unknown>> = []
    if (data.Abstract) {
      results.push({
        title: data.Heading || "Instant Answer",
        url: data.AbstractURL,
        snippet: data.Abstract,
        source: data.AbstractSource || "duckduckgo.com",
      })
    }
    const allowDomain = (candidate: string | undefined) => {
      if (!candidate) return true
      if (domains && domains.length && !domains.some((d) => candidate.includes(d))) return false
      if (excludeDomains && excludeDomains.some((d) => candidate.includes(d))) return false
      return true
    }
    data.RelatedTopics?.forEach((topic) => {
      if (!topic.FirstURL || !topic.Text) return
      const host = (() => {
        try {
          return new URL(topic.FirstURL).hostname
        } catch {
          return ""
        }
      })()
      if (!allowDomain(host)) return
      results.push({
        title: topic.Result?.split(" - ")[0] ?? topic.Text,
        url: topic.FirstURL,
        snippet: topic.Text,
        source: host,
      })
    })
    return {
      query,
      results: results.slice(0, maxResults),
      totalResults: results.length,
      domains: domains ?? [],
      excludeDomains: excludeDomains ?? [],
      type: "web_search",
    }
  },
  {
    name: "web_search",
    description: "Search the public web for answers and recent information.",
    schema: z.object({
      query: z.string(),
      maxResults: z.number().int().min(1).max(25).default(10),
      domains: z.array(z.string()).optional(),
      excludeDomains: z.array(z.string()).optional(),
    }),
  }
)

export const visitUrlTool = tool(
  async ({ url }) => {
    const response = await fetch(url, { headers: { "User-Agent": "Terminator/NextJS" } })
    if (!response.ok) return { url, error: `Failed to fetch (${response.status})` }
    const html = await response.text()
    const dom = new JSDOM(html, { url })
    const reader = new Readability(dom.window.document)
    const article = reader.parse()
    const markdown = article?.content ? turndown.turndown(article.content) : turndown.turndown(html)
    return {
      url,
      title: article?.title ?? dom.window.document.title ?? "Untitled",
      excerpt: article?.excerpt ?? "",
      markdown,
      type: "visit_link",
    }
  },
  {
    name: "visit_link",
    description: "Fetch and summarize the readable content from a web page.",
    schema: z.object({ url: z.string().url() }),
  }
)

export const browserNavigateTool = tool(
  async ({ url }) => {
    const steps: Array<Record<string, unknown>> = []
    const result = await withPage(async (page) => {
      const started = Date.now()
      steps.push({ label: "Start", detail: `Navigating to ${url}`, at: new Date().toISOString() })
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 })
      const title = await page.title()
      steps.push({
        label: "Loaded",
        detail: `DOM content loaded (status ${response?.status() ?? "n/a"})`,
        at: new Date().toISOString(),
      })
      return {
        url: page.url(),
        status: response?.status() ?? null,
        title,
        duration: Date.now() - started,
        type: "browser_navigate",
        steps,
      }
    })
    return result
  },
  {
    name: "browser_navigate",
    description: "Navigate a headless browser to a URL.",
    schema: z.object({ url: z.string().url() }),
  }
)

export const browserGetMarkdownTool = tool(
  async ({ url, pageNumber }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      const steps: Array<Record<string, unknown>> = []
      steps.push({ label: "Start", detail: `Loading ${url}`, at: new Date().toISOString() })
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 })
      steps.push({ label: "Loaded", detail: "DOM ready, extracting readable content", at: new Date().toISOString() })
      const html = await page.content()
      const dom = new JSDOM(html, { url })
      const reader = new Readability(dom.window.document)
      const article = reader.parse()
      const markdown = article?.content ? turndown.turndown(article.content) : turndown.turndown(html)
      const content = markdown
      return {
        url: page.url(),
        title: article?.title ?? dom.window.document.title ?? "Untitled",
        markdown: content,
        type: "browser_get_markdown",
        duration: Date.now() - started,
        pageNumber: pageNumber ?? 1,
        steps,
      }
    })
  },
  {
    name: "browser_get_markdown",
    description: "Get readable markdown from the current page.",
    schema: z.object({ url: z.string().url(), pageNumber: z.number().int().optional() }),
  }
)

export const browserScreenshotTool = tool(
  async ({ url, fullPage }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      const steps: Array<Record<string, unknown>> = []
      steps.push({ label: "Start", detail: `Loading ${url}`, at: new Date().toISOString() })
      await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 })
      steps.push({ label: "Loaded", detail: "Network idle, capturing screenshot", at: new Date().toISOString() })
      const screenshot = await page.screenshot({ fullPage: fullPage ?? true, encoding: "base64" })
      const title = await page.title()
      return {
        url: page.url(),
        title,
        screenshot: `data:image/png;base64,${screenshot}`,
        type: "browser_screenshot",
        duration: Date.now() - started,
        steps,
      }
    })
  },
  {
    name: "browser_screenshot",
    description: "Capture a screenshot of a page.",
    schema: z.object({ url: z.string().url(), fullPage: z.boolean().optional() }),
  }
)

export const readFileTool = tool(
  async ({ path: filePath }) => {
    await ensureWorkspaceDirs()
    const resolved = resolveWorkspacePath(filePath)
    const content = await readFile(resolved, "utf-8")
    return { path: filePath, content, type: "file_read" }
  },
  {
    name: "file_read",
    description: "Read a UTF-8 text file from the AI workspace.",
    schema: z.object({ path: z.string() }),
  }
)

export const listFilesTool = tool(
  async ({ path: dirPath, recursive }) => {
    await ensureWorkspaceDirs()
    const gather = async (target: string, relative: string) => {
      const entries = await readdir(target, { withFileTypes: true })
      const output: Array<Record<string, unknown>> = []
      for (const entry of entries) {
        const relPath = relative ? `${relative}/${entry.name}` : entry.name
        const abs = resolveWorkspacePath(relPath)
        const info = await stat(abs)
        output.push({
          name: entry.name,
          path: relPath,
          type: entry.isDirectory() ? "directory" : "file",
          size: info.size,
          modified: info.mtime.toISOString(),
        })
        if (recursive && entry.isDirectory()) {
          const nested = await gather(abs, relPath)
          output.push(...nested)
        }
      }
      return output
    }
    const base = dirPath ? resolveWorkspacePath(dirPath) : getWorkspaceRoot()
    const rel = dirPath?.replace(/^\.\//, "") ?? ""
    const files = await gather(base, rel)
    return { path: dirPath ?? ".", files, type: "list_files" }
  },
  {
    name: "list_files",
    description: "List files and folders inside the AI workspace.",
    schema: z.object({
      path: z.string().optional(),
      recursive: z.boolean().optional(),
    }),
  }
)

export const writeFileTool = tool(
  async ({ path: filePath, content }) => {
    await ensureWorkspaceDirs()
    const resolved = resolveWorkspacePath(filePath)
    await writeFile(resolved, content, "utf-8")
    return { path: filePath, bytes: Buffer.byteLength(content), type: "write_file" }
  },
  {
    name: "write_file",
    description: "Write UTF-8 content to a file within the workspace.",
    schema: z.object({
      path: z.string(),
      content: z.string(),
    }),
  }
)

export const executeCommandTool = tool(
  async ({ command, cwd, timeout }) => {
    await ensureWorkspaceDirs()
    const workingDir = cwd ? resolveWorkspacePath(cwd) : getWorkspaceRoot()
    return await new Promise((resolve) => {
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
      }, timeout ?? 30000)

      child.on("close", (code) => {
        finished = true
        clearTimeout(timer)
        resolve({
          command,
          cwd: workingDir,
          exitCode: code ?? 0,
          stdout,
          stderr,
          duration: Date.now() - start,
          type: "execute_command",
        })
      })
    })
  },
  {
    name: "execute_command",
    description: "Execute a shell command inside the workspace.",
    schema: z.object({
      command: z.string(),
      cwd: z.string().optional(),
      timeout: z.number().optional(),
    }),
  }
)

export const toolset = [
  webSearchTool,
  visitUrlTool,
  browserNavigateTool,
  browserGetMarkdownTool,
  browserScreenshotTool,
  readFileTool,
  listFilesTool,
  writeFileTool,
  executeCommandTool,
]
