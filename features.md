# Rekdin Feature Inventory

This file lists the features currently implemented in Rekdin, based on the codebase as it exists today.

It is intended to be:

- a product feature inventory
- a developer-facing capability map
- a reference for planning, QA, docs, and future prioritization

It is not a roadmap. Planned or partially implemented ideas should stay in [dev.md](/Users/ayushraj/Development/rekdin/dev.md).

## 1. Product Shell

- Three-panel workspace layout:
  - Sessions sidebar
  - Main chat panel
  - Workspace panel
- Resizable panel layout for sessions, chat, and workspace surfaces.
- Light/dark theme support.
- Provider connection badge in the header.
- Local settings modal for provider and upload configuration.

Key files:

- [src/app/page.tsx](/Users/ayushraj/Development/rekdin/src/app/page.tsx)
- [src/components/session-sidebar.tsx](/Users/ayushraj/Development/rekdin/src/components/session-sidebar.tsx)
- [src/components/chat/chat-panel.tsx](/Users/ayushraj/Development/rekdin/src/components/chat/chat-panel.tsx)
- [src/components/workspace-panel.tsx](/Users/ayushraj/Development/rekdin/src/components/workspace-panel.tsx)

## 2. Chat and Agent Runtime

- Server-owned chat execution through `/api/chat`.
- Typed SSE event stream (`ack`, `status`, `assistant_delta`, `assistant_final`, `tool_started`, `tool_finished`, `warning`, `error`, `heartbeat`, `done`).
- Agent modes:
  - `general`
  - `research`
  - `browser`
  - `workspace`
  - `document`
- Tool policy profiles:
  - `read_only`
  - `balanced`
  - `full_auto`
- Prompt builder with mode-aware runtime behavior.
- Provider-aware runtime execution.
- Structured warning propagation from the server to the client.
- Turn tracing with retry counts, tool counts, provider/model info, and success/error state.

Key files:

- [src/app/api/chat/route.ts](/Users/ayushraj/Development/rekdin/src/app/api/chat/route.ts)
- [src/lib/server/chat-agent.ts](/Users/ayushraj/Development/rekdin/src/lib/server/chat-agent.ts)
- [src/lib/server/runtime/agent-runtime.ts](/Users/ayushraj/Development/rekdin/src/lib/server/runtime/agent-runtime.ts)
- [src/lib/server/runtime/prompt-builder.ts](/Users/ayushraj/Development/rekdin/src/lib/server/runtime/prompt-builder.ts)
- [src/lib/server/runtime/events.ts](/Users/ayushraj/Development/rekdin/src/lib/server/runtime/events.ts)
- [src/types/runtime.ts](/Users/ayushraj/Development/rekdin/src/types/runtime.ts)

## 3. LLM Provider Support

- OpenRouter support.
- OpenAI support.
- Azure OpenAI support.
- Server-owned provider settings persistence.
- Provider credential normalization and validation.
- Provider selection reflected in UI and runtime behavior.

Key files:

- [src/lib/server/settings-store.ts](/Users/ayushraj/Development/rekdin/src/lib/server/settings-store.ts)
- [src/app/api/settings/route.ts](/Users/ayushraj/Development/rekdin/src/app/api/settings/route.ts)
- [src/components/openrouter-settings.tsx](/Users/ayushraj/Development/rekdin/src/components/openrouter-settings.tsx)

## 4. Session Management

- Persistent server-side sessions.
- Session create/load/update/delete flows.
- Session title updates.
- Session search.
- Session search over message content, not only titles.
- Current-session restoration through server settings.
- Session export bundles with replay, traces, and artifacts.

Key files:

- [src/lib/server/session-store.ts](/Users/ayushraj/Development/rekdin/src/lib/server/session-store.ts)
- [src/app/api/sessions/route.ts](/Users/ayushraj/Development/rekdin/src/app/api/sessions/route.ts)
- [src/app/api/sessions/[sessionId]/route.ts](/Users/ayushraj/Development/rekdin/src/app/api/sessions/[sessionId]/route.ts)
- [src/app/api/sessions/[sessionId]/export/route.ts](/Users/ayushraj/Development/rekdin/src/app/api/sessions/[sessionId]/export/route.ts)

## 5. Persistence Model

- Server-first persistence for:
  - settings
  - sessions
  - replay logs
  - traces
  - artifacts
  - background jobs
- Local data directory organization under the Rekdin workspace/data model.
- IndexedDB still exists as a transitional client-side cache layer.

Key files:

- [src/lib/server/workspace.ts](/Users/ayushraj/Development/rekdin/src/lib/server/workspace.ts)
- [src/lib/server/json-store.ts](/Users/ayushraj/Development/rekdin/src/lib/server/json-store.ts)
- [src/lib/client/idb.ts](/Users/ayushraj/Development/rekdin/src/lib/client/idb.ts)

## 6. Workflow Presets

- Built-in workflow presets:
  - `Research Plan`
  - `Research Report`
  - `Browse & Extract`
  - `Workspace Edit`
  - `Repo Audit`
  - `Diff Review`
  - `Generate Document`
- Workflow presets can set:
  - mode
  - prompt framing
  - optional response schema
  - category
  - background support

Key files:

- [src/lib/workflows.ts](/Users/ayushraj/Development/rekdin/src/lib/workflows.ts)
- [src/components/chat/chat-panel.tsx](/Users/ayushraj/Development/rekdin/src/components/chat/chat-panel.tsx)

## 7. Structured Output and Validation

- Optional response schema support on chat turns.
- Structured-output validation.
- Retry behavior for invalid structured output.
- Structured workflow rendering for JSON-shaped results.

Key files:

- [src/lib/server/runtime/structured-output.ts](/Users/ayushraj/Development/rekdin/src/lib/server/runtime/structured-output.ts)
- [src/lib/workflows.ts](/Users/ayushraj/Development/rekdin/src/lib/workflows.ts)
- [src/components/tools/renderers/json-result-renderer.tsx](/Users/ayushraj/Development/rekdin/src/components/tools/renderers/json-result-renderer.tsx)

## 8. Verification Before Completion

- Runtime verification layer for side effects before claiming completion.
- Verification-oriented behavior for:
  - document generation
  - workspace/file edits
  - browser tasks
  - generated outputs and artifacts

Key files:

- [src/lib/server/runtime/verification.ts](/Users/ayushraj/Development/rekdin/src/lib/server/runtime/verification.ts)
- [src/lib/server/runtime/agent-runtime.ts](/Users/ayushraj/Development/rekdin/src/lib/server/runtime/agent-runtime.ts)

## 9. Research Features

- Research mode in the runtime.
- Structured `research_plan` outputs.
- Structured `research_report` outputs.
- Deep research renderer for plan/report style content.
- Search, visit, and evidence-gathering tool support.
- Citation/source-shaped schema support in research workflows.

Key files:

- [src/lib/workflows.ts](/Users/ayushraj/Development/rekdin/src/lib/workflows.ts)
- [src/components/tools/renderers/deep-research-renderer.tsx](/Users/ayushraj/Development/rekdin/src/components/tools/renderers/deep-research-renderer.tsx)
- [src/lib/server/tools.ts](/Users/ayushraj/Development/rekdin/src/lib/server/tools.ts)

## 10. Browser Automation Features

- Session-aware browser runtime.
- Shared browser page reuse across a chat session.
- Browser navigation.
- Page markdown extraction.
- Screenshots.
- Click.
- Double click.
- Right click.
- Hover.
- Scroll.
- Typing.
- Single field fill.
- Batch form fill.
- Wait.
- Wait for selector/text/state.
- DOM extraction.
- Text extraction.
- Link extraction.
- Clickable element discovery.
- Drag and drop.
- Drag movement.
- Key press.
- Hotkey execution.
- Arbitrary page evaluation.
- Browser control tools.
- Vision/browser control tools.

Key files:

- [src/lib/server/browser-session-manager.ts](/Users/ayushraj/Development/rekdin/src/lib/server/browser-session-manager.ts)
- [src/lib/server/tools.ts](/Users/ayushraj/Development/rekdin/src/lib/server/tools.ts)
- [src/components/tools/renderers/browser-result-renderer.tsx](/Users/ayushraj/Development/rekdin/src/components/tools/renderers/browser-result-renderer.tsx)
- [src/components/tools/renderers/browser-control-renderer.tsx](/Users/ayushraj/Development/rekdin/src/components/tools/renderers/browser-control-renderer.tsx)

## 11. Workspace and File Features

- Workspace-rooted file access.
- File read.
- File listing.
- File search.
- File write.
- File replace.
- JSON patch application.
- YAML patch application.
- TODO extraction.
- Text summarization.
- Text rewriting.
- Base64 encode/decode helpers.
- Hash generation.
- Archive creation.
- Archive extraction.

Key files:

- [src/lib/server/tools.ts](/Users/ayushraj/Development/rekdin/src/lib/server/tools.ts)
- [src/lib/server/workspace.ts](/Users/ayushraj/Development/rekdin/src/lib/server/workspace.ts)

## 12. Code and Command Features

- Shell command execution.
- General command execution tool.
- Node execution.
- Python execution.
- Node code-act tool.
- Python code-act tool.
- Shell code-act tool.
- Git log summary.
- Git branch listing.
- Git diff summary.
- Repo-audit workflow.
- Diff-review workflow.

Key files:

- [src/lib/server/tools.ts](/Users/ayushraj/Development/rekdin/src/lib/server/tools.ts)
- [src/lib/workflows.ts](/Users/ayushraj/Development/rekdin/src/lib/workflows.ts)

## 13. Document and PDF Features

- Markdown-to-PDF generation.
- LaTeX-to-PDF generation.
- Deployment-safe PDF fallback path.
- Browser-rendered PDF generation using Puppeteer.
- `latex.js`-based preview fallback for LaTeX when TeX is unavailable.
- Last-resort readable source-preview fallback if LaTeX preview rendering fails.
- PDF artifact storage and download/open flows.
- PDF inline preview in the UI.
- TeX generation endpoint support.

Key files:

- [src/lib/server/tools.ts](/Users/ayushraj/Development/rekdin/src/lib/server/tools.ts)
- [src/app/api/pdf/route.ts](/Users/ayushraj/Development/rekdin/src/app/api/pdf/route.ts)
- [src/app/api/tex/route.ts](/Users/ayushraj/Development/rekdin/src/app/api/tex/route.ts)
- [src/components/tools/renderers/pdf-renderer.tsx](/Users/ayushraj/Development/rekdin/src/components/tools/renderers/pdf-renderer.tsx)

## 14. Image and Media Features

- Image metadata inspection.
- Image format conversion.
- Link preview extraction.
- File/image uploads.
- Local upload fallback when Cloudinary is not configured.
- Cloudinary upload integration.
- Cloudinary delete endpoint support.

Key files:

- [src/lib/server/tools.ts](/Users/ayushraj/Development/rekdin/src/lib/server/tools.ts)
- [src/app/api/upload/route.ts](/Users/ayushraj/Development/rekdin/src/app/api/upload/route.ts)
- [src/app/api/uploads/[filename]/route.ts](/Users/ayushraj/Development/rekdin/src/app/api/uploads/[filename]/route.ts)
- [src/app/api/cloudinary/delete/route.ts](/Users/ayushraj/Development/rekdin/src/app/api/cloudinary/delete/route.ts)

## 15. Web and External Data Features

- Web search tool.
- Direct URL visit tool.
- Generic HTTP request tool.
- Download/fetch helper.
- npm package info lookup.
- Link preview metadata lookup.

Key files:

- [src/lib/server/tools.ts](/Users/ayushraj/Development/rekdin/src/lib/server/tools.ts)

## 16. Artifacts

- Local artifact store.
- Stable artifact URLs.
- Artifact types:
  - image
  - pdf
  - archive
  - file
  - json
  - text
- Artifact display in the workspace panel.
- Artifact inclusion in session exports.

Key files:

- [src/lib/server/artifact-store.ts](/Users/ayushraj/Development/rekdin/src/lib/server/artifact-store.ts)
- [src/app/api/artifacts/[filename]/route.ts](/Users/ayushraj/Development/rekdin/src/app/api/artifacts/[filename]/route.ts)
- [src/components/workspace-panel.tsx](/Users/ayushraj/Development/rekdin/src/components/workspace-panel.tsx)

## 17. Replay, Activity, and Diagnostics

- Persistent replay event recording.
- Replay export as HTML-backed session data.
- User-facing activity timeline in the workspace panel.
- Diagnostics mode for raw replay/traces.
- Trace persistence with:
  - mode
  - provider/model
  - warnings
  - retries
  - tool counts
  - success/error state
- Replay/traces included in export bundles.

Key files:

- [src/lib/server/replay-store.ts](/Users/ayushraj/Development/rekdin/src/lib/server/replay-store.ts)
- [src/lib/server/trace-store.ts](/Users/ayushraj/Development/rekdin/src/lib/server/trace-store.ts)
- [src/app/api/replay/[sessionId]/route.ts](/Users/ayushraj/Development/rekdin/src/app/api/replay/[sessionId]/route.ts)
- [src/app/api/traces/[sessionId]/route.ts](/Users/ayushraj/Development/rekdin/src/app/api/traces/[sessionId]/route.ts)
- [src/components/workspace-panel.tsx](/Users/ayushraj/Development/rekdin/src/components/workspace-panel.tsx)

## 18. Background Jobs

- Queueable background workflows.
- Background job persistence.
- Background job status tracking:
  - queued
  - running
  - completed
  - failed
- Background jobs can write into sessions, replay logs, and traces.
- Workflow presets can declare background support.

Key files:

- [src/lib/server/background-job-store.ts](/Users/ayushraj/Development/rekdin/src/lib/server/background-job-store.ts)
- [src/lib/server/background-job-runner.ts](/Users/ayushraj/Development/rekdin/src/lib/server/background-job-runner.ts)
- [src/app/api/background/route.ts](/Users/ayushraj/Development/rekdin/src/app/api/background/route.ts)
- [src/app/api/background/[jobId]/route.ts](/Users/ayushraj/Development/rekdin/src/app/api/background/[jobId]/route.ts)

## 19. Workspace Panel Features

- Timeline view.
- Artifacts view.
- Replay view.
- Diagnostics toggle inside replay.
- JSON tree rendering for replay/traces/results.
- Activity summaries that are safer and higher-level than raw internal logs.

Key files:

- [src/components/workspace-panel.tsx](/Users/ayushraj/Development/rekdin/src/components/workspace-panel.tsx)
- [src/components/json-tree-viewer.tsx](/Users/ayushraj/Development/rekdin/src/components/json-tree-viewer.tsx)

## 20. Result Renderers and Content Presentation

- Dedicated renderer mapping by tool/result type.
- Browser-specific renderers.
- Research/plan/report renderers.
- PDF renderer.
- JSON renderer with:
  - raw view
  - tree view
- Shared JSON tree viewer reused across tool output and replay/diagnostics.
- Markdown preview for browser markdown results.
- Raw/preview toggle for browser markdown-style outputs.

Key files:

- [src/components/tools/renderers/tool-result-renderer.tsx](/Users/ayushraj/Development/rekdin/src/components/tools/renderers/tool-result-renderer.tsx)
- [src/components/tools/renderers/browser-result-renderer.tsx](/Users/ayushraj/Development/rekdin/src/components/tools/renderers/browser-result-renderer.tsx)
- [src/components/tools/renderers/json-result-renderer.tsx](/Users/ayushraj/Development/rekdin/src/components/tools/renderers/json-result-renderer.tsx)
- [src/components/json-tree-viewer.tsx](/Users/ayushraj/Development/rekdin/src/components/json-tree-viewer.tsx)
- [src/components/markdown.tsx](/Users/ayushraj/Development/rekdin/src/components/markdown.tsx)

## 21. API Surface

- `/api/chat`
- `/api/settings`
- `/api/sessions`
- `/api/sessions/[sessionId]`
- `/api/sessions/[sessionId]/export`
- `/api/replay/[sessionId]`
- `/api/traces/[sessionId]`
- `/api/background`
- `/api/background/[jobId]`
- `/api/artifacts/[filename]`
- `/api/upload`
- `/api/uploads/[filename]`
- `/api/pdf`
- `/api/tex`
- `/api/title`
- `/api/openrouter/models`
- `/api/cloudinary/delete`
- `/api/workspace/*` related workspace support routes

Note:

- Some routes live in nested dynamic directories that are easier to inspect via `find src/app/api`.

## 22. Settings and Configuration UX

- Server-persisted settings modal.
- Provider switching.
- OpenRouter model selection support.
- OpenAI model entry.
- Azure OpenAI endpoint/version/deployment support.
- Cloudinary settings support.
- Settings export.
- Settings import.
- Settings clear/reset.

Key files:

- [src/components/openrouter-settings.tsx](/Users/ayushraj/Development/rekdin/src/components/openrouter-settings.tsx)
- [src/app/api/settings/route.ts](/Users/ayushraj/Development/rekdin/src/app/api/settings/route.ts)

## 23. Export Features

- Session export bundle generation.
- Replay HTML inclusion in export bundles.
- Artifact inclusion in export bundles.
- Trace inclusion in export bundles.

Key files:

- [src/lib/server/session-export.ts](/Users/ayushraj/Development/rekdin/src/lib/server/session-export.ts)
- [src/app/api/sessions/[sessionId]/export/route.ts](/Users/ayushraj/Development/rekdin/src/app/api/sessions/[sessionId]/export/route.ts)

## 24. Testing and Validation Coverage

- Vitest-based test suite.
- Runtime helper coverage for:
  - settings normalization
  - prompt builder behavior
  - tool policy behavior
- Ongoing validation tracked in [dev.md](/Users/ayushraj/Development/rekdin/dev.md).

Key files:

- [vitest.config.ts](/Users/ayushraj/Development/rekdin/vitest.config.ts)
- [src/lib/server/settings-store.test.ts](/Users/ayushraj/Development/rekdin/src/lib/server/settings-store.test.ts)
- [src/lib/server/runtime/prompt-builder.test.ts](/Users/ayushraj/Development/rekdin/src/lib/server/runtime/prompt-builder.test.ts)
- [src/lib/server/runtime/tool-policy.test.ts](/Users/ayushraj/Development/rekdin/src/lib/server/runtime/tool-policy.test.ts)

## 25. Known Notes About Feature Quality

- IndexedDB still exists as a transitional client cache, so persistence is server-first but not fully server-only.
- LaTeX PDF output has two quality levels:
  - ideal: real TeX engine installed
  - safe fallback: `latex.js` preview rendered to PDF
- Replay is intentionally split into:
  - user-facing activity timeline
  - optional diagnostics view
- Some advanced capabilities are broad tool surfaces rather than fully productized workflows.

## 26. Suggested Future Use Of This File

This file can be used as the source for:

- README feature section
- docs site capability matrix
- QA checklist generation
- pricing/packaging ideas if Rekdin ever becomes a hosted product
- roadmap diffing against [dev.md](/Users/ayushraj/Development/rekdin/dev.md)
