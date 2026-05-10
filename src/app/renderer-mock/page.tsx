"use client"

import { useEffect, useState } from "react"

import { ThemeToggle } from "@/components/theme-toggle"
import {
  type ToolResultContentPart,
  ToolResultRenderer,
} from "@/components/tools/renderers/tool-result-renderer"

type MockSection = {
  title: string
  description: string
  parts: ToolResultContentPart[]
}

const screenshotDataUrl =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='960' height='540' viewBox='0 0 960 540'%3E%3Crect width='960' height='540' fill='%23141414'/%3E%3Crect x='32' y='32' width='896' height='54' rx='10' fill='%23212121'/%3E%3Ccircle cx='58' cy='59' r='7' fill='%23e24b4a'/%3E%3Ccircle cx='82' cy='59' r='7' fill='%23e8a020'/%3E%3Ccircle cx='106' cy='59' r='7' fill='%2322c78b'/%3E%3Crect x='144' y='46' width='500' height='26' rx='6' fill='%230e0e0e'/%3E%3Ctext x='160' y='64' fill='%23787878' font-family='monospace' font-size='14'%3Ehttps://demo.rekdin.local/audit%3C/text%3E%3Crect x='70' y='130' width='340' height='250' rx='14' fill='%231a1a1a' stroke='%233b72f6' stroke-opacity='.35'/%3E%3Crect x='450' y='130' width='440' height='64' rx='10' fill='%231a1a1a'/%3E%3Crect x='450' y='216' width='440' height='64' rx='10' fill='%231a1a1a'/%3E%3Crect x='450' y='302' width='300' height='64' rx='10' fill='%231a1a1a'/%3E%3Ctext x='96' y='180' fill='%23ffffff' font-family='monospace' font-size='26'%3ERekdin demo%3C/text%3E%3Ctext x='96' y='220' fill='%23787878' font-family='monospace' font-size='15'%3Etool renderer screenshot%3C/text%3E%3C/svg%3E"

const markdown = `# Demo Repo

This repository contains a small Express server used for renderer smoke tests.

- entry: \`src/server.ts\`
- scripts: \`dev\`, \`test\`, \`lint\`
- note: TODO coverage improvements
`

const jsonPayload = {
  project: "demo-repo",
  status: "ready",
  scripts: ["dev", "test", "lint"],
  dependencies: {
    express: "^4.18.0",
    zod: "^4.0.0",
  },
  diagnostics: {
    warnings: 1,
    malformedEntriesHandled: true,
  },
}

const sections: MockSection[] = [
  {
    title: "Command And Script",
    description: "Shell, script, and code execution states.",
    parts: [
      {
        type: "command_result",
        toolName: "execute_command",
        command: "npm run test -- --runInBand",
        cwd: "/workspace/demo-repo",
        stdout:
          "✓ validates workspace guard\n✓ renders list_files payload\n✓ rejects protected path",
        stderr: "warning: demo fixture uses mock credentials",
        exitCode: 0,
        status: "success",
        timestamp: new Date().toISOString(),
      },
      {
        type: "script_result",
        toolName: "python_execute",
        interpreter: "python",
        script: "import json\nprint(json.dumps({'ok': True, 'files': 12}, indent=2))",
        stdout: '{\n  "ok": true,\n  "files": 12\n}',
        stderr: "",
        exitCode: 0,
        status: "success",
      },
      {
        type: "node_codeact",
        toolName: "node_codeact",
        toolInput: {
          code: "const files = ['server.ts', 'package.json']\nconsole.log(files.join('\\n'))",
        },
        toolResult: {
          type: "node_codeact",
          success: true,
          filename: "inspect-files.js",
          output: "server.ts\npackage.json",
        },
      },
    ],
  },
  {
    title: "Files",
    description: "Read, list, search, and write outputs.",
    parts: [
      {
        type: "file_read",
        toolName: "file_read",
        toolInput: { path: "demo-repo/src/server.ts" },
        toolResult: {
          path: "demo-repo/src/server.ts",
          content:
            "import express from 'express'\n\nconst app = express()\n\napp.get('/health', (_req, res) => {\n  res.json({ ok: true })\n})\n\napp.listen(3000)\n",
        },
      },
      {
        type: "list_files",
        toolName: "list_files",
        toolInput: { path: "demo-repo" },
        toolResult: {
          path: "demo-repo",
          files: [
            { name: "src", path: "src", type: "directory", size: 0, modified: "2026-05-10" },
            {
              name: "server.ts",
              path: "src/server.ts",
              type: "file",
              size: 3280,
              modified: "2026-05-10",
            },
            { name: "tests", path: "tests", type: "directory", size: 0, modified: "2026-05-10" },
            {
              name: "server.test.ts",
              path: "tests/server.test.ts",
              type: "file",
              size: 2180,
              modified: "2026-05-10",
            },
            {
              name: "node_modules",
              path: "node_modules",
              type: "directory",
              size: 0,
              modified: "",
              protected: true,
              skipped: true,
              reason: "Skipped because dependencies are large.",
            },
            {
              name: "package.json",
              path: "package.json",
              type: "file",
              size: 720,
              modified: "2026-05-10",
            },
            {
              name: "README.md",
              path: "README.md",
              type: "file",
              size: 1500,
              modified: "2026-05-10",
            },
          ],
        },
      },
      {
        type: "file_search",
        toolName: "file_search",
        toolResult: {
          query: "TODO|FIXME",
          path: "demo-repo",
          exitCode: 0,
          matches: [
            { file: "src/server.ts", line: 42, text: "// TODO: add request tracing middleware" },
            { file: "README.md", line: 18, text: "FIXME: document deployment variables" },
          ],
        },
      },
      {
        type: "write_file",
        toolName: "write_file",
        toolInput: { path: "demo-repo/summary.txt" },
        toolResult: {
          success: true,
          path: "demo-repo/summary.txt",
          bytes: 842,
          message: "Wrote summary.txt",
        },
      },
    ],
  },
  {
    title: "Search And Research",
    description: "Web search, deep research, summaries, and TODO extraction.",
    parts: [
      {
        type: "web_search",
        toolName: "web_search",
        toolInput: { query: "Next.js route handlers streaming example" },
        toolResult: {
          query: "Next.js route handlers streaming example",
          totalResults: 3,
          searchTime: 640,
          source: "mock",
          results: [
            {
              title: "Route Handlers",
              url: "https://nextjs.org/docs/app/building-your-application/routing/route-handlers",
              snippet: "Route handlers can return web Response objects and streams.",
              publishedDate: "2026-01-12",
            },
            {
              title: "Streaming UI",
              url: "https://react.dev/reference/react/use",
              snippet: "React can progressively reveal server-rendered content.",
            },
          ],
        },
      },
      {
        type: "extract_todos",
        toolName: "extract_todos",
        toolResult: {
          count: 3,
          todos: [
            {
              file: "src/server.ts",
              line: 42,
              text: "add request tracing middleware",
              priority: "high",
            },
            {
              file: "README.md",
              line: 18,
              text: "document deployment variables",
              priority: "medium",
            },
            {
              file: "tests/server.test.ts",
              line: 9,
              text: "cover invalid payload",
              priority: "low",
            },
          ],
        },
      },
      {
        type: "research_report",
        toolName: "research_report",
        toolResult: {
          title: "Repository Audit",
          summary:
            "The demo service is a compact Express app with health checks and TODOs around observability.",
          findings: [
            "The server entry point is src/server.ts.",
            "Tests cover health checks but not invalid request payloads.",
            "README needs deployment environment documentation.",
          ],
          sources: ["demo-repo/src/server.ts", "demo-repo/package.json", "demo-repo/README.md"],
        },
      },
      {
        type: "text_output",
        toolName: "text_summarize",
        toolResult: {
          title: "Summary",
          text: "The project exposes a minimal API service. Key next work: tracing, deployment docs, and validation tests.",
        },
      },
    ],
  },
  {
    title: "Browser",
    description: "Navigation, screenshots, GUI actions, forms, extraction, and waits.",
    parts: [
      {
        type: "browser_navigate",
        toolName: "browser_navigate",
        toolInput: { url: "https://demo.rekdin.local/audit" },
        toolResult: {
          url: "https://demo.rekdin.local/audit",
          title: "Audit Dashboard",
          content:
            "Navigated to https://demo.rekdin.local/audit\nAudit dashboard loaded with 3 project checks.",
        },
      },
      {
        type: "browser_screenshot",
        toolName: "browser_screenshot",
        toolResult: {
          url: "https://demo.rekdin.local/audit",
          title: "Audit Dashboard",
          screenshot: screenshotDataUrl,
        },
      },
      {
        type: "browser_get_markdown",
        toolName: "browser_get_markdown",
        toolResult: {
          url: "https://demo.rekdin.local/readme",
          title: "README Preview",
          markdown,
        },
      },
      {
        type: "browser_click",
        toolName: "browser_click",
        toolInput: { selector: "button[data-action='run-audit']", screenshot: screenshotDataUrl },
        toolResult: { status: "success", x: 320, y: 184, screenshot: screenshotDataUrl },
      },
      {
        type: "browser_hover",
        toolName: "browser_hover",
        toolInput: { selector: "[data-tooltip='coverage']", screenshot: screenshotDataUrl },
        toolResult: { status: "success", x: 610, y: 252, screenshot: screenshotDataUrl },
      },
      {
        type: "browser_drag",
        toolName: "browser_drag",
        toolInput: { from: "#source-card", to: "#target-column", screenshot: screenshotDataUrl },
        toolResult: {
          status: "success",
          startX: 220,
          startY: 260,
          endX: 720,
          endY: 310,
          screenshot: screenshotDataUrl,
        },
      },
      {
        type: "browser_form_input_fill",
        toolName: "browser_form_input_fill",
        toolInput: {
          selector: "input[name='query']",
          value: "TODO FIXME",
          screenshot: screenshotDataUrl,
        },
        toolResult: { status: "success", screenshot: screenshotDataUrl },
      },
      {
        type: "browser_wait",
        toolName: "browser_wait",
        toolInput: { duration: 1500, selector: "[data-status='complete']" },
        toolResult: { status: "success", elapsedMs: 1510 },
      },
      {
        type: "browser_extract",
        toolName: "browser_extract",
        toolInput: { selector: ".audit-result", type: "cards", screenshot: screenshotDataUrl },
        toolResult: {
          status: "success",
          screenshot: screenshotDataUrl,
          extractedData: [
            { title: "Workspace guard", status: "pass" },
            { title: "README coverage", status: "warning" },
          ],
        },
      },
      {
        type: "browser_vision_control",
        toolName: "browser_vision_control",
        toolInput: { thought: "Click the run audit button after verifying the page is loaded." },
        toolResult: {
          status: "success",
          thought: "The primary action button is visible and enabled.",
          step: "Move to Run Audit and click.",
          action: "click(320, 184)",
          x: 320,
          y: 184,
          screenshot: screenshotDataUrl,
        },
      },
    ],
  },
  {
    title: "HTTP And Packages",
    description: "HTTP response, package metadata, link previews, and network-like output.",
    parts: [
      {
        type: "http_request",
        toolName: "http_request",
        toolResult: {
          url: "https://api.example.test/health",
          method: "GET",
          status: 200,
          ok: true,
          duration: 185,
          size: 84,
          headers: {
            "content-type": "application/json",
            "x-request-id": "mock-req-42",
          },
          json: { ok: true, service: "demo-repo", version: "0.1.0" },
        },
      },
      {
        type: "npm_package_info",
        toolName: "npm_package_info",
        toolInput: { name: "express" },
        toolResult: {
          name: "express",
          version: "4.18.3",
          description: "Fast, unopinionated, minimalist web framework",
          license: "MIT",
          homepage: "https://expressjs.com/",
          repository: { url: "git+https://github.com/expressjs/express.git" },
          dependencies: { "body-parser": "1.20.2", qs: "6.11.0" },
        },
      },
      {
        type: "link_preview",
        toolName: "link_preview",
        toolInput: { url: "https://demo.rekdin.local/readme" },
        toolResult: {
          url: "https://demo.rekdin.local/readme",
          title: "Demo Repo README",
          description: "Small Express project used to demonstrate Rekdin tool execution.",
          image: screenshotDataUrl,
        },
      },
    ],
  },
  {
    title: "Git",
    description: "Diffs, logs, branches, and blame views.",
    parts: [
      {
        type: "git_diff",
        toolName: "git_diff_summary",
        toolResult: {
          status: "success",
          diff: "diff --git a/src/server.ts b/src/server.ts\n@@ -1,5 +1,8 @@\n import express from 'express'\n+import { randomUUID } from 'node:crypto'\n \n const app = express()\n+app.use((req, _res, next) => { req.id = randomUUID(); next() })\n",
        },
      },
      {
        type: "git_log",
        toolName: "git_log_summary",
        toolResult: {
          output:
            "8a12f7c add workspace renderer mock page\n5b902ed improve file renderer scroll behavior\n19ad42a add tool approval tracing\n",
        },
      },
      {
        type: "git_branches",
        toolName: "git_branches",
        toolResult: {
          output: "* feature/renderer-ui\n  main\n  demo/script-refresh\n",
          exitCode: 0,
        },
      },
      {
        type: "git_blame",
        toolName: "git_blame",
        toolInput: { path: "src/server.ts" },
        toolResult: {
          path: "src/server.ts",
          lines: [
            {
              hash: "8a12f7c",
              author: "Ayush",
              date: "2026-05-10",
              lineNo: 1,
              text: "import express from 'express'",
            },
            {
              hash: "8a12f7c",
              author: "Ayush",
              date: "2026-05-10",
              lineNo: 2,
              text: "const app = express()",
            },
            {
              hash: "19ad42a",
              author: "Ayush",
              date: "2026-05-09",
              lineNo: 3,
              text: "app.get('/health', handler)",
            },
          ],
        },
      },
    ],
  },
  {
    title: "Data And Artifacts",
    description: "JSON, hashes, base64, archives, image metadata, and PDFs.",
    parts: [
      {
        type: "json",
        toolName: "json_patch",
        toolResult: jsonPayload,
      },
      {
        type: "hash",
        toolName: "hash",
        toolInput: { text: "demo-repo", algorithm: "sha256" },
        toolResult: {
          algorithm: "sha256",
          hash: "2d711642b726b04401627ca9fbac32f5da7f9c4f8fbb2f6d8ad7d0c1b7c8a001",
          inputType: "text",
        },
      },
      {
        type: "base64_encode",
        toolName: "base64_encode",
        toolInput: { text: "Rekdin renderer mock" },
        toolResult: { encoded: "UmVrZGluIHJlbmRlcmVyIG1vY2s=", text: "Rekdin renderer mock" },
      },
      {
        type: "archive",
        toolName: "archive_create",
        toolResult: {
          success: true,
          archiveName: "demo-repo-audit.zip",
          size: 148224,
          artifactUrl: "/artifacts/demo-repo-audit.zip",
        },
      },
      {
        type: "image_info",
        toolName: "image_info",
        toolResult: {
          path: "screenshots/audit.png",
          width: 960,
          height: 540,
          format: "png",
          size: 48220,
          channels: 4,
        },
      },
      {
        type: "markdown_to_pdf",
        toolName: "markdown_to_pdf",
        toolResult: {
          success: true,
          pdfGenerated: true,
          filename: "summary",
          artifactUrl: "data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrCg==",
          duration: 920,
          latex: "\\section{Summary}\\nDemo repo audit.",
        },
      },
      {
        type: "generic",
        toolName: "unknown_tool",
        toolResult: {
          message: "Fallback renderer sample",
          nested: { safe: true, visible: true },
        },
      },
    ],
  },
]

export default function RendererMockPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <main className="bg-background text-foreground min-h-dvh">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6">
        <header className="border-border bg-surface-2 rounded-lg border px-4 py-3">
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="rk-section-label mb-2">Renderer Gallery</p>
              <h1 className="text-lg font-semibold">Tool Result Renderer Mock Page</h1>
              <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
                Static fixtures for scanning the renderer UI without running an agent turn. Open
                this page at <span className="font-mono">/renderer-mock</span>.
              </p>
            </div>
            <ThemeToggle />
          </div>
        </header>

        {mounted ? (
          sections.map((section) => (
            <section key={section.title} className="grid gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <h2 className="text-sm font-semibold">{section.title}</h2>
                <p className="text-muted-foreground text-xs">{section.description}</p>
              </div>
              <ToolResultRenderer content={section.parts} />
            </section>
          ))
        ) : (
          <section className="border-border bg-surface-2 rounded-lg border px-4 py-8">
            <p className="text-muted-foreground text-sm">Loading renderer fixtures...</p>
          </section>
        )}
      </div>
    </main>
  )
}
