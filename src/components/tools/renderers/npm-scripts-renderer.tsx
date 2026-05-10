"use client"

import { useState } from "react"

import {
  CopyButton,
  EmptyState,
  ExitCodeBadge,
  RawPayloadDisclosure,
  RendererTab,
  RendererTabBar,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { SimpleCodeEditor } from "./simple-code-editor"
import { type ToolResultContentPart } from "./tool-result-renderer"

// ── npm_scripts ────────────────────────────────────────────────────────────────

interface NpmScript {
  name: string
  command: string
}

function normalizeScripts(raw: unknown): NpmScript[] {
  // Object form: { "build": "next build", "dev": "next dev" }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([, v]) => typeof v === "string")
      .map(([name, command]) => ({ name, command: command as string }))
  }
  // Array form: [{ name, command }]
  if (Array.isArray(raw)) {
    return raw
      .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
      .map((r) => ({
        name: String(r.name ?? r.script ?? r.key ?? ""),
        command: String(r.command ?? r.run ?? r.value ?? ""),
      }))
  }
  return []
}

// ── Main renderer ─────────────────────────────────────────────────────────────

export function NpmScriptsRenderer({ part }: { part: ToolResultContentPart }) {
  const type = part.type
  const result = part.toolResult as Record<string, unknown> | undefined
  const [tab, setTab] = useState<"stdout" | "stderr">("stdout")

  // ── run_npm_script ─────────────────────────────────────────────────────────
  if (type === "run_npm_script") {
    const input = part.toolInput as Record<string, unknown> | undefined
    const scriptName = (result?.script ??
      result?.name ??
      input?.script ??
      input?.name ??
      "") as string
    const exitCode =
      typeof result?.exitCode === "number"
        ? result.exitCode
        : typeof result?.code === "number"
          ? result.code
          : null
    const stdout = (result?.stdout ?? result?.output ?? "") as string
    const stderr = (result?.stderr ?? result?.error ?? "") as string
    const duration = typeof result?.duration === "number" ? result.duration : null
    const success = exitCode === 0 || (exitCode == null && !stderr)

    return (
      <ToolRendererShell
        header={
          <>
            <span className="text-foreground font-mono text-[11px] font-semibold">Run Script</span>
            {scriptName && (
              <span className="text-primary rounded border border-[color-mix(in_srgb,var(--primary)_25%,transparent)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] px-1.5 py-0.5 font-mono text-[10px]">
                {scriptName}
              </span>
            )}
            <ToolStatusBadge variant={success ? "success" : "error"}>
              {success ? "success" : "failed"}
            </ToolStatusBadge>
            {exitCode != null && <ExitCodeBadge code={exitCode} />}
            {duration != null && (
              <span className="text-muted-foreground font-mono text-[10px]">{duration}ms</span>
            )}
            {stdout && <CopyButton text={stdout} className="ml-auto" />}
          </>
        }
        footer={<RawPayloadDisclosure payload={result} />}
      >
        {!stdout && !stderr ? (
          <EmptyState>{success ? "Script completed" : "Script failed"}</EmptyState>
        ) : (
          <>
            <RendererTabBar>
              <RendererTab active={tab === "stdout"} onClick={() => setTab("stdout")}>
                stdout {stdout ? `(${stdout.split("\n").length}L)` : ""}
              </RendererTab>
              {stderr && (
                <RendererTab active={tab === "stderr"} onClick={() => setTab("stderr")}>
                  stderr
                </RendererTab>
              )}
            </RendererTabBar>
            {tab === "stdout" &&
              (stdout ? (
                <SimpleCodeEditor
                  code={stdout}
                  language="text"
                  fileName="stdout"
                  showHeader={false}
                  maxHeight="40vh"
                  fontSize={11}
                />
              ) : (
                <EmptyState>No stdout</EmptyState>
              ))}
            {tab === "stderr" &&
              (stderr ? (
                <pre className="rk-scrollbar text-destructive max-h-[40vh] overflow-auto px-3 py-3 font-mono text-[10px] leading-relaxed whitespace-pre-wrap">
                  {stderr}
                </pre>
              ) : (
                <EmptyState>No stderr</EmptyState>
              ))}
          </>
        )}
      </ToolRendererShell>
    )
  }

  // ── npm_scripts (default) ──────────────────────────────────────────────────
  const rawScripts = result?.scripts ?? result?.data ?? result
  const scripts = normalizeScripts(rawScripts)
  const packageName = (result?.name ?? result?.packageName ?? "") as string

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">npm scripts</span>
          {packageName && (
            <span className="rk-path-chip max-w-40 min-w-0 truncate">{packageName}</span>
          )}
          <ToolStatusBadge variant="neutral">
            {scripts.length} script{scripts.length !== 1 ? "s" : ""}
          </ToolStatusBadge>
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {scripts.length === 0 ? (
        <EmptyState>No scripts</EmptyState>
      ) : (
        <div className="rk-scrollbar max-h-[40vh] divide-y overflow-auto">
          {scripts.map((s, i) => (
            <div key={i} className="group hover:bg-surface-4 flex items-center gap-2.5 px-3 py-1.5">
              <span className="text-foreground/80 w-28 shrink-0 truncate font-mono text-[11px] font-semibold">
                {s.name}
              </span>
              <span className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-[10px]">
                {s.command}
              </span>
              <CopyButton
                text={s.command}
                className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
              />
            </div>
          ))}
        </div>
      )}
    </ToolRendererShell>
  )
}
