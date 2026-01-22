"use client"

import { motion } from "framer-motion"
import React, { useState } from "react"

import { Image } from "@/components/ui/image"
import { Check, ClipboardDocumentList as Copy, XMark } from "@/lib/icons"
import { ArrowDownTray, Eye } from "@/lib/icons"

import { BrowserShell } from "../browser-shell"
import { SimpleCodeEditor } from "../simple-code-editor"
import { ToolResultContentPart } from "../tool-result-renderer"

interface DataExtractionRendererProps {
  part: ToolResultContentPart
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAction?: (action: string, data: any) => void
}

export const DataExtractionRenderer: React.FC<DataExtractionRendererProps> = ({ part }) => {
  const { toolResult, toolInput } = part
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<"data" | "raw">("data")

  const screenshot = toolResult?.screenshot || toolInput?.screenshot
  const status = toolResult?.status || "success"
  const selector = toolInput?.selector || toolInput?.element || ""
  const extractedData =
    toolResult?.extractedData || toolResult?.data || toolResult?.text || toolResult?.content
  const extractionType = toolInput?.type || "text"

  const copyData = () => {
    const dataToCopy =
      typeof extractedData === "string" ? extractedData : JSON.stringify(extractedData, null, 2)
    navigator.clipboard.writeText(dataToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const renderExtractedData = () => {
    if (!extractedData) return null

    if (typeof extractedData === "string") {
      return (
        <div className="space-y-2">
          <div className="border-tool-data/20 bg-tool-data/5 rounded-lg border p-4">
            <div className="text-foreground text-sm whitespace-pre-wrap">{extractedData}</div>
          </div>
        </div>
      )
    }

    if (Array.isArray(extractedData)) {
      return (
        <div className="space-y-3">
          <div className="text-foreground text-sm font-medium">
            Extracted {extractedData.length} items:
          </div>
          <div className="max-h-60 space-y-2 overflow-y-auto">
            {extractedData.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="border-tool-data/20 bg-tool-data/5 rounded-lg border p-3"
              >
                <div className="text-foreground text-sm">
                  {typeof item === "string" ? item : JSON.stringify(item, null, 2)}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )
    }

    return (
      <div className="border-border bg-muted/40 overflow-hidden rounded-lg border">
        <SimpleCodeEditor
          code={JSON.stringify(extractedData, null, 2)}
          language="json"
          fileName="extracted-data.json"
          showLineNumbers
          maxHeight="300px"
          readOnly
          fontSize={12}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {screenshot ? (
        <BrowserShell>
          <Image
            src={screenshot}
            alt="Data extraction screenshot"
            className="h-auto w-full object-contain"
          />
        </BrowserShell>
      ) : null}

      <div className="border-tool-data/20 bg-card overflow-hidden rounded-xl border shadow-sm">
        <div className="border-tool-data/20 bg-tool-data/10 flex items-center border-b px-4 py-3">
          <ArrowDownTray className="text-tool-data mr-2.5" size={18} />
          <div className="text-foreground font-medium">Data Extraction</div>
          <div className="ml-auto flex items-center space-x-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={copyData}
              className="bg-tool-data/10 text-tool-data hover:bg-tool-data/20 rounded-lg p-1.5 transition-colors"
              title="Copy extracted data"
              type="button"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </motion.button>
            <div
              className={`flex items-center space-x-2 ${status === "success" ? "text-tool-data" : "text-destructive"}`}
            >
              {status === "success" ? <Check size={16} /> : <XMark size={16} />}
              <span className="text-xs font-medium capitalize">{status}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {selector ? (
              <div>
                <div className="text-foreground mb-1 text-sm font-medium">Target Selector</div>
                <div className="border-tool-data/20 bg-tool-data/5 overflow-x-auto rounded-md border p-2 font-mono text-xs">
                  {selector}
                </div>
              </div>
            ) : null}

            <div>
              <div className="text-foreground mb-1 text-sm font-medium">Extraction Type</div>
              <div className="border-tool-data/20 bg-tool-data/5 rounded-lg border px-3 py-2">
                <span className="text-foreground text-sm font-medium capitalize">
                  {extractionType}
                </span>
              </div>
            </div>
          </div>

          {extractedData ? (
            <div>
              <div className="border-tool-data/20 mb-4 flex border-b">
                <button
                  type="button"
                  onClick={() => setActiveTab("data")}
                  className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === "data"
                      ? "border-tool-data text-tool-data"
                      : "text-muted-foreground hover:text-foreground border-transparent"
                  }`}
                >
                  <Eye className="mr-2 inline" size={14} />
                  Extracted Data
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("raw")}
                  className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === "raw"
                      ? "border-tool-data text-tool-data"
                      : "text-muted-foreground hover:text-foreground border-transparent"
                  }`}
                >
                  Raw JSON
                </button>
              </div>

              <div className="min-h-25">
                {activeTab === "data" ? (
                  renderExtractedData()
                ) : (
                  <SimpleCodeEditor
                    code={JSON.stringify(
                      { extractedData, selector, extractionType, status },
                      null,
                      2
                    )}
                    language="json"
                    fileName="extraction-result.json"
                    showLineNumbers
                    maxHeight="400px"
                    readOnly
                    fontSize={12}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <div className="text-muted-foreground">No data was extracted</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
