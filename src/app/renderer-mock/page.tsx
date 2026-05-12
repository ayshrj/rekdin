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
      {
        type: "git_status",
        toolName: "git_status",
        toolResult: {
          output:
            "## feature/renderer-ui...origin/feature/renderer-ui\nM  src/server.ts\nA  src/middleware/auth.ts\n M src/config/env.ts\n M test/server.test.ts\n?? tmp/scratch.js\n",
        },
      },
      {
        type: "git_staged_diff",
        toolName: "git_staged_diff",
        toolResult: {
          diff: "diff --git a/src/server.ts b/src/server.ts\nindex 1a2b3c4..5d6e7f8 100644\n--- a/src/server.ts\n+++ b/src/server.ts\n@@ -1,4 +1,6 @@\n import express from 'express'\n+import cors from 'cors'\n \n const app = express()\n+app.use(cors())\n app.listen(3000)\n",
        },
      },
      {
        type: "git_show",
        toolName: "git_show",
        toolResult: {
          output:
            'commit 8a12f7c3b9e4d1f6a20c55e8b7d34921fc06a8b2\nAuthor: Ayush Raj <ayush@example.com>\nDate:   Sat May 10 14:32:11 2026 +0530\n\n    feat: add workspace renderer mock page\n\ndiff --git a/src/app/renderer-mock/page.tsx b/src/app/renderer-mock/page.tsx\nnew file mode 100644\nindex 0000000..1a2b3c4\n--- /dev/null\n+++ b/src/app/renderer-mock/page.tsx\n@@ -0,0 +1,5 @@\n+"use client"\n+\n+export default function Page() {\n+  return <div>Renderer mock</div>\n+}\n',
        },
      },
      {
        type: "git_conflicts",
        toolName: "git_conflicts",
        toolResult: {
          files: ["src/middleware/auth.ts", "src/config/env.ts"],
        },
      },
      {
        type: "git_tags",
        toolName: "git_tags",
        toolResult: {
          output:
            "v1.0.0  abc1234  2026-01-15  Initial stable release\nv1.1.0  def5678  2026-03-02  Performance improvements\nv2.0.0  ghi9012  2026-05-01  Major renderer overhaul\n",
        },
      },
      {
        type: "git_remote_info",
        toolName: "git_remote_info",
        toolResult: {
          output:
            "origin\thttps://github.com/ayush/rekdin.git (fetch)\norigin\thttps://github.com/ayush/rekdin.git (push)\nupstream\thttps://github.com/upstream/rekdin.git (fetch)\nupstream\thttps://github.com/upstream/rekdin.git (push)\n",
        },
      },
      {
        type: "git_commit_search",
        toolName: "git_commit_search",
        toolInput: { query: "renderer" },
        toolResult: {
          query: "renderer",
          output:
            "8a12f7c feat: add workspace renderer mock page\n5b902ed chore: improve file renderer scroll behavior\n19ad42a feat: add tool approval tracing\n",
        },
      },
    ],
  },
  {
    title: "Code Analysis",
    description: "File stats, workspace overview, symbol search, outlines, and project maps.",
    parts: [
      {
        type: "file_stat",
        toolName: "file_stat",
        toolInput: { path: "src/lib/server/tools.ts" },
        toolResult: {
          path: "src/lib/server/tools.ts",
          size: 61830,
          sizeHuman: "60.4 KB",
          permissions: "-rw-r--r--",
          owner: "ayush",
          lineCount: 1847,
          modified: "2026-05-10T14:32:11Z",
          isDirectory: false,
        },
      },
      {
        type: "file_head_tail",
        toolName: "file_head_tail",
        toolInput: { path: "src/lib/server/tools.ts", mode: "head", lines: 8 },
        toolResult: {
          path: "src/lib/server/tools.ts",
          mode: "head",
          requestedLines: 8,
          totalLines: 1847,
          head: 'import { z } from "zod"\nimport { tool } from "@langchain/core/tools"\n\n// tool registry\nexport const toolRegistry: Record<string, unknown> = {}\n\nexport function createToolset(names: string[]) {\n  return names.map((n) => toolRegistry[n]).filter(Boolean)\n}',
        },
      },
      {
        type: "workspace_stats",
        toolName: "workspace_stats",
        toolResult: {
          root: "/workspace/rekdin",
          totalFiles: 187,
          totalLines: 42310,
          languages: [
            { name: "TypeScript", files: 98, lines: 31240 },
            { name: "TSX", files: 44, lines: 9820 },
            { name: "JSON", files: 22, lines: 890 },
            { name: "CSS", files: 8, lines: 310 },
            { name: "Markdown", files: 15, lines: 50 },
          ],
        },
      },
      {
        type: "symbol_search",
        toolName: "symbol_search",
        toolInput: { query: "ToolResultRenderer" },
        toolResult: {
          query: "ToolResultRenderer",
          matches: [
            {
              file: "src/components/tools/renderers/tool-result-renderer.tsx",
              line: 288,
              kind: "function",
              name: "ToolResultRenderer",
              text: "export function ToolResultRenderer({ content, onAction, className = '' }",
            },
            {
              file: "src/components/workspace-panel.tsx",
              line: 143,
              kind: "import",
              name: "ToolResultRenderer",
              text: 'import { ToolResultRenderer } from "@/components/tools/renderers/tool-result-renderer"',
            },
            {
              file: "src/app/renderer-mock/page.tsx",
              line: 9,
              kind: "import",
              name: "ToolResultRenderer",
              text: 'import { ToolResultRenderer } from "@/components/tools/renderers/tool-result-renderer"',
            },
          ],
        },
      },
      {
        type: "file_outline",
        toolName: "file_outline",
        toolInput: { path: "src/contexts/chat-context.tsx" },
        toolResult: {
          path: "src/contexts/chat-context.tsx",
          symbols: [
            {
              name: "ChatContext",
              kind: "interface",
              line: 18,
              children: [
                { name: "messages", kind: "property", line: 19 },
                { name: "sendMessage", kind: "method", line: 24 },
                { name: "updateCustomWorkflows", kind: "method", line: 25 },
              ],
            },
            { name: "ChatContextProvider", kind: "function", line: 42 },
            { name: "useChatContext", kind: "function", line: 198 },
          ],
        },
      },
      {
        type: "route_map",
        toolName: "route_map",
        toolResult: {
          routes: [
            { method: "POST", path: "/api/chat", file: "src/app/api/chat/route.ts", line: 12 },
            {
              method: "GET",
              path: "/api/settings",
              file: "src/app/api/settings/route.ts",
              line: 8,
            },
            {
              method: "POST",
              path: "/api/settings",
              file: "src/app/api/settings/route.ts",
              line: 34,
            },
            {
              method: "GET",
              path: "/api/workspace/browse",
              file: "src/app/api/workspace/browse/route.ts",
              line: 6,
            },
            {
              method: "POST",
              path: "/api/tool-approvals/[id]",
              file: "src/app/api/tool-approvals/[approvalId]/route.ts",
              line: 9,
            },
          ],
        },
      },
      {
        type: "env_inventory",
        toolName: "env_inventory",
        toolResult: {
          variables: [
            { name: "OPENROUTER_API_KEY", source: ".env.local", hasValue: true },
            { name: "CLOUDINARY_URL", source: ".env.local", hasValue: true },
            { name: "NEXT_PUBLIC_APP_URL", source: ".env", hasValue: true },
            { name: "DATABASE_URL", source: ".env.example", hasValue: false },
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
  {
    title: "Network & Web Metadata",
    description:
      "visit_link, robots_txt, sitemap_fetch, rss_fetch, page_metadata_batch, domain_info, github_repo_info, citation_metadata, fetch_many, search_batch",
    parts: [
      {
        type: "visit_link",
        toolName: "visit_link",
        toolInput: { url: "https://docs.anthropic.com/en/api/getting-started" },
        toolResult: {
          url: "https://docs.anthropic.com/en/api/getting-started",
          status: 200,
          title: "Getting Started — Anthropic API",
          content:
            "# Getting Started\n\nWelcome to the Anthropic API. This guide covers authentication, your first request, and common patterns for working with Claude.\n\n## Authentication\n\nAll API requests require an `x-api-key` header containing your API key...",
        },
      },
      {
        type: "robots_txt",
        toolName: "robots_txt",
        toolResult: {
          url: "https://example.com/robots.txt",
          rules: [
            { userAgent: "*", path: "/", allow: true },
            { userAgent: "*", path: "/admin", allow: false },
            { userAgent: "*", path: "/private", allow: false },
            { userAgent: "Googlebot", path: "/api", allow: false },
          ],
          sitemaps: ["https://example.com/sitemap.xml"],
        },
      },
      {
        type: "rss_fetch",
        toolName: "rss_fetch",
        toolResult: {
          title: "Anthropic News",
          url: "https://www.anthropic.com/feed.xml",
          items: [
            {
              title: "Claude 4 Announcement",
              date: "2025-05-01",
              link: "https://anthropic.com/news/claude-4",
              summary:
                "Introducing Claude 4, our most capable model yet with enhanced reasoning and coding abilities.",
            },
            {
              title: "Constitutional AI Research Update",
              date: "2025-04-15",
              link: "https://anthropic.com/research/cai-update",
              summary: "New findings on using AI feedback to train safer models.",
            },
            {
              title: "API Rate Limits Increased",
              date: "2025-04-02",
              link: "https://anthropic.com/news/rate-limits",
              summary: "We've doubled rate limits for all tiers to support production workloads.",
            },
          ],
        },
      },
      {
        type: "github_repo_info",
        toolName: "github_repo_info",
        toolResult: {
          fullName: "anthropics/anthropic-sdk-python",
          description: "The official Python library for the Anthropic API",
          language: "Python",
          stars: 3841,
          forks: 412,
          openIssues: 28,
          license: "MIT",
          topics: ["anthropic", "claude", "ai", "llm", "python"],
          htmlUrl: "https://github.com/anthropics/anthropic-sdk-python",
        },
      },
      {
        type: "domain_info",
        toolName: "domain_info",
        toolResult: {
          domain: "anthropic.com",
          registrar: "Cloudflare, Inc.",
          ips: ["104.18.32.119", "104.18.33.119"],
          nameservers: ["ns1.cloudflare.com", "ns2.cloudflare.com"],
          created: "2016-04-07",
          expires: "2027-04-07",
          status: "clientTransferProhibited",
        },
      },
      {
        type: "citation_metadata",
        toolName: "citation_metadata",
        toolResult: {
          title: "Constitutional AI: Harmlessness from AI Feedback",
          authors: ["Bai, Yuntao", "Jones, Andy", "Ndousse, Kamal", "Askell, Amanda"],
          year: 2022,
          journal: "arXiv preprint",
          doi: "10.48550/arXiv.2212.08073",
          abstract:
            "As AI systems become more capable, we would like to enlist their help to supervise other AIs. We experiment with methods for training a harmless AI assistant through self-improvement, without any human labels identifying harmful outputs...",
        },
      },
      {
        type: "fetch_many",
        toolName: "fetch_many",
        toolResult: {
          items: [
            {
              url: "https://example.com/page1",
              status: 200,
              title: "Page One",
              summary: "Introduction to the product with key features and pricing details.",
            },
            {
              url: "https://example.com/page2",
              status: 200,
              title: "Page Two",
              summary: "Technical documentation covering API endpoints and authentication.",
            },
            { url: "https://example.com/missing", status: 404, error: "Not Found" },
          ],
        },
      },
      {
        type: "search_batch",
        toolName: "search_batch",
        toolResult: {
          results: [
            {
              url: "https://arxiv.org/abs/2212.08073",
              title: "Constitutional AI",
              query: "constitutional AI Anthropic",
              summary: "Self-improving harmless AI without human labels.",
            },
            {
              url: "https://arxiv.org/abs/2302.07459",
              title: "LLM-as-a-judge",
              query: "LLM evaluation methods",
              summary: "Using large language models to evaluate model outputs.",
            },
          ],
        },
      },
    ],
  },
  {
    title: "Browser Extended",
    description:
      "browser_evaluate, browser_console_logs, browser_network_log, browser_storage_snapshot, browser_accessibility_snapshot, browser_set_viewport, browser_form_schema, browser_downloads",
    parts: [
      {
        type: "browser_evaluate",
        toolName: "browser_evaluate",
        toolInput: { expression: "document.querySelectorAll('a').length" },
        toolResult: {
          success: true,
          result: 42,
          console: [{ level: "log", message: "evaluating selector count" }],
        },
      },
      {
        type: "browser_console_logs",
        toolName: "browser_console_logs",
        toolResult: {
          logs: [
            {
              level: "error",
              message: "Uncaught TypeError: Cannot read properties of undefined (reading 'map')",
              timestamp: "10:21:03",
            },
            {
              level: "warn",
              message: "React: Each child in a list should have a unique key prop",
              timestamp: "10:21:04",
            },
            { level: "info", message: "App initialized in 342ms", timestamp: "10:21:05" },
            { level: "log", message: "Fetching /api/chat", timestamp: "10:21:06" },
          ],
        },
      },
      {
        type: "browser_network_log",
        toolName: "browser_network_log",
        toolResult: {
          requests: [
            {
              method: "GET",
              url: "https://example.com/api/data",
              status: 200,
              size: 4820,
              duration: 112,
            },
            {
              method: "POST",
              url: "https://example.com/api/chat",
              status: 200,
              size: 1240,
              duration: 890,
            },
            {
              method: "GET",
              url: "https://example.com/api/missing",
              status: 404,
              size: 120,
              duration: 44,
            },
            {
              method: "DELETE",
              url: "https://example.com/api/session",
              status: 204,
              size: 0,
              duration: 31,
            },
          ],
        },
      },
      {
        type: "browser_storage_snapshot",
        toolName: "browser_storage_snapshot",
        toolResult: {
          localStorage: { theme: "dark", userId: "usr_abc123", lastRoute: "/dashboard" },
          sessionStorage: { csrfToken: "tok_xyz789", returnUrl: "/settings" },
          cookies: [
            {
              name: "session",
              value: "s%3Axyz",
              domain: "example.com",
              httpOnly: true,
              secure: true,
            },
            { name: "analytics", value: "ga_456", domain: ".example.com", secure: false },
          ],
        },
      },
      {
        type: "browser_accessibility_snapshot",
        toolName: "browser_accessibility_snapshot",
        toolResult: {
          snapshot: {
            role: "document",
            name: "Home",
            children: [
              {
                role: "banner",
                name: "Site header",
                children: [
                  {
                    role: "navigation",
                    name: "Main nav",
                    children: [
                      { role: "link", name: "Home" },
                      { role: "link", name: "About" },
                    ],
                  },
                ],
              },
              {
                role: "main",
                name: "Main content",
                children: [
                  { role: "heading", name: "Welcome to Rekdin", description: "level 1" },
                  { role: "button", name: "Get Started" },
                ],
              },
            ],
          },
        },
      },
      {
        type: "browser_form_schema",
        toolName: "browser_form_schema",
        toolInput: { url: "https://example.com/signup" },
        toolResult: {
          fields: [
            {
              name: "email",
              type: "email",
              label: "Email address",
              required: true,
              placeholder: "you@example.com",
            },
            { name: "password", type: "password", label: "Password", required: true },
            {
              name: "plan",
              type: "select",
              label: "Plan",
              required: true,
              options: ["free", "pro", "team"],
            },
            {
              name: "newsletter",
              type: "checkbox",
              label: "Subscribe to newsletter",
              required: false,
            },
          ],
        },
      },
      {
        type: "browser_downloads",
        toolName: "browser_downloads",
        toolResult: {
          files: [
            {
              filename: "report-2025-Q1.pdf",
              size: 204800,
              path: "/tmp/downloads/report-2025-Q1.pdf",
              mimeType: "application/pdf",
            },
            {
              filename: "data-export.csv",
              size: 48200,
              path: "/tmp/downloads/data-export.csv",
              mimeType: "text/csv",
            },
          ],
        },
      },
    ],
  },
  {
    title: "Image Extended",
    description: "image_exif, image_ocr, image_diff, svg_optimize",
    parts: [
      {
        type: "image_exif",
        toolName: "image_exif",
        toolResult: {
          file: "photos/sunset.jpg",
          exif: {
            Make: "Apple",
            Model: "iPhone 15 Pro",
            LensModel: "iPhone 15 Pro back triple camera 6.765mm f/1.78",
            ISO: "64",
            FNumber: "1.78",
            ExposureTime: "1/2000",
            FocalLength: "6.765 mm",
            DateTimeOriginal: "2025-04-12 18:32:11",
            ImageWidth: "4032",
            ImageHeight: "3024",
            ColorSpace: "sRGB",
            GPSLatitude: "37.7749",
            GPSLatitudeRef: "N",
            GPSLongitude: "-122.4194",
            GPSLongitudeRef: "W",
            GPSAltitude: "52.3 m",
          },
        },
      },
      {
        type: "image_ocr",
        toolName: "image_ocr",
        toolResult: {
          file: "screenshots/error.png",
          language: "en",
          confidence: 0.94,
          text: "Error: ENOENT: no such file or directory, open '/var/app/config.json'\n    at Object.openSync (node:fs:596:3)\n    at Object.readFileSync (node:fs:464:35)\n    at loadConfig (/app/src/config.ts:12:21)\n    at startup (/app/src/index.ts:8:14)",
        },
      },
      {
        type: "image_diff",
        toolName: "image_diff",
        toolResult: {
          diffPixels: 14820,
          totalPixels: 921600,
          changedPercent: 1.61,
          threshold: 0.1,
          boundingBox: { x: 120, y: 88, width: 640, height: 32 },
        },
      },
      {
        type: "svg_optimize",
        toolName: "svg_optimize",
        toolResult: {
          file: "assets/logo.svg",
          originalSize: 14380,
          optimizedSize: 4210,
          savingsPercent: 70.7,
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#6366f1"/></svg>',
        },
      },
    ],
  },
  {
    title: "Data Tables & Query",
    description:
      "csv_preview, sqlite_query, json_query, yaml_patch, token_count, text_entities, text_keywords, markdown_frontmatter",
    parts: [
      {
        type: "csv_preview",
        toolName: "csv_preview",
        toolResult: {
          source: "data/sales.csv",
          columns: ["id", "product", "region", "revenue", "units"],
          rows: [
            ["1", "Widget A", "North", "12400", "124"],
            ["2", "Widget B", "South", "8750", "87"],
            ["3", "Gadget X", "East", "31200", "208"],
            ["4", "Gadget Y", "West", "19800", "165"],
            ["5", "Widget A", "East", "9100", "91"],
            ["6", "Gadget X", "North", "27600", "184"],
            ["7", "Widget B", "West", "6300", "63"],
            ["8", "Gadget Y", "South", "22100", "184"],
          ],
          totalRows: 8,
        },
      },
      {
        type: "sqlite_query",
        toolName: "sqlite_query",
        toolResult: {
          source: "app.db",
          query: "SELECT * FROM users LIMIT 5",
          data: [
            {
              id: 1,
              name: "Alice Chen",
              email: "alice@example.com",
              role: "admin",
              created_at: "2024-01-10",
            },
            {
              id: 2,
              name: "Bob Smith",
              email: "bob@example.com",
              role: "user",
              created_at: "2024-02-14",
            },
            {
              id: 3,
              name: "Carol Jones",
              email: "carol@example.com",
              role: "user",
              created_at: "2024-03-01",
            },
          ],
          totalRows: 3,
        },
      },
      {
        type: "json_query",
        toolName: "json_query",
        toolResult: {
          query: "$.tools[?(@.type=='browser')]",
          result: [
            { type: "browser", name: "browser_navigate", enabled: true },
            { type: "browser", name: "browser_screenshot", enabled: true },
          ],
        },
      },
      {
        type: "yaml_patch",
        toolName: "yaml_patch",
        toolResult: {
          patch: "set .model = claude-sonnet-4-6",
          before: "model: claude-opus-4\ntemperature: 0.7\nmaxTokens: 4096\n",
          after: "model: claude-sonnet-4-6\ntemperature: 0.7\nmaxTokens: 4096\n",
        },
      },
      {
        type: "token_count",
        toolName: "token_count",
        toolResult: {
          model: "claude-sonnet-4-6",
          tokens: 18432,
          limit: 200000,
        },
      },
      {
        type: "text_entities",
        toolName: "text_entities",
        toolResult: {
          entities: [
            { text: "Anthropic", type: "ORG", score: 0.99 },
            { text: "San Francisco", type: "LOC", score: 0.97 },
            { text: "Claude", type: "PERSON", score: 0.88 },
            { text: "January 2025", type: "DATE", score: 0.95 },
            { text: "OpenAI", type: "ORG", score: 0.98 },
            { text: "New York", type: "LOC", score: 0.96 },
          ],
        },
      },
      {
        type: "text_keywords",
        toolName: "text_keywords",
        toolResult: {
          keywords: [
            { word: "language model", score: 0.94, count: 12 },
            { word: "inference", score: 0.87, count: 8 },
            { word: "tokenization", score: 0.81, count: 5 },
            { word: "fine-tuning", score: 0.79, count: 4 },
            { word: "alignment", score: 0.76, count: 6 },
            { word: "RLHF", score: 0.72, count: 3 },
          ],
        },
      },
      {
        type: "markdown_frontmatter",
        toolName: "markdown_frontmatter",
        toolResult: {
          file: "docs/overview.md",
          frontmatter: {
            title: "Rekdin Overview",
            author: "Ayush Raj",
            date: "2025-05-10",
            tags: ["ai", "workspace", "tooling"],
            draft: false,
          },
        },
      },
    ],
  },
  {
    title: "Security & Code Quality",
    description:
      "secret_scan, dependency_audit, license_summary, semgrep_scan, duplicate_code_candidates, dead_code_candidates, dockerfile_scan",
    parts: [
      {
        type: "secret_scan",
        toolName: "secret_scan",
        toolResult: {
          scannedFiles: 84,
          findings: [
            {
              file: "src/lib/config.ts",
              line: 12,
              rule: "hardcoded-api-key",
              value: "sk-live-abc123",
            },
            { file: ".env.example", line: 3, rule: "aws-access-key", preview: "AKIA***" },
          ],
        },
      },
      {
        type: "secret_scan",
        toolName: "secret_scan",
        toolResult: { scannedFiles: 120, findings: [] },
      },
      {
        type: "dependency_audit",
        toolName: "dependency_audit",
        toolResult: {
          vulnerabilities: [
            {
              package: "lodash",
              version: "4.17.19",
              severity: "high",
              cve: "CVE-2021-23337",
              title: "Command injection via template",
              fixedIn: "4.17.21",
            },
            {
              package: "axios",
              version: "0.21.0",
              severity: "medium",
              cve: "CVE-2021-3749",
              title: "ReDoS in trim function",
            },
          ],
        },
      },
      {
        type: "license_summary",
        toolName: "license_summary",
        toolResult: {
          licenses: [
            { license: "MIT", packages: ["react", "next", "tailwindcss", "zod"] },
            { license: "Apache-2.0", packages: ["@anthropic-ai/sdk", "langchain"] },
            { license: "ISC", packages: ["semver", "glob"] },
          ],
        },
      },
      {
        type: "semgrep_scan",
        toolName: "semgrep_scan",
        toolResult: {
          tool: "Semgrep",
          findings: [
            {
              file: "src/app/api/chat/route.ts",
              line: 44,
              rule: "javascript.lang.security.audit.dangerous-eval",
              severity: "error",
              message: "Avoid using eval() — arbitrary code execution risk",
            },
            {
              file: "src/lib/server/tools.ts",
              line: 118,
              rule: "javascript.express.security.audit.xss.mustache.unescaped-var",
              severity: "warning",
              message: "Unescaped variable in template",
            },
            {
              file: "src/components/chat/chat-panel.tsx",
              line: 72,
              rule: "react.hooks.exhaustive-deps",
              severity: "info",
              message: "Missing dependency in useEffect",
            },
          ],
        },
      },
      {
        type: "dockerfile_scan",
        toolName: "dockerfile_scan",
        toolResult: {
          file: "Dockerfile",
          issues: [
            {
              file: "Dockerfile",
              line: 3,
              rule: "DL3006",
              severity: "warning",
              message: "Always tag the version of an image explicitly",
            },
            {
              file: "Dockerfile",
              line: 14,
              rule: "DL3009",
              severity: "info",
              message: "Delete the apt-get lists after installing packages",
            },
          ],
        },
      },
      {
        type: "duplicate_code_candidates",
        toolName: "duplicate_code_candidates",
        toolResult: {
          candidates: [
            {
              fileA: "src/lib/server/tools.ts",
              lineA: 88,
              fileB: "src/lib/server/runtime/agent-runtime.ts",
              lineB: 201,
              lines: 24,
              similarity: 0.91,
            },
            {
              fileA: "src/components/chat/chat-panel.tsx",
              lineA: 310,
              fileB: "src/components/workspace-panel.tsx",
              lineB: 145,
              lines: 16,
              similarity: 0.87,
            },
          ],
        },
      },
      {
        type: "dead_code_candidates",
        toolName: "dead_code_candidates",
        toolResult: {
          candidates: [
            {
              file: "src/lib/utils.ts",
              line: 42,
              name: "formatDuration",
              kind: "function",
              reason: "No callers found in project",
            },
            {
              file: "src/types/chat.ts",
              line: 88,
              name: "LegacyMessage",
              kind: "type",
              reason: "No references outside declaration file",
            },
          ],
        },
      },
    ],
  },
  {
    title: "Artifact & Dev Server",
    description:
      "artifact_list, artifact_read, artifact_delete, asset_manifest, dev_server_start, dev_server_stop, dev_server_status, port_probe, http_health_check, npm_scripts, run_npm_script",
    parts: [
      {
        type: "artifact_list",
        toolName: "artifact_list",
        toolResult: {
          artifacts: [
            {
              id: "a1",
              name: "report.pdf",
              type: "application/pdf",
              size: 204800,
              createdAt: "2024-11-20T14:30:00Z",
              url: "https://example.com/artifacts/report.pdf",
            },
            {
              id: "a2",
              name: "analysis.json",
              type: "application/json",
              size: 8192,
              createdAt: "2024-11-20T14:45:00Z",
            },
            {
              id: "a3",
              name: "screenshot.png",
              type: "image/png",
              size: 512000,
              createdAt: "2024-11-20T15:00:00Z",
            },
          ],
        },
      },
      {
        type: "artifact_read",
        toolName: "artifact_read",
        toolResult: {
          name: "analysis.json",
          mimeType: "application/json",
          content:
            '{\n  "summary": "Code analysis complete",\n  "issues": 3,\n  "coverage": 87.4,\n  "grade": "B+"\n}',
        },
      },
      {
        type: "artifact_delete",
        toolName: "artifact_delete",
        toolResult: { success: true, name: "old-report.pdf" },
      },
      {
        type: "asset_manifest",
        toolName: "asset_manifest",
        toolResult: {
          assets: [
            {
              path: "dist/main.js",
              hash: "a1b2c3d4e5f6",
              size: 102400,
              type: "application/javascript",
            },
            { path: "dist/main.css", hash: "f6e5d4c3b2a1", size: 24576, type: "text/css" },
            { path: "dist/index.html", hash: "1234abcd5678", size: 4096, type: "text/html" },
            { path: "dist/logo.svg", hash: "abcdef012345", size: 1024, type: "image/svg+xml" },
          ],
        },
      },
      {
        type: "dev_server_start",
        toolName: "dev_server_start",
        toolResult: {
          status: "running",
          url: "http://localhost:3000",
          port: 3000,
          pid: 42891,
          logs: "▲ Next.js 14.2.0\n- Local: http://localhost:3000\n- Ready in 1432ms",
        },
      },
      {
        type: "dev_server_stop",
        toolName: "dev_server_stop",
        toolResult: { status: "stopped", port: 3000, pid: 42891 },
      },
      {
        type: "dev_server_status",
        toolName: "dev_server_status",
        toolResult: { status: "running", url: "http://localhost:3000", port: 3000, pid: 42891 },
      },
      {
        type: "port_probe",
        toolName: "port_probe",
        toolInput: { host: "localhost", port: 3000 },
        toolResult: { host: "localhost", port: 3000, open: true, latency: 2 },
      },
      {
        type: "http_health_check",
        toolName: "http_health_check",
        toolInput: { url: "http://localhost:3000/api/health" },
        toolResult: {
          url: "http://localhost:3000/api/health",
          status: 200,
          healthy: true,
          responseTime: 18,
          message: "OK",
        },
      },
      {
        type: "npm_scripts",
        toolName: "npm_scripts",
        toolResult: {
          name: "my-next-app",
          scripts: {
            dev: "next dev",
            build: "next build",
            start: "next start",
            lint: "next lint",
            test: "jest --watch",
            typecheck: "tsc --noEmit",
          },
        },
      },
      {
        type: "run_npm_script",
        toolName: "run_npm_script",
        toolInput: { script: "typecheck" },
        toolResult: {
          script: "typecheck",
          exitCode: 0,
          stdout:
            "src/app/page.tsx\nsrc/components/chat/chat-panel.tsx\n\nFound 0 errors. Compilation complete.",
          stderr: "",
          duration: 4821,
        },
      },
    ],
  },
  {
    title: "Document Extraction & Security Checks",
    description:
      "pdf_extract_text, docx_extract_text, url_safety_check, workspace_permissions_scan",
    parts: [
      {
        type: "pdf_extract_text",
        toolName: "pdf_extract_text",
        toolInput: { file: "docs/architecture.pdf" },
        toolResult: {
          file: "docs/architecture.pdf",
          pages: 2,
          wordCount: 312,
          text: "# Architecture Overview\n\nThe system consists of three main layers: the presentation layer, the business logic layer, and the data access layer.\n\n## Presentation Layer\n\nThe presentation layer handles all user interactions and renders the UI components. It communicates with the business logic layer via REST APIs and WebSocket connections.\n\n## Business Logic Layer\n\nThis layer contains the core application logic including authentication, authorization, and data transformation. All operations are validated before being passed to the data layer.\n\n## Data Access Layer\n\nThe data access layer abstracts all database operations and file system interactions. It enforces workspace path safety and sanitizes all inputs.",
        },
      },
      {
        type: "docx_extract_text",
        toolName: "docx_extract_text",
        toolInput: { file: "docs/spec.docx" },
        toolResult: {
          file: "docs/spec.docx",
          wordCount: 87,
          text: "Product Specification v1.2\n\nScope: This document describes the requirements for the authentication module redesign.\n\nFunctional Requirements:\n1. Users must be able to log in with email and password.\n2. OAuth2 support for GitHub and Google.\n3. Session tokens must expire after 24 hours of inactivity.\n4. Failed login attempts must be rate-limited to 5 per minute.",
        },
      },
      {
        type: "url_safety_check",
        toolName: "url_safety_check",
        toolInput: { url: "https://docs.anthropic.com" },
        toolResult: {
          url: "https://docs.anthropic.com",
          safe: true,
          verdict: "safe",
          provider: "Google Safe Browsing",
          threats: [],
        },
      },
      {
        type: "url_safety_check",
        toolName: "url_safety_check",
        toolInput: { url: "http://malware-example.test/payload" },
        toolResult: {
          url: "http://malware-example.test/payload",
          safe: false,
          verdict: "unsafe",
          provider: "Google Safe Browsing",
          threats: ["MALWARE", "SOCIAL_ENGINEERING"],
        },
      },
      {
        type: "workspace_permissions_scan",
        toolName: "workspace_permissions_scan",
        toolResult: {
          files: [
            { path: "scripts/deploy.sh", permissions: "-rwxr-xr-x", owner: "root" },
            { path: "config/secrets.env", permissions: "-rw-------", owner: "app" },
            { path: "tmp/cache", permissions: "-rwxrwxrwx", owner: "app" },
            { path: "public/assets", permissions: "-rwxr-xr-x", owner: "app" },
            { path: "logs/app.log", permissions: "-rw-rw-rw-", owner: "app" },
          ],
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
