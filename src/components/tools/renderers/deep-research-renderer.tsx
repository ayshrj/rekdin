"use client"

import React, { useState } from "react"

import { Image } from "@/components/ui/image"
import {
  ArrowTopRightOnSquare as ExternalLink,
  ArrowTrendingUp,
  BarChart,
  BookOpen,
  Check,
  CheckCircle,
  ClipboardDocumentList as Copy,
  Clock,
  FileText,
  Globe,
  Link,
  Photo,
  PlayCircle,
  Search,
  Target,
} from "@/lib/icons"

import { ToolResultContentPart } from "./tool-result-renderer"

interface DeepResearchRendererProps {
  part: ToolResultContentPart
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAction?: (action: string, data: any) => void
}

// This is a direct port of Rekdin's deep research renderer. It expects a fairly rich
// structured payload; when used with simpler payloads it will gracefully fall back to JSON.
export const DeepResearchRenderer: React.FC<DeepResearchRendererProps> = ({ part }) => {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<"summary" | "sources" | "insights">("summary")

  const toolResult = part.toolResult || {}
  const summary =
    toolResult.summary || toolResult.report || toolResult.content || toolResult.text || ""
  const sources = Array.isArray(toolResult.sources) ? toolResult.sources : []
  const insights = Array.isArray(toolResult.insights) ? toolResult.insights : []
  const plan = toolResult.plan || toolResult.researchPlan
  const analysis = toolResult.analysis || toolResult.metrics
  const images = Array.isArray(toolResult.images) ? toolResult.images : []

  const fallbackJson = JSON.stringify(toolResult, null, 2)

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(summary || fallbackJson)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const tabs = [
    { id: "summary", label: "Summary", icon: FileText },
    { id: "sources", label: `Sources (${sources.length})`, icon: Link },
    { id: "insights", label: `Insights (${insights.length})`, icon: ArrowTrendingUp },
  ] as const

  return (
    <div className="space-y-4">
      <div className="border-border bg-card overflow-hidden rounded-xl border shadow-sm">
        <div className="border-border flex items-center justify-between border-b p-4">
          <div className="flex items-center space-x-3">
            <div className="bg-tool-research/10 flex h-8 w-8 items-center justify-center rounded-lg">
              <Search className="text-tool-research" size={16} />
            </div>
            <div>
              <h3 className="text-foreground text-sm font-semibold">Deep Research</h3>
              <p className="text-muted-foreground text-xs">{part.toolName || "research"}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={copyReport}
              className="border-border bg-muted text-foreground hover:bg-muted/80 rounded-lg border p-2 transition-colors"
              title="Copy report"
            >
              {copied ? <Check size={16} className="text-tool-research" /> : <Copy size={16} />}
            </button>
            {part.status ? (
              <div
                className={`flex items-center space-x-1 rounded-md px-2 py-1 text-xs font-medium ${
                  part.status === "success"
                    ? "bg-tool-research/10 text-tool-research"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <CheckCircle size={12} />
                <span className="capitalize">{part.status}</span>
              </div>
            ) : null}
          </div>
        </div>

        {(analysis || plan || images.length > 0) && (
          <div className="border-border bg-muted/40 grid grid-cols-1 gap-4 border-b p-4 md:grid-cols-3">
            <div className="space-y-1">
              <div className="text-muted-foreground flex items-center text-xs font-medium">
                <Target className="mr-2" size={14} />
                Coverage
              </div>
              <div className="text-foreground text-sm">
                {analysis?.coverage
                  ? `${analysis.coverage}%`
                  : sources.length
                    ? `${sources.length} sources`
                    : "—"}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground flex items-center text-xs font-medium">
                <Clock className="mr-2" size={14} />
                Duration
              </div>
              <div className="text-foreground text-sm">
                {toolResult.duration ? `${(toolResult.duration / 1000).toFixed(1)}s` : "—"}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground flex items-center text-xs font-medium">
                <BarChart className="mr-2" size={14} />
                Assets
              </div>
              <div className="text-foreground text-sm">
                {images.length ? `${images.length} images` : "—"}
              </div>
            </div>
          </div>
        )}

        <div className="border-border border-b">
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "border-tool-research text-tool-research"
                    : "text-muted-foreground hover:text-foreground border-transparent"
                }`}
              >
                <tab.icon size={14} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {activeTab === "summary" ? (
            summary ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap">{summary}</div>
              </div>
            ) : (
              <pre className="border-border bg-muted/40 rounded-lg border p-3 text-xs whitespace-pre-wrap">
                {fallbackJson}
              </pre>
            )
          ) : null}

          {activeTab === "sources" ? (
            sources.length ? (
              <div className="space-y-3">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {sources.map((source: any, index: number) => (
                  <div
                    key={index}
                    className="border-border hover:bg-muted/40 rounded-lg border p-4 transition-colors"
                  >
                    <div className="space-y-2">
                      <div className="flex min-w-0 items-start gap-2">
                        <h3 className="min-w-0 text-base leading-tight font-medium wrap-anywhere">
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-tool-research hover:text-tool-research/80 inline hover:underline"
                          >
                            {source.title || source.url}
                            <ExternalLink size={12} className="ml-1 inline shrink-0 align-[-1px]" />
                          </a>
                        </h3>
                      </div>

                      <div className="text-muted-foreground flex items-center gap-2 text-xs">
                        <span className="bg-muted rounded px-2 py-1 font-mono">
                          {(() => {
                            try {
                              return new URL(source.url).hostname
                            } catch {
                              return source.url
                            }
                          })()}
                        </span>
                        {source.publishedDate ? (
                          <>
                            <Clock size={12} />
                            <span>{new Date(source.publishedDate).toLocaleDateString()}</span>
                          </>
                        ) : null}
                      </div>

                      {source.snippet ? (
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          {source.snippet}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">No sources available</div>
            )
          ) : null}

          {activeTab === "insights" ? (
            insights.length ? (
              <div className="space-y-3">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {insights.map((insight: any, index: number) => (
                  <div key={index} className="border-border rounded-lg border p-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-tool-research/10 mt-1 rounded-lg p-2">
                        <BookOpen className="text-tool-research" size={14} />
                      </div>
                      <div className="flex-1">
                        <div className="text-foreground text-sm font-medium">
                          {insight.title || `Insight ${index + 1}`}
                        </div>
                        <div className="text-muted-foreground mt-1 text-sm">
                          {insight.content || insight.text || String(insight)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">No insights available</div>
            )
          ) : null}
        </div>

        {images.length ? (
          <div className="border-border border-t p-4">
            <div className="text-foreground mb-3 flex items-center text-sm font-medium">
              <Photo className="mr-2" size={14} />
              Images
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {images.map((image: any, index: number) => (
                <div key={index} className="border-border overflow-hidden rounded-lg border">
                  <Image
                    src={image.url}
                    alt={image.alt || `Image ${index + 1}`}
                    className="h-auto w-full"
                  />
                  <div className="border-border text-muted-foreground border-t p-3 text-xs">
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Globe size={12} className="shrink-0" />
                        <span className="min-w-0 truncate">{image.source || image.url}</span>
                      </div>
                      <a
                        href={image.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-tool-research hover:underline"
                      >
                        Open
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {plan ? (
          <div className="border-border border-t p-4">
            <div className="text-foreground mb-3 flex items-center text-sm font-medium">
              <PlayCircle className="mr-2" size={14} />
              Plan
            </div>
            <pre className="border-border bg-muted/40 rounded-lg border p-3 text-xs whitespace-pre-wrap">
              {JSON.stringify(plan, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  )
}
