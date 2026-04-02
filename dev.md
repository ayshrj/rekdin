# Rekdin Transformation Tracker

This file is the master implementation tracker for the ongoing Rekdin upgrade. Tasks are checked only after code lands and validation notes are updated.

## Phase 1

- [x] `P1-01` Create `dev.md` as the master tracker.
      Done when: this file exists, phases are listed, and validation/deferred sections are present.
- [x] `P1-02` Move provider and integration settings to a server-owned `/api/settings` flow.
      Done when: browser localStorage is no longer the source of truth for secrets and chat/upload routes use server settings.
- [x] `P1-03` Make sessions and replays durable on the server.
      Done when: session CRUD and replay export/read work from local server persistence.
- [x] `P1-04` Stabilize the typed chat runtime and SSE v2 event contract.
      Done when: `/api/chat` emits versioned status, tool, delta, warning, heartbeat, and done events consumed by the client.
- [x] `P1-05` Add baseline prompt modes and tool-policy filtering.
      Done when: `general`, `research`, `browser`, `workspace`, and `document` drive prompt behavior and allowed tools.
- [x] `P1-06` Add initial runtime tests and verification commands.
      Done when: typecheck, lint, and a Vitest suite cover runtime helpers.

## Phase 2

- [x] `P2-01` Implement a local artifact store for generated files and large binary outputs.
      Done when: PDFs, screenshots, converted images, and archives can be persisted as local artifacts with stable URLs.
- [x] `P2-02` Refactor browser tools to use a session-aware browser runtime.
      Done when: browser navigation and follow-up actions reuse the same page/session for a chat session.
- [x] `P2-03` Add structured-output validation and retry.
      Done when: chat turns can request a response schema and receive validated JSON or a surfaced validation failure.
- [x] `P2-04` Add verification-before-complete rules.
      Done when: document/workspace/browser side effects are checked before the assistant reports completion.
- [x] `P2-05` Add workflow presets for key use cases.
      Done when: the UI offers preset research/browser/workspace/document flows that set mode and output expectations.
- [x] `P2-06` Improve the workspace panel into tabs for timeline, artifacts, and replay.
      Done when: users can inspect tool steps, produced artifacts, and session replay data without leaving the page.
- [x] `P2-07` Add workspace memory support beyond the hidden prompt file.
      Done when: users can see or use a workspace instruction entry point and the runtime loads it consistently.

## Phase 3

- [x] `P3-01` Add research-plan and research-report workflow support.
      Done when: research mode can produce structured plans/reports with citations and deterministic renderable output.
- [x] `P3-02` Add richer repo/code workflows.
      Done when: preset repo analysis / review / diff explanation flows exist on top of current tools.
- [x] `P3-03` Add observability and diagnostics traces.
      Done when: turn metadata, tool timing, warnings, retries, and model info are persisted for inspection/export.
- [x] `P3-04` Add background or resumable long-running tasks.
      Done when: a long workflow can continue independently and surface progress later.
- [x] `P3-05` Improve session search and export bundles.
      Done when: session search includes message content and sessions can be exported with artifacts/replay data.

## Validation

- [x] Initial foundation validation:
  - `npm run typecheck`
  - `npm run lint`
  - `npm test`
- [ ] Validate artifact persistence and rendering in the UI.
- [ ] Validate browser session continuity across multi-step actions.
- [x] Validate structured-output success and failure flows.
- [ ] Validate workflow preset behavior in the chat UI.
- [ ] Validate replay/artifact/workspace tabs manually.
- [x] Phase 3 code validation:
  - `npm run typecheck`
  - `npm run lint`
  - `npm test`
- [x] Validate deployment-safe PDF generation fallback:
  - `markdown_to_pdf` now renders through the built-in browser PDF path.
  - `generate_latex_pdf` uses a real TeX engine when available and falls back to a `latex.js`-rendered preview PDF when unavailable or compilation fails.

## Deferred / Follow-up

- Background jobs should wait until the browser/session runtime and artifact model are stable.
- Rich research pipelines should build on structured output rather than bespoke string parsing.
- A full IndexedDB retirement can happen after the server-first UX is fully stable.
- Add browser-level/manual QA for queued background jobs, export buttons, and structured workflow rendering.
- The fallback LaTeX PDF is intentionally not the ideal fully typeset result; when no TeX engine is available, show a `latex.js`-rendered preview PDF with a clear explanation instead of hard-failing.
