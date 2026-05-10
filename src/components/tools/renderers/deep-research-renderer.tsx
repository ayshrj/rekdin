"use client"

import React, { useState } from "react"

import {
  ArrowTopRightOnSquare as ExternalLink,
  ArrowTrendingUp,
  BookOpen,
  Clock,
  FileText,
  Link,
  Search,
} from "@/lib/icons"

import {
  CopyButton,
  EmptyState,
  RawPayloadDisclosure,
  RendererTab,
  RendererTabBar,
  ToolRendererShell,
} from "./renderer-primitives"
import { ToolResultContentPart } from "./tool-result-renderer"

export const DeepResearchRenderer: React.FC<{
  part: ToolResultContentPart
  onAction?: (action: string, data: unknown) => void
}> = ({ part }) => {
  const [activeTab, setActiveTab] = useState<"summary" | "sources" | "insights">("summary")

  const toolResult = part.toolResult || {}
  const summary =
    toolResult.summary || toolResult.report || toolResult.content || toolResult.text || ""
  const sources = Array.isArray(toolResult.sources) ? toolResult.sources : []
  const insights = Array.isArray(toolResult.insights) ? toolResult.insights : []
  const fallbackJson = JSON.stringify(toolResult, null, 2)

  const tabs = [
    { id: "summary" as const, label: "Summary", icon: FileText, count: null },
    { id: "sources" as const, label: "Sources", icon: Link, count: sources.length },
    { id: "insights" as const, label: "Insights", icon: ArrowTrendingUp, count: insights.length },
  ]

  return (
    <ToolRendererShell
      header={
        <>
          <Search className="text-tool-research h-3.5 w-3.5 shrink-0" />
          <span className="text-foreground min-w-0 flex-1 truncate font-mono text-[11px] font-semibold">
            {part.toolName || "Deep Research"}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {sources.length > 0 && (
              <span className="rk-meta-chip">
                {sources.length}&nbsp;source{sources.length !== 1 ? "s" : ""}
              </span>
            )}
            {toolResult.duration && (
              <span className="text-muted-foreground font-mono text-[10px]">
                {(toolResult.duration / 1000).toFixed(1)}s
              </span>
            )}
            <CopyButton text={summary || fallbackJson} />
          </div>
        </>
      }
      footer={<RawPayloadDisclosure payload={part.toolResult} />}
    >
      <RendererTabBar>
        {tabs.map((tab) => (
          <RendererTab
            key={tab.id}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon className="h-3 w-3" />
            {tab.label}
            {tab.count !== null && tab.count > 0 && (
              <span className="rk-meta-chip ml-1">{tab.count}</span>
            )}
          </RendererTab>
        ))}
      </RendererTabBar>

      <div className="rk-scrollbar max-h-[60vh] overflow-auto">
        {/* Summary */}
        {activeTab === "summary" &&
          (summary ? (
            <p className="text-foreground/80 px-3 py-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
              {summary}
            </p>
          ) : (
            <pre className="text-foreground/70 px-3 py-3 font-mono text-[10px] leading-relaxed whitespace-pre-wrap">
              {fallbackJson}
            </pre>
          ))}

        {/* Sources */}
        {activeTab === "sources" &&
          (sources.length ? (
            <div className="divide-y">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {sources.map((source: any, i: number) => {
                let domain = source.url
                try {
                  domain = new URL(source.url).hostname
                } catch {
                  /* ignore */
                }
                return (
                  <div
                    key={i}
                    className="hover:bg-surface-4 px-3 py-2.5 transition-colors duration-100"
                  >
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-tool-research mb-1 block font-mono text-[11px] leading-snug font-semibold hover:underline"
                    >
                      {source.title || source.url}
                      <ExternalLink className="ml-1 inline h-2.5 w-2.5 align-[-1px] opacity-50" />
                    </a>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rk-meta-chip">{domain}</span>
                      {source.publishedDate && (
                        <span className="text-muted-foreground/60 flex items-center gap-1 font-mono text-[10px]">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(source.publishedDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {source.snippet && (
                      <p className="text-muted-foreground font-mono text-[11px] leading-relaxed">
                        {source.snippet}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState>No sources</EmptyState>
          ))}

        {/* Insights */}
        {activeTab === "insights" &&
          (insights.length ? (
            <div className="divide-y">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {insights.map((insight: any, i: number) => (
                <div key={i} className="flex items-start gap-2.5 px-3 py-2.5">
                  <BookOpen className="text-tool-research mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-foreground font-mono text-[11px] font-semibold">
                      {insight.title || `Insight ${i + 1}`}
                    </p>
                    <p className="text-muted-foreground mt-0.5 font-mono text-[11px] leading-relaxed">
                      {insight.content || insight.text || String(insight)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>No insights</EmptyState>
          ))}
      </div>
    </ToolRendererShell>
  )
}
