import { ReplayEvent, SessionReplayData } from "@/types/chat"

import { readJsonFile, withFileWriteLock, writeJsonFileAtomic } from "./json-store"
import { ensureWorkspaceDirs, getReplayFilePath } from "./workspace"

type EventType = ReplayEvent["type"]

class ReplayStore {
  private cache = new Map<string, ReplayEvent[]>()

  private async loadSessionEvents(sessionId: string) {
    const cached = this.cache.get(sessionId)
    if (cached) return cached
    await ensureWorkspaceDirs()
    const events = await readJsonFile<ReplayEvent[]>(getReplayFilePath(sessionId), [])
    this.cache.set(sessionId, events)
    return events
  }

  async record(sessionId: string, type: EventType, data: Record<string, unknown>) {
    const filePath = getReplayFilePath(sessionId)
    return withFileWriteLock(filePath, async () => {
      const existing = [...(await this.loadSessionEvents(sessionId))]
      const event: ReplayEvent = {
        id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        sessionId,
        type,
        data,
        timestamp: Date.now(),
      }
      const next = [...existing, event]
      await writeJsonFileAtomic(filePath, next)
      this.cache.set(sessionId, next)
      return event
    })
  }

  async getReplay(sessionId: string): Promise<SessionReplayData | null> {
    const events = await this.loadSessionEvents(sessionId)
    if (events.length === 0) return null
    const start = events[0]!.timestamp
    const end = events[events.length - 1]!.timestamp
    const totalMessages = events.filter(
      (event) => event.type === "user_message" || event.type === "assistant_message"
    ).length
    const totalToolCalls = events.filter((event) => event.type === "tool_call").length
    return {
      sessionId,
      startTime: start,
      endTime: end,
      events,
      metadata: {
        totalMessages,
        totalToolCalls,
      },
    }
  }

  async deleteReplay(sessionId: string) {
    this.cache.delete(sessionId)
    await writeJsonFileAtomic(getReplayFilePath(sessionId), [])
  }
}

declare global {
  var __REPLAY_STORE: ReplayStore | undefined
}

export function getReplayStore() {
  if (!globalThis.__REPLAY_STORE) {
    globalThis.__REPLAY_STORE = new ReplayStore()
  }
  return globalThis.__REPLAY_STORE
}

export function renderReplayHtml(data: SessionReplayData) {
  // ── helpers ──────────────────────────────────────────────────────────────
  function esc(s: string) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  }
  function attr(s: string) {
    // safe for use inside double-quoted HTML attribute values
    return esc(s).replace(/\n/g, "&#10;").replace(/\r/g, "&#13;")
  }
  function json(v: unknown) {
    return esc(JSON.stringify(v, null, 2))
  }
  function ts(ms: number) {
    return new Date(ms).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  function looksLikeMarkdown(s: string): boolean {
    if (s.length < 80) return false
    return (
      /\n\n/.test(s) ||
      /^#{1,4} /m.test(s) ||
      /\*\*/.test(s) ||
      /```/.test(s) ||
      /\[.+\]\(https?:/.test(s) ||
      /^[-*] /m.test(s) ||
      /^> /m.test(s)
    )
  }

  function extractMarkdownContent(result: unknown): string | null {
    if (typeof result === "string") return looksLikeMarkdown(result) ? result : null
    if (!result || typeof result !== "object") return null
    const obj = result as Record<string, unknown>
    for (const key of [
      "content",
      "text",
      "markdown",
      "pageContent",
      "rawContent",
      "body",
      "summary",
      "description",
    ]) {
      const val = obj[key]
      if (typeof val === "string" && looksLikeMarkdown(val)) return val
    }
    // collect text snippets from array result fields (e.g. web_search results)
    for (const key of ["results", "items", "findings", "sources"]) {
      const val = obj[key]
      if (!Array.isArray(val)) continue
      const parts: string[] = []
      for (const item of val) {
        if (!item || typeof item !== "object") continue
        const r = item as Record<string, unknown>
        for (const k of ["content", "text", "snippet", "description"]) {
          if (typeof r[k] === "string" && (r[k] as string).length > 40) {
            parts.push(r[k] as string)
            break
          }
        }
      }
      if (parts.length > 0) {
        const combined = parts.join("\n\n---\n\n")
        if (combined.length > 100) return combined
      }
    }
    return null
  }

  // ── event rendering ───────────────────────────────────────────────────────
  const events = data.events
  const blocks: string[] = []

  for (let i = 0; i < events.length; i++) {
    const ev = events[i]!
    const d = ev.data as Record<string, unknown>

    if (ev.type === "user_message") {
      const msg = (d.message ?? {}) as Record<string, unknown>
      const content = typeof msg.content === "string" ? msg.content : JSON.stringify(d)
      blocks.push(`
<div class="bubble bubble-user">
  <div class="role-row"><span class="dot dot-user"></span><span class="role-name">You</span><span class="tstamp">${ts(ev.timestamp)}</span></div>
  <div class="prose md" data-md="${attr(content)}"></div>
</div>`)
      continue
    }

    if (ev.type === "assistant_message") {
      if (typeof d.warning === "string") {
        blocks.push(`
<div class="bubble bubble-warn">
  <div class="role-row"><span class="dot dot-warn"></span><span class="role-name">Warning</span><span class="tstamp">${ts(ev.timestamp)}</span></div>
  <div class="prose">${esc(d.warning)}</div>
</div>`)
        continue
      }
      if (typeof d.error === "string") {
        blocks.push(`
<div class="bubble bubble-error">
  <div class="role-row"><span class="dot dot-error"></span><span class="role-name">Error</span><span class="tstamp">${ts(ev.timestamp)}</span></div>
  <div class="prose">${esc(d.error)}</div>
</div>`)
        continue
      }
      const msg = (d.message ?? {}) as Record<string, unknown>
      const content = typeof msg.content === "string" ? msg.content : ""
      if (content) {
        blocks.push(`
<div class="bubble bubble-assistant">
  <div class="role-row"><span class="dot dot-assistant"></span><span class="role-name">Rekdin</span><span class="tstamp">${ts(ev.timestamp)}</span></div>
  <div class="prose md" data-md="${attr(content)}"></div>
</div>`)
      }
      continue
    }

    if (ev.type === "tool_call") {
      const tc = (d.toolCall ?? {}) as Record<string, unknown>
      const toolName = typeof tc.name === "string" ? tc.name : "tool"
      const toolArgs = tc.arguments ?? {}

      // look-ahead: consume matching tool_result
      let statusCls = "status-running"
      let statusLabel = "running"
      let resultBlock = ""
      if (i + 1 < events.length && events[i + 1]!.type === "tool_result") {
        i++
        const rd = (events[i]!.data ?? {}) as Record<string, unknown>
        const rtc = (rd.toolCall ?? {}) as Record<string, unknown>
        const status = typeof rtc.status === "string" ? rtc.status : "success"
        statusCls = status === "error" ? "status-error" : "status-success"
        statusLabel = status
        const result = rtc.result ?? rd.result ?? rd
        const mdContent = extractMarkdownContent(result)
        const mdToggle = mdContent
          ? `<div class="md-toggle-row"><button class="md-btn" onclick="toggleMd(this)">Show Markdown</button></div><div class="md-panel" hidden><div class="prose md" data-md="${attr(mdContent)}"></div></div>`
          : ""
        resultBlock = `<div class="tool-section">Result</div><pre class="code-block">${json(result)}</pre>${mdToggle}`
      }

      blocks.push(`
<details class="tool-card">
  <summary class="tool-summary">
    <div class="tool-left">
      <span class="dot dot-tool"></span>
      <span class="tool-label">Tool</span>
      <code class="tool-name">${esc(toolName)}</code>
    </div>
    <span class="tool-status ${statusCls}">${statusLabel}</span>
  </summary>
  <div class="tool-body">
    <div class="tool-section">Input</div>
    <pre class="code-block">${json(toolArgs)}</pre>
    ${resultBlock}
  </div>
</details>`)
      continue
    }
    // standalone tool_result (shouldn't normally appear, skip)
  }

  const exportedAt = ts(Date.now())

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Rekdin Export · ${esc(data.sessionId)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<style>
:root{
  --bg:#09090b;--surface:#18181b;--border:#27272a;--muted:#71717a;
  --text:#fafafa;--text2:#a1a1aa;
  --primary:#6366f1;--primary-dim:rgba(99,102,241,.12);--primary-ring:rgba(99,102,241,.25);
  --green:#10b981;--green-dim:rgba(16,185,129,.1);
  --amber:#f59e0b;--amber-dim:rgba(245,158,11,.08);--amber-ring:rgba(245,158,11,.2);
  --red:#ef4444;--red-dim:rgba(239,68,68,.1);
  --warn:#f97316;--warn-dim:rgba(249,115,22,.08);
  --radius:14px;
  --font:'Inter',system-ui,sans-serif;
  --mono:'JetBrains Mono','Fira Code',monospace;
}
*{box-sizing:border-box;margin:0;padding:0}
html{font-size:15px}
body{font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.6;padding:40px 16px 80px}
a{color:#818cf8;text-decoration:none}
a:hover{text-decoration:underline}

/* layout */
.container{max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:0}

/* header */
.hd{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:40px;padding-bottom:24px;border-bottom:1px solid var(--border)}
.hd-logo{font-size:18px;font-weight:700;letter-spacing:-.01em}
.hd-logo .dot{color:var(--primary)}
.hd-meta{font-size:12px;color:var(--muted);margin-top:4px}
.pills{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.pill{background:var(--surface);border:1px solid var(--border);border-radius:999px;padding:3px 11px;font-size:12px;color:var(--text2)}
.pill strong{color:var(--text)}

/* timeline */
.timeline{display:flex;flex-direction:column;gap:12px}

/* bubbles */
.bubble{border-radius:var(--radius);padding:16px 20px}
.bubble-user{background:var(--primary-dim);border:1px solid var(--primary-ring)}
.bubble-assistant{background:var(--surface);border:1px solid var(--border)}
.bubble-warn{background:var(--warn-dim);border:1px solid rgba(249,115,22,.25)}
.bubble-error{background:var(--red-dim);border:1px solid rgba(239,68,68,.25)}

.role-row{display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em}
.role-name{color:var(--text2)}
.tstamp{margin-left:auto;color:var(--muted);font-weight:400;text-transform:none;letter-spacing:0;font-size:11px}

.dot{display:inline-block;width:7px;height:7px;border-radius:50%;flex-shrink:0}
.dot-user{background:var(--primary)}
.dot-assistant{background:var(--green)}
.dot-tool{background:var(--amber)}
.dot-warn{background:var(--warn)}
.dot-error{background:var(--red)}

/* prose / markdown */
.prose{font-size:14px;line-height:1.75;color:var(--text2)}
.prose h1,.prose h2,.prose h3,.prose h4{color:var(--text);font-weight:600;line-height:1.3;margin:18px 0 8px}
.prose h1{font-size:20px}.prose h2{font-size:17px}.prose h3{font-size:15px}.prose h4{font-size:14px}
.prose p{margin:8px 0}
.prose ul,.prose ol{padding-left:22px;margin:8px 0}
.prose li{margin:4px 0}
.prose strong{color:var(--text);font-weight:600}
.prose em{color:var(--text2)}
.prose code{font-family:var(--mono);font-size:12px;background:rgba(0,0,0,.35);border:1px solid var(--border);padding:1px 6px;border-radius:5px;color:#e879f9}
.prose pre{background:#000;border:1px solid var(--border);border-radius:10px;padding:14px 16px;overflow-x:auto;margin:12px 0}
.prose pre code{background:none;border:none;padding:0;color:#e2e8f0;font-size:13px}
.prose blockquote{border-left:3px solid var(--primary);padding-left:14px;color:var(--muted);margin:10px 0;font-style:italic}
.prose table{width:100%;border-collapse:collapse;font-size:13px;margin:12px 0}
.prose th,.prose td{border:1px solid var(--border);padding:8px 12px;text-align:left}
.prose th{background:rgba(255,255,255,.04);font-weight:600;color:var(--text)}
.prose hr{border:none;border-top:1px solid var(--border);margin:18px 0}
.prose a{color:#818cf8}

/* tool card */
.tool-card{border:1px solid var(--amber-ring);border-radius:var(--radius);overflow:hidden;background:var(--amber-dim)}
.tool-summary{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:12px 16px;cursor:pointer;list-style:none;user-select:none;
  font-size:13px;
}
.tool-summary::-webkit-details-marker{display:none}
.tool-summary::marker{font-size:0}
.tool-summary::after{
  content:"▾";font-size:14px;color:var(--muted);flex-shrink:0;
  display:inline-flex;align-items:center;line-height:1;
  transition:transform .2s ease;
}
details[open]>.tool-summary::after{transform:rotate(-180deg)}
.tool-summary:hover{background:rgba(245,158,11,.12)}
.tool-left{display:flex;align-items:center;gap:8px}
.tool-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--amber)}
.tool-name{font-family:var(--mono);font-size:12px;font-weight:500;color:var(--text);background:rgba(0,0,0,.3);padding:2px 8px;border-radius:6px}
.tool-status{font-size:11px;font-weight:600;padding:2px 10px;border-radius:999px}
.status-success{background:rgba(16,185,129,.15);color:#34d399}
.status-error{background:rgba(239,68,68,.15);color:#f87171}
.status-running{background:rgba(99,102,241,.15);color:#818cf8}
.tool-body{padding:12px 16px;border-top:1px solid var(--amber-ring);display:flex;flex-direction:column;gap:10px}
.tool-section{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}

/* code block */
.code-block{
  background:#000;border:1px solid var(--border);border-radius:10px;
  padding:12px 16px;font-family:var(--mono);font-size:12px;line-height:1.6;
  overflow-x:auto;color:#e2e8f0;white-space:pre-wrap;word-break:break-word;
  max-height:360px;overflow-y:auto;
}

/* footer */
.ft{margin-top:56px;padding-top:20px;border-top:1px solid var(--border);display:flex;justify-content:space-between;font-size:12px;color:var(--muted)}

/* markdown toggle */
.md-toggle-row{margin-top:8px}
.md-btn{
  font-family:var(--font);font-size:12px;font-weight:500;cursor:pointer;
  background:var(--primary-dim);border:1px solid var(--primary-ring);
  color:#818cf8;border-radius:8px;padding:5px 14px;transition:background .15s;
}
.md-btn:hover{background:rgba(99,102,241,.2)}
.md-panel{margin-top:10px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 16px}

/* scrollbar */
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:999px}
</style>
</head>
<body>
<div class="container">
  <header class="hd">
    <div>
      <div class="hd-logo">Rekdin<span class="dot"> ·</span> Session Export</div>
      <div class="hd-meta">Session: ${esc(data.sessionId)}</div>
    </div>
    <div class="pills">
      <div class="pill"><strong>${data.metadata.totalMessages}</strong> messages</div>
      <div class="pill"><strong>${data.metadata.totalToolCalls}</strong> tool calls</div>
      <div class="pill"><strong>${data.events.length}</strong> events</div>
    </div>
  </header>

  <div class="timeline">
    ${blocks.join("\n")}
  </div>

  <footer class="ft">
    <span>Generated by Rekdin</span>
    <span>${exportedAt}</span>
  </footer>
</div>

<script src="https://cdn.jsdelivr.net/npm/marked@12/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/dompurify@3/dist/purify.min.js"></script>
<script>
marked.use({ breaks: true, gfm: true });

function renderMd(el) {
  var raw = el.getAttribute('data-md') || '';
  el.innerHTML = typeof DOMPurify !== 'undefined'
    ? DOMPurify.sanitize(marked.parse(raw))
    : marked.parse(raw);
}

// auto-render chat bubbles; skip lazy .md-panel elements
document.querySelectorAll('.md[data-md]').forEach(function(el) {
  if (!el.closest('.md-panel')) renderMd(el);
});

function toggleMd(btn) {
  var panel = btn.closest('.md-toggle-row').nextElementSibling;
  var hiding = !panel.hidden;
  panel.hidden = hiding;
  btn.textContent = hiding ? 'Show Markdown' : 'Hide Markdown';
  if (!hiding && !btn.dataset.rendered) {
    btn.dataset.rendered = '1';
    panel.querySelectorAll('.md[data-md]').forEach(renderMd);
  }
}
</script>
</body>
</html>`
}
