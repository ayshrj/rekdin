"use client"

import { User, Cpu } from "lucide-react"

import { ChatMessage as ChatMessageType } from "@/types/chat"
import { cn } from "@/lib/utils"
import { Markdown } from "@/components/markdown"
import { Badge } from "@/components/ui/badge"

interface ChatMessageProps {
  message: ChatMessageType
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user"
  return (
    <div
      className={cn(
        "flex gap-3 rounded-2xl border px-4 py-3 shadow-sm transition",
        isUser ? "ml-auto max-w-[80%] flex-row-reverse bg-primary text-primary-foreground" : "bg-card"
      )}
    >
      <div className="mt-1 rounded-full border p-2">
        {isUser ? <User className="h-4 w-4" /> : <Cpu className="h-4 w-4" />}
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <span>{isUser ? "You" : "Terminator"}</span>
          {message.metadata?.agentType && !isUser ? (
            <Badge variant="outline" className="text-[0.65rem] uppercase tracking-wide">
              {message.metadata.agentType}
            </Badge>
          ) : null}
        </div>
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <Markdown className="text-sm">{message.content || "_(no response)_"}</Markdown>
        )}
        {message.attachments && message.attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {message.attachments.map((file) => (
              <Badge key={file} variant="secondary">
                {file}
              </Badge>
            ))}
          </div>
        ) : null}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">Tools:</span>{" "}
            {message.toolCalls.map((call) => call.name).join(", ")}
          </div>
        )}
      </div>
    </div>
  )
}
