"use client"

import { useState } from "react"

import { Markdown } from "@/components/markdown"
import { toolLabels } from "@/components/tools/tool-labels"
import { Badge } from "@/components/ui/badge"
import { Check, ClipboardDocumentList as Copy, RekdinIcon, User } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { ChatMessage as ChatMessageType } from "@/types/chat"

interface ChatMessageProps {
  message: ChatMessageType
  showHeader?: boolean
}

export function ChatMessage({ message, showHeader = true }: ChatMessageProps) {
  const isUser = message.role === "user"
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(message.content || "")
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className={cn("group relative flex w-full flex-col gap-2", isUser && "items-end")}>
      {!isUser && (
        <button
          onClick={copyToClipboard}
          className="hover:bg-muted absolute top-2 right-4 rounded p-1.5 opacity-0 transition-opacity group-hover:opacity-100"
          aria-label="Copy message"
        >
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        </button>
      )}
      {showHeader ? (
        <div
          className={cn(
            "text-muted-foreground flex items-center gap-2 text-xs tracking-wide uppercase",
            isUser && "ml-auto w-fit flex-row-reverse text-right"
          )}
        >
          <div className="border-muted shrink-0 self-start rounded-full border p-1.5">
            {isUser ? <User className="h-3.5 w-3.5" /> : <RekdinIcon className="h-3.5 w-3.5" />}
          </div>
          <span>{isUser ? "You" : "Rekdin"}</span>
          {message.metadata?.agentType && !isUser ? (
            <Badge variant="outline" className="text-[0.65rem] tracking-wide uppercase">
              {message.metadata.agentType}
            </Badge>
          ) : null}
        </div>
      ) : null}
      <div
        className={cn(
          "max-w-[85%] overflow-hidden rounded-2xl border px-4 py-3 shadow-sm transition",
          isUser ? "bg-primary text-primary-foreground ml-auto" : "bg-card"
        )}
      >
        <div className="flex min-w-0 flex-col gap-2 overflow-x-hidden">
          {isUser ? (
            <p className="text-left text-sm wrap-anywhere whitespace-pre-wrap">{message.content}</p>
          ) : (
            <Markdown className="max-w-none text-sm wrap-anywhere">
              {message.content || "_(no response)_"}
            </Markdown>
          )}

          {message.attachments && message.attachments.length > 0 ? (
            <div className={cn("flex flex-wrap gap-2", isUser && "justify-end")}>
              {message.attachments.map((file) => (
                <Badge key={file} variant="secondary">
                  {file}
                </Badge>
              ))}
            </div>
          ) : null}

          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="bg-muted/30 text-muted-foreground rounded p-1 text-xs wrap-anywhere italic">
              <span className="font-medium">Tools:</span>{" "}
              <span>
                {message.toolCalls.map((call) => toolLabels[call.name] ?? call.name).join(", ")}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
