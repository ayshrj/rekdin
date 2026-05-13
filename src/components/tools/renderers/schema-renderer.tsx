"use client"

import { useState } from "react"

import {
  EmptyState,
  RawPayloadDisclosure,
  RendererTab,
  RendererTabBar,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { getNumber, getResult, getString, pickArray, stableKey } from "./renderer-utils"
import { SimpleCodeEditor } from "./simple-code-editor"
import { type ToolResultContentPart } from "./tool-result-renderer"

export function SchemaRenderer({ part }: { part: ToolResultContentPart }) {
  const result = getResult(part)
  const [tab, setTab] = useState<"models" | "erd" | "raw">("models")
  const models = pickArray(result, ["models", "tables", "entities", "items"])
  const erd = getString(result.erd ?? result.mermaid ?? result.diagram)
  const relationCount = getNumber(result.relationCount ?? result.relations, 0)
  const fieldCount = models.reduce(
    (sum, model) => sum + pickArray(model, ["fields", "columns"]).length,
    0
  )

  return (
    <ToolRendererShell
      className="border-tool-json/25"
      header={
        <>
          <span className="text-foreground min-w-0 flex-1 truncate font-mono text-[11px] font-semibold">
            {getString(part.toolName ?? part.type, "schema")}
          </span>
          <ToolStatusBadge variant="neutral">{models.length} models</ToolStatusBadge>
          <ToolStatusBadge variant="neutral">{fieldCount} fields</ToolStatusBadge>
          <ToolStatusBadge variant="neutral">{relationCount} relations</ToolStatusBadge>
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      <RendererTabBar>
        <RendererTab active={tab === "models"} onClick={() => setTab("models")}>
          Models
        </RendererTab>
        <RendererTab active={tab === "erd"} onClick={() => setTab("erd")}>
          ERD
        </RendererTab>
        <RendererTab active={tab === "raw"} onClick={() => setTab("raw")}>
          Raw
        </RendererTab>
      </RendererTabBar>
      {tab === "models" ? (
        models.length === 0 ? (
          <EmptyState>No models returned</EmptyState>
        ) : (
          <div className="max-h-[44vh] divide-y overflow-auto">
            {models.map((model, index) => {
              const fields = pickArray(model, ["fields", "columns"])
              return (
                <div key={stableKey(index, model.name)} className="px-3 py-2">
                  <div className="text-foreground/85 font-mono text-[11px] font-semibold">
                    {getString(model.name ?? model.table ?? model.entity, "model")}
                  </div>
                  <div className="mt-1 overflow-x-auto">
                    {fields.map((field, fieldIndex) => (
                      <div
                        key={stableKey(fieldIndex, field.name)}
                        className="grid grid-cols-[9rem_8rem_1fr] gap-2 py-0.5 font-mono text-[10px]"
                      >
                        <span className="text-foreground/75">
                          {getString(field.name ?? field.column)}
                        </span>
                        <span className="text-muted-foreground">
                          {getString(field.type ?? field.kind)}
                        </span>
                        <span className="text-muted-foreground">
                          {getString(field.decorators ?? field.constraints ?? field.relation)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : tab === "erd" ? (
        erd ? (
          <div className="p-3">
            <SimpleCodeEditor
              code={erd}
              language="mermaid"
              fileName="schema.mmd"
              maxHeight="44vh"
              fontSize={11}
            />
          </div>
        ) : (
          <EmptyState>No ERD returned</EmptyState>
        )
      ) : (
        <RawPayloadDisclosure payload={result} defaultOpen />
      )}
    </ToolRendererShell>
  )
}
