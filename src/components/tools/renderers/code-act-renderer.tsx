"use client"

import React from "react"

import { SimpleCodeEditor } from "./simple-code-editor"
import { ToolResultContentPart } from "./tool-result-renderer"

interface CodeActRendererProps {
  part: ToolResultContentPart
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAction?: (action: string, data: any) => void
}

export const CodeActRenderer: React.FC<CodeActRendererProps> = ({ part }) => {
  const toolResult = part.toolResult || {}
  const toolInput = part.toolInput || {}
  const type = toolResult.type || part.toolName || "code_execution"
  const success = toolResult.success !== false
  const output = toolResult.output || ""
  const error = toolResult.error || ""
  const code = toolInput.code || toolInput.script || ""
  const filename = toolResult.filename || "code"

  const getLanguageInfo = (type: string) => {
    switch (type) {
      case "node_codeact":
        return { language: "javascript" }
      case "python_codeact":
        return { language: "python" }
      case "shell_codeact":
        return { language: "bash" }
      default:
        return { language: "text" }
    }
  }

  const langInfo = getLanguageInfo(type)

  return (
    <div className="codeact-result space-y-4">
      <div className="border-tool-code/30 overflow-hidden rounded-lg border">
        <SimpleCodeEditor
          code={code}
          language={langInfo.language}
          fileName={filename}
          showLineNumbers
          maxHeight="300px"
          readOnly
          fontSize={13}
        />
      </div>

      {(output || error) && (
        <div className="border-tool-code/30 overflow-hidden rounded-lg border">
          <div className="bg-tool-code/5 p-4">
            {output ? (
              <pre className="text-foreground font-mono text-sm leading-relaxed whitespace-pre-wrap">
                {output}
              </pre>
            ) : null}
            {error ? (
              <pre className="text-destructive font-mono text-sm leading-relaxed whitespace-pre-wrap">
                {error}
              </pre>
            ) : null}
            {!output && !error ? (
              <pre className="text-muted-foreground font-mono text-sm leading-relaxed whitespace-pre-wrap">
                {success ? "(no output)" : "(failed)"}
              </pre>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
