# Tools — Agent Reference

This folder contains all Rekdin tools, split into domain-specific modules. The original `src/lib/server/tools.ts` is now a one-line barrel that re-exports everything from `./tools/index`.

**Key entry point:** `createToolset()` lives in `index.ts` and assembles the full tool list for a given mode/policy.

---

## Folder map

```
tools/
  index.ts              ← barrel + createToolset()
  shared/               ← pure helpers, no tools
  browser/              ← headless Puppeteer automation
  workspace/            ← file I/O, shell, security scans
  code/                 ← AST analysis, execution, code maps, refactoring, architecture
  web/                  ← search, HTTP, metadata
  pdf/                  ← PDF generation and extraction
  documents/            ← docx, CSV, JSON, YAML, SQLite
  images/               ← image processing and OCR
  artifacts/            ← Rekdin artifact store + preview/conversion tools
  git/                  ← git read and write operations
  sessions/             ← session, replay, trace, settings
  dev/                  ← dev servers, npm, system, onboarding helpers
  utilities/            ← text, crypto, encoding, patching, misc
  api/                  ← API route maps, contract diffs, curl helpers
  agent/                ← agent plans, worklogs, diff review, regression risk
  ui/                   ← Tailwind, design, responsive, accessibility audits
  database/             ← Prisma, Drizzle, SQL schema maps, migration summaries
  docs/                 ← docs index, README/changelog/release notes, AGENTS sync
  security/             ← auth, permission, env, client-secret audits
  performance/          ← bundle, dependency, Next.js boundary and asset audits
  github/               ← GitHub PR/issue/action analysis
  llm/                  ← prompt linting, JSON/schema helpers, workflow validation
  next/                 ← Next.js route segments, metadata, image, API runtime audits
  testing/              ← test gaps, test draft generation, failure explanations
  data/                 ← log parsing, data profiling, CSV/JSON schema inference
  workflows/            ← workflow inventory and validation
```

---

## shared/

Internal helpers shared across domains. Not re-exported from `index.ts`.

| File            | Contents                                                                                                                                                                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tool-base.ts`  | `toolDefinition`, `emptySchema`, `pathLimitSchema`, `dryRunSchema`, `finding`, `Finding`, `TraceStep`                                                                                                                                           |
| `code-utils.ts` | `CODE_EXTENSIONS`, `TEXT_EXTENSIONS`, `UI_EXTENSIONS`, `WorkspaceFile`, `linesOf`, `readBounded`, `codeFiles`, `collectTextFiles`, `importedSpecifiers`, `exportedNames`, `componentNames`, `hookNames`, `routeFromFile`, `appRouteFromSegment` |
| `command.ts`    | `runCommand`, `runCommandUnsafe`, `safeShellArg`, `gitOutput`                                                                                                                                                                                   |
| `formatting.ts` | `truncateString`, `boundedLimit`, `previewString`                                                                                                                                                                                               |
| `patching.ts`   | `parseJsonPointer`, `applyOperation`, `applyJsonPatch`, `unifiedPatch`                                                                                                                                                                          |
| `csv.ts`        | `csvRowsToObjects`, `parseSimpleCsv`, `splitCSVLine`                                                                                                                                                                                            |
| `json.ts`       | `inferJsonSchema`, `safeJsonParse`, `getJsonPath`                                                                                                                                                                                               |
| `cloudinary.ts` | `parseCloudinaryConfig`, `uploadPdfToCloudinary`                                                                                                                                                                                                |
| `loaders.ts`    | `loadSharp`, `loadTesseract`, `loadYamlModule`                                                                                                                                                                                                  |

---

## browser/

### `browser-core.ts`

Internal Puppeteer state and low-level helpers. Not re-exported from `index.ts`.

```
browserPromise, stealthInitialized, recaptchaInitialized, adblockerPromise
isRecoverableBrowserError, resetBrowserProcess
ensureStealthPlugin, getAdblocker, ensureRecaptchaPlugin
getBrowser, withPage, withTemporaryPage
goto, screenshotArtifact, screenshotDataUrl, centerOfSelector
```

### `browser-tools.ts`

| Tool name                        | Description                                                                |
| -------------------------------- | -------------------------------------------------------------------------- |
| `browser_navigate`               | Navigate a headless browser to a URL.                                      |
| `browser_get_markdown`           | Get readable markdown from the current page.                               |
| `browser_screenshot`             | Capture a viewport screenshot of a page.                                   |
| `browser_click`                  | Click an element using a selector or coordinates.                          |
| `browser_double_click`           | Double click an element.                                                   |
| `browser_right_click`            | Right click an element.                                                    |
| `browser_hover`                  | Hover an element using a selector or coordinates.                          |
| `browser_scroll`                 | Scroll the page.                                                           |
| `browser_type`                   | Type into an input element.                                                |
| `browser_form_input_fill`        | Fill a form input.                                                         |
| `browser_form_fill_batch`        | Fill multiple form fields (best-effort).                                   |
| `browser_wait`                   | Wait for some time after loading a page (simple delay).                    |
| `browser_wait_for`               | Wait for a selector or page function to succeed, then screenshot.          |
| `browser_extract`                | Extract text or an attribute from a CSS selector.                          |
| `browser_get_text`               | Extract readable text from the page (or a selector).                       |
| `browser_get_links`              | Extract links from a page.                                                 |
| `browser_get_clickable_elements` | List clickable elements (best-effort).                                     |
| `browser_drag_and_drop`          | Drag from a source selector to a target selector.                          |
| `browser_drag`                   | Drag from source to target (alias).                                        |
| `browser_key_press`              | Press a key on the page.                                                   |
| `browser_hotkey`                 | Trigger a keyboard shortcut (best-effort).                                 |
| `browser_evaluate`               | Run JavaScript in the page and return the result.                          |
| `browser_accessibility_snapshot` | Return Puppeteer accessibility tree snapshot.                              |
| `browser_console_logs`           | Load a page and capture browser console logs.                              |
| `browser_network_log`            | Load a page and capture response status metadata.                          |
| `browser_storage_snapshot`       | Read cookie metadata and storage keys (no values).                         |
| `browser_set_viewport`           | Set viewport dimensions and capture the page.                              |
| `browser_selector_screenshot`    | Capture a screenshot of a specific page element.                           |
| `browser_full_page_screenshot`   | Capture a full-page browser screenshot.                                    |
| `browser_print_pdf`              | Print a web page to PDF artifact.                                          |
| `browser_downloads`              | Capture browser-triggered downloads as bounded artifacts.                  |
| `browser_form_schema`            | Extract forms and field metadata from a page.                              |
| `browser_table_extract`          | Extract HTML tables from a rendered page.                                  |
| `browser_control`                | Report a browser control step (lightweight visual progress step).          |
| `browser_vision_control`         | Provide a screenshot + cursor position for a visual browser step (compat). |
| `browser_action`                 | Record a browser action step (compat).                                     |

---

## workspace/

### `workspace-fs.ts`

Internal file resolution helpers. Not re-exported from `index.ts`.

```
assertNoBlockedDirectoryReference, readWorkspaceText, writeWorkspaceText
collectWorkspaceFiles, fileExists
```

### `workspace-tools.ts`

| Tool name         | Description                                                            |
| ----------------- | ---------------------------------------------------------------------- |
| `file_stat`       | Return metadata for a workspace file or directory.                     |
| `workspace_stats` | Summarize workspace file counts, sizes, extensions, and largest files. |
| `file_head_tail`  | Read only the beginning and end of a workspace text file.              |
| `file_search`     | Search within workspace files using ripgrep or grep.                   |
| `file_read`       | Read a UTF-8 text file from the workspace.                             |
| `list_files`      | List files and folders inside the workspace.                           |
| `write_file`      | Write UTF-8 content to a file within the workspace.                    |
| `execute_command` | Execute a shell command inside the workspace.                          |

### `workspace-scans.ts`

| Tool name                    | Description                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `secret_scan`                | Scan workspace text files for likely secrets without returning their values. |
| `dependency_audit`           | Run `npm audit` and return JSON vulnerability metadata.                      |
| `license_summary`            | Summarize package-lock license fields.                                       |
| `sbom_generate`              | Generate a lightweight CycloneDX-style SBOM from package-lock.               |
| `lockfile_risk_summary`      | Summarize package-lock supply-chain risk signals.                            |
| `semgrep_scan`               | Run semgrep (if installed) and return JSON findings.                         |
| `dockerfile_scan`            | Run lightweight Dockerfile safety checks.                                    |
| `workspace_permissions_scan` | Find executable and world-writable files.                                    |

---

## code/

### `code-analysis-tools.ts`

| Tool name                   | Description                                                             |
| --------------------------- | ----------------------------------------------------------------------- |
| `file_outline`              | Return imports, exports, and top-level symbols for a TS/JS file.        |
| `symbol_search`             | Search TS/JS symbols by name without reading full files.                |
| `symbol_references`         | Find textual references to a symbol in workspace files.                 |
| `dependency_graph`          | Build a bounded import dependency graph for JS/TS files.                |
| `duplicate_code_candidates` | Find exact normalized duplicate text/code files as refactor candidates. |
| `dead_code_candidates`      | Best-effort exported symbol list with few or no textual references.     |

### `code-execution-tools.ts`

| Tool name        | Description                                                          |
| ---------------- | -------------------------------------------------------------------- |
| `node_execute`   | Execute JavaScript using Node.js and return stdout/stderr.           |
| `python_execute` | Execute Python code using python3 and return stdout/stderr.          |
| `node_codeact`   | Execute Node.js code (CodeAct-style).                                |
| `python_codeact` | Execute Python code (CodeAct-style).                                 |
| `shell_codeact`  | Execute shell code (CodeAct-style).                                  |
| `shell_execute`  | Alias for `execute_command` for compatibility with Rekdin renderers. |

### `code-map-tools.ts`

| Tool name          | Description                                                                        |
| ------------------ | ---------------------------------------------------------------------------------- |
| `code_map`         | Inspect TS/JS repository structure using AST metadata without reading full source. |
| `route_map`        | Map Next.js app route files to route-like paths.                                   |
| `test_map`         | List test files and package test scripts.                                          |
| `config_inventory` | List common project configuration files.                                           |
| `env_inventory`    | List `.env` files and variable names only; never returns secret values.            |
| `lockfile_summary` | Summarize dependency lockfiles.                                                    |

---

## web/

### `web-tools.ts`

| Tool name            | Description                                               |
| -------------------- | --------------------------------------------------------- |
| `web_search`         | Search the public web for answers and recent information. |
| `visit_link`         | Fetch and summarize the readable content from a web page. |
| `search_batch`       | Run several public web searches at once.                  |
| `page_diff_snapshot` | Fetch two pages and return a markdown diff.               |

### `network-tools.ts`

| Tool name        | Description                                                           |
| ---------------- | --------------------------------------------------------------------- |
| `http_request`   | Make an HTTP request (for APIs or fetching raw content).              |
| `download_fetch` | Fetch a binary file and return base64 (max ~5 MB).                    |
| `fetch_many`     | Fetch up to 10 URLs and return compact text previews.                 |
| `domain_info`    | Resolve basic DNS information for a domain.                           |
| `dns_lookup`     | Resolve DNS records (A, AAAA, MX, TXT, CNAME, NS) for a hostname.     |
| `ssl_check`      | Check SSL/TLS certificate — issuer, subject, expiry, SANs, validity.  |
| `ping`           | Check host reachability and measure round-trip latency.               |
| `whois_lookup`   | WHOIS/RDAP data — registrar, nameservers, registration, expiry dates. |

### `metadata-tools.ts`

| Tool name             | Description                                                                       |
| --------------------- | --------------------------------------------------------------------------------- |
| `link_preview`        | Fetch lightweight metadata (title/description/image) for a URL.                   |
| `page_metadata_batch` | Fetch metadata for several pages.                                                 |
| `citation_metadata`   | Create compact citation metadata for a URL.                                       |
| `robots_txt`          | Fetch robots.txt for an origin.                                                   |
| `sitemap_fetch`       | Fetch and parse sitemap XML URLs.                                                 |
| `rss_fetch`           | Fetch and parse RSS/Atom feed items.                                              |
| `npm_package_info`    | Fetch npm package metadata (version, license, downloads).                         |
| `package_compare`     | Compare npm metadata for several packages.                                        |
| `github_repo_info`    | Fetch public GitHub repository metadata.                                          |
| `openapi_inspect`     | Parse an OpenAPI 3.x or Swagger 2.x spec (file or URL) and list endpoints by tag. |
| `graphql_introspect`  | Run the GraphQL introspection query and return types, queries, and mutations.     |

---

## pdf/

### `pdf-core.ts`

Internal PDF/HTML rendering helpers. Not re-exported from `index.ts`.

```
latexJsStylesPromise, sanitizePdfBaseName, escapeHtml
buildPrintableHtmlDocument, renderInlineMarkdown, renderMarkdownHtml
renderHtmlToPdf, persistPdfBuffer
```

### `pdf-tools.ts`

| Tool name          | Description                                                   |
| ------------------ | ------------------------------------------------------------- |
| `markdown_to_pdf`  | Convert Markdown text to PDF (via LaTeX) and return URL/data. |
| `pdf_extract_text` | Extract text from a PDF workspace file, URL, or data URL.     |

### `latex-tools.ts`

| Tool name            | Description                       |
| -------------------- | --------------------------------- |
| `generate_latex_pdf` | Generate a PDF from LaTeX source. |

---

## documents/

### `document-tools.ts`

| Tool name              | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `docx_extract_text`    | Extract plain text from a DOCX workspace file.   |
| `html_table_extract`   | Extract tables from raw HTML or a URL.           |
| `markdown_frontmatter` | Parse YAML-like frontmatter from Markdown.       |
| `token_count`          | Estimate tokenizer token count for text.         |
| `text_keywords`        | Extract keywords from text without using an LLM. |

### `data-query-tools.ts`

| Tool name      | Description                                                        |
| -------------- | ------------------------------------------------------------------ |
| `csv_preview`  | Preview rows from a CSV workspace file.                            |
| `csv_query`    | Filter and project rows from a CSV workspace file.                 |
| `json_query`   | Read a JSON file and return a simple path query result.            |
| `yaml_query`   | Read a YAML file and return a simple path query result.            |
| `sqlite_query` | Run one read-only sqlite3 query against a workspace database file. |

---

## images/

### `image-tools.ts`

| Tool name        | Description                                                                   |
| ---------------- | ----------------------------------------------------------------------------- |
| `image_info`     | Get basic image metadata (requires `sharp`).                                  |
| `image_convert`  | Convert an image to png/jpg/webp (requires `sharp`).                          |
| `image_exif`     | Read image metadata and EXIF/ICC byte presence.                               |
| `image_ocr`      | Extract text from a remote or data URL image using local OCR support.         |
| `image_diff`     | Compute a lightweight pixel difference between two images.                    |
| `svg_optimize`   | Minify SVG text without changing files.                                       |
| `asset_manifest` | List image/font/static assets in the workspace.                               |
| `image_resize`   | Resize an image (URL, data URI, or workspace path) and return as an artifact. |
| `image_crop`     | Crop an image to a specified region (left, top, width, height).               |

---

## artifacts/

### `artifact-tools.ts`

| Tool name         | Description                                |
| ----------------- | ------------------------------------------ |
| `artifact_list`   | List stored Rekdin artifacts.              |
| `artifact_read`   | Read a stored artifact by URL or filename. |
| `artifact_delete` | Delete a stored Rekdin artifact.           |

---

## git/

### `git-tools.ts`

| Tool name           | Description                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------- |
| `git_log_summary`   | Show recent git commits (oneline).                                                           |
| `git_branches`      | List local and remote git branches.                                                          |
| `git_diff_summary`  | Show git status and diff for the working directory.                                          |
| `git_blame`         | Show who last modified each line of a file (`git blame`).                                    |
| `git_file_history`  | Show the commit history for a file, following renames (`git log --follow`).                  |
| `git_status`        | Show compact git branch and working tree status.                                             |
| `git_changed_files` | List changed files with porcelain status codes.                                              |
| `git_staged_diff`   | Show staged git diff, optionally scoped to a file.                                           |
| `git_show`          | Show a git ref/commit with stat and patch.                                                   |
| `git_compare_refs`  | Compare two git refs with stat and patch.                                                    |
| `git_conflicts`     | List files with unresolved git merge conflicts.                                              |
| `git_tags`          | List recent git tags.                                                                        |
| `git_remote_info`   | Show git remotes and branch tracking info.                                                   |
| `git_commit_search` | Search git commit messages.                                                                  |
| `git_patch_preview` | Create a unified diff preview for replacing one workspace file.                              |
| `git_apply_patch`   | Apply or validate a unified patch with `git apply`. Mutates files when `checkOnly` is false. |
| `git_commit`        | Stage files and create a git commit.                                                         |
| `git_checkout`      | Switch to an existing branch or create a new one (`create: true`).                           |
| `git_stash`         | Stash or restore changes: push, pop, list, or drop.                                          |
| `git_push`          | Push the current branch to a remote. Uses `--force-with-lease` when `force` is true.         |

---

## sessions/

### `session-tools.ts`

| Tool name         | Description                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| `session_list`    | List recent Rekdin sessions with compact metadata, prompt previews, token totals, and tool-call counts. |
| `session_inspect` | Inspect one session with message previews, metadata, attachments, and final-answer preview.             |
| `replay_summary`  | Summarize one replay into event counts, duration, tool timeline, failed tools, and slowest steps.       |
| `replay_search`   | Search one replay by event type, tool name, status, or text query.                                      |

### `trace-tools.ts`

| Tool name                 | Description                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `trace_summary`           | Summarize runtime traces for one session — provider/model, duration, tools, token estimates, retries, warnings. |
| `token_usage_report`      | Aggregate token metadata across recent sessions or one session without dumping message bodies.                  |
| `background_jobs_summary` | List background jobs globally or by session — status, workflow, timestamps, error preview.                      |

### `settings-tools.ts`

| Tool name          | Description                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| `settings_summary` | Return redacted Rekdin settings: provider/model presence, workspace root, uploads, workflows, feature flags. |

---

## dev/

### `dev-server-tools.ts`

| Tool name           | Description                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------- |
| `dev_server_start`  | Start a package.json dev server in the background.                                          |
| `dev_server_stop`   | Stop Rekdin-started dev servers.                                                            |
| `dev_server_status` | List Rekdin-started dev servers.                                                            |
| `port_probe`        | Probe a local HTTP port.                                                                    |
| `http_health_check` | Check a URL and return status/latency metadata.                                             |
| `process_list`      | List running processes with optional name/command filter. Returns PID, CPU%, MEM%, command. |
| `system_info`       | Return CPU, memory, disk usage, uptime, platform, and Node.js version.                      |
| `clipboard_read`    | Read text from the system clipboard (macOS `pbpaste` / Linux `xclip`).                      |
| `clipboard_write`   | Write text to the system clipboard (macOS `pbcopy` / Linux `xclip`).                        |
| `desktop_notify`    | Send a desktop notification (macOS `osascript` / Linux `notify-send`).                      |

### `package-tools.ts`

| Tool name        | Description                                 |
| ---------------- | ------------------------------------------- |
| `npm_scripts`    | List package.json scripts.                  |
| `run_npm_script` | Run a package.json script in the workspace. |

---

## utilities/

### `text-tools.ts`

| Tool name        | Description                                                                            |
| ---------------- | -------------------------------------------------------------------------------------- |
| `text_summarize` | Lightweight extractive summarization (first ~120 words).                               |
| `text_rewrite`   | Simple rewrite to bullets (deterministic).                                             |
| `text_entities`  | Extract URLs, emails, and capitalized phrase entities from text.                       |
| `extract_todos`  | Extract TODO/FIXME/HACK-style comments from a workspace file or directory (recursive). |

### `encoding-tools.ts`

| Tool name       | Description                 |
| --------------- | --------------------------- |
| `base64_encode` | Base64-encode text.         |
| `base64_decode` | Decode base64-encoded text. |

### `crypto-tools.ts`

| Tool name       | Description                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------- |
| `hash`          | Compute a hash (md5/sha1/sha256/sha512) for inline text or a workspace file.                |
| `uuid_generate` | Generate one or more v4 UUIDs.                                                              |
| `jwt_decode`    | Decode a JWT token — return header, payload, and expiry info. Never verifies the signature. |

### `patching-tools.ts`

| Tool name      | Description                                                           |
| -------------- | --------------------------------------------------------------------- |
| `file_replace` | Find-and-replace text in a workspace file.                            |
| `json_patch`   | Apply RFC-6902 JSON Patch operations to a JSON file.                  |
| `yaml_patch`   | Apply JSON Patch operations to a YAML file (requires `yaml` package). |

### `archive-tools.ts`

| Tool name         | Description                                                               |
| ----------------- | ------------------------------------------------------------------------- |
| `archive_create`  | Create a zip archive from workspace files/folders (returned as data URL). |
| `archive_extract` | Extract a zip archive (data/base64) into the workspace.                   |

### `misc-tools.ts`

| Tool name       | Description                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| `regex_match`   | Test a regex pattern against text and return all matches, capture groups, and indices.                |
| `url_parse`     | Parse a URL into protocol, host, path, query parameters, and hash.                                    |
| `cron_explain`  | Describe a 5- or 6-field cron expression in plain English, field by field.                            |
| `color_convert` | Convert a color between hex, rgb, and hsl formats.                                                    |
| `text_diff`     | Compute a unified diff between two strings or two workspace file paths.                               |
| `json_diff`     | Semantic diff between two JSON values (inline or file paths). Returns unified diff of formatted JSON. |

### `validation-tools.ts`

| Tool name              | Description                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| `json_schema_validate` | Validate a JSON value against a JSON Schema (draft-7 subset). Supply inline data or a file path. |
| `url_safety_check`     | Check URL syntax and simple safety signals.                                                      |
| `csv_to_json`          | Convert CSV text or a workspace file to a JSON array of objects.                                 |
| `json_to_csv`          | Convert a JSON array of objects to CSV text.                                                     |
| `xml_to_json`          | Convert XML text or a workspace file to a JSON representation.                                   |
| `xpath_query`          | Run an XPath expression against HTML/XML text or a workspace file.                               |

---

## api/

### `api-contract-tools.ts`

| Tool name            | Description                                             |
| -------------------- | ------------------------------------------------------- |
| `api_contract_map`   | Map frontend API calls to Next.js backend route files.  |
| `api_route_map`      | Map all Next.js API routes from the app directory.      |
| `api_payload_infer`  | Infer request/response shape from route handler source. |
| `api_contract_diff`  | Diff two versions of an API contract.                   |
| `api_curl_examples`  | Generate curl examples for API routes.                  |
| `api_postman_export` | Generate a Postman collection from routes.              |

---

## agent/

### `agent-tools.ts`

| Tool name               | Description                                                  |
| ----------------------- | ------------------------------------------------------------ |
| `agent_plan_create`     | Create a structured implementation plan from a user request. |
| `agent_worklog`         | Log an agent work step with file, action, and detail.        |
| `agent_self_check`      | Validate agent output against a checklist.                   |
| `agent_diff_review`     | Review a patch diff for risk, coverage, and missing steps.   |
| `agent_regression_risk` | Estimate regression risk from changed files.                 |

---

## ui/

### `ui-audit-tools.ts`

| Tool name              | Description                                                         |
| ---------------------- | ------------------------------------------------------------------- |
| `tailwind_class_audit` | Find Tailwind anti-patterns such as arbitrary values and conflicts. |
| `design_token_audit`   | Audit CSS/Tailwind for hardcoded values vs design tokens.           |
| `responsive_audit`     | Find components missing responsive breakpoint classes.              |
| `accessibility_audit`  | Scan JSX for a11y issues: missing alt, role, aria, label.           |
| `shadcn_usage_audit`   | Map shadcn/ui component usage across the codebase.                  |
| `icon_audit`           | Audit icon library usage for consistency.                           |

---

## database/

### `database-tools.ts`

| Tool name                | Description                                                   |
| ------------------------ | ------------------------------------------------------------- |
| `prisma_schema_inspect`  | Inspect Prisma schema models, fields, relations, and indexes. |
| `drizzle_schema_inspect` | Inspect Drizzle schema tables and columns.                    |
| `sql_schema_map`         | Map SQL migration files to schema evolution.                  |
| `migration_summary`      | Summarize database migration history.                         |
| `db_erd_text`            | Generate a text-based ERD from schema inspection.             |

---

## docs/

### `docs-tools.ts`

| Tool name                   | Description                                                          |
| --------------------------- | -------------------------------------------------------------------- |
| `docs_index`                | Index project docs, README, AGENTS files, package scripts.           |
| `docs_missing_report`       | Find missing docs for public APIs, tools, env variables, scripts.    |
| `readme_generate_or_update` | Generate/update README sections from actual repo structure.          |
| `agents_md_sync`            | Check whether AGENTS.md is synced with exported tools and renderers. |
| `changelog_generate`        | Generate changelog markdown from recent git commits.                 |
| `release_notes_generate`    | Generate user-facing release notes from commits and diff.            |

---

## security/

### `security-tools.ts`

| Tool name                    | Description                                                       |
| ---------------------------- | ----------------------------------------------------------------- |
| `auth_flow_audit`            | Scan code for auth/session usage and missing checks.              |
| `permission_audit`           | Audit role/permission checks in route handlers and middleware.    |
| `command_injection_audit`    | Scan for unsafe shell/exec calls with interpolated input.         |
| `dependency_confusion_audit` | Check for dependency confusion risk in package.json.              |
| `env_usage_audit`            | Map env variable usage and find undefined or unused variables.    |
| `client_secret_audit`        | Find secrets or tokens that may be exposed to the browser bundle. |

---

## performance/

### `performance-tools.ts`

| Tool name                 | Description                                                            |
| ------------------------- | ---------------------------------------------------------------------- |
| `bundle_analyze_summary`  | Summarize Next.js build output artifacts when available.               |
| `large_dependency_report` | Find heavy dependencies and where they are imported.                   |
| `client_boundary_audit`   | Find use client files that import server-only code or large libraries. |
| `render_risk_audit`       | Find React performance risks in render paths.                          |
| `asset_size_audit`        | Find oversized images/fonts/static files.                              |

### `next-tools.ts` (also under `next/`)

| Tool name                    | Description                                                              |
| ---------------------------- | ------------------------------------------------------------------------ |
| `next_route_segment_map`     | Map Next.js App Router segments including layouts, pages, handlers.      |
| `server_client_boundary_map` | Map server/client components and likely illegal imports.                 |
| `next_metadata_audit`        | Check metadata exports, title, description, OpenGraph, and robots files. |
| `next_image_audit`           | Find raw img usage where next/image may be better.                       |
| `next_api_runtime_audit`     | Check route handlers for runtime, dynamic usage, and cache headers.      |

---

## github/

### `github-tools.ts`

| Tool name                     | Description                                          |
| ----------------------------- | ---------------------------------------------------- |
| `github_pr_summary`           | Fetch and summarize a GitHub pull request.           |
| `github_issue_list`           | List open issues for a GitHub repository.            |
| `github_actions_status`       | Fetch recent workflow run status.                    |
| `github_pr_description_draft` | Draft a PR description from git diff and commit log. |
| `github_branch_cleanup`       | List merged branches that may be safe to delete.     |

---

## llm/

### `llm-tools.ts`

| Tool name            | Description                                                            |
| -------------------- | ---------------------------------------------------------------------- |
| `prompt_lint`        | Check prompts for ambiguity, conflicting constraints, unsafe patterns. |
| `json_schema_infer`  | Infer a JSON Schema from a sample JSON value.                          |
| `llm_eval_draft`     | Draft an evaluation harness for an LLM task.                           |
| `workflow_inventory` | List Rekdin workflows and settings.                                    |
| `workflow_validate`  | Validate a workflow preset definition.                                 |

---

## next/

See **performance/** above for the `next-tools.ts` table.

---

## testing/

### `testing-tools.ts`

| Tool name               | Description                                                    |
| ----------------------- | -------------------------------------------------------------- |
| `test_gap_analysis`     | Compare source files vs test files and identify missing tests. |
| `test_draft_generate`   | Generate a test stub for a source file.                        |
| `test_failure_explain`  | Explain a test failure from error output and source context.   |
| `snapshot_diff_explain` | Explain a snapshot diff in plain English.                      |

---

## data/

### `data-tools.ts`

| Tool name                | Description                                                          |
| ------------------------ | -------------------------------------------------------------------- |
| `log_parse`              | Parse logs and group by error type.                                  |
| `data_profile`           | Profile a CSV or JSON file: row count, column types, nulls, samples. |
| `json_schema_infer_file` | Infer JSON Schema from a workspace JSON file.                        |

---

## workflows/

### `workflow-tools.ts`

| Tool name            | Description                            |
| -------------------- | -------------------------------------- |
| `workflow_inventory` | List Rekdin workflows and settings.    |
| `workflow_validate`  | Validate a workflow preset definition. |

---

## artifacts/ (extended)

### `artifact-extended-tools.ts`

| Tool name          | Description                                                |
| ------------------ | ---------------------------------------------------------- |
| `artifact_preview` | Return preview metadata for an artifact or workspace file. |
| `artifact_convert` | Convert an artifact to a different format.                 |

---

## dev/ (extended)

### `dev-extended-tools.ts`

| Tool name              | Description                                               |
| ---------------------- | --------------------------------------------------------- |
| `todo_to_issues`       | Convert TODO/FIXME comments into structured issue drafts. |
| `env_example_generate` | Generate a `.env.example` from env usage in the codebase. |
| `setup_health_check`   | Run setup validation checks against the workspace.        |
| `onboarding_summary`   | Summarize the project for a new developer.                |

---

## Adding or changing a tool

Follow the steps in `src/lib/server/AGENTS.md` ("Add a tool" recipe). In summary:

1. Add the tool constant to the correct domain file.
2. Update `src/lib/server/runtime/tool-policy.ts` if it needs mode/policy gating.
3. Update `requiresToolApproval()` in `tool-policy.ts` if it is approval-gated.
4. Add or update a renderer in `src/components/tools/renderers/` if generic JSON is insufficient.
5. Update this file with the new tool name and description.
