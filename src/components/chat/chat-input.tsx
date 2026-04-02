"use client"

import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader, PaperAirplane as Send, PaperClip } from "@/lib/icons"

interface ChatInputProps {
  onSend: (content: string, attachments: File[]) => Promise<void> | void
  isLoading: boolean
  disabled?: boolean
}

export function ChatInput({ onSend, isLoading, disabled }: ChatInputProps) {
  const [value, setValue] = React.useState("")
  const [attachments, setAttachments] = React.useState<File[]>([])
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  const handleSend = React.useCallback(async () => {
    if (!value.trim() && attachments.length === 0) return
    const nextValue = value
    const nextAttachments = attachments
    try {
      await onSend(nextValue, nextAttachments)
      setValue("")
      setAttachments([])
    } catch {
      // errors handled by parent hook
    }
  }, [attachments, onSend, value])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      void handleSend()
    }
  }

  return (
    <div className="bg-background ring-border/50 focus-within:ring-primary/30 rounded-xl border shadow-(--shadow-float) ring-1 transition-shadow">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pt-2">
          {attachments.map((file) => (
            <Badge
              key={file.name}
              variant="secondary"
              className="cursor-pointer"
              onClick={() =>
                setAttachments((prev) => prev.filter((item) => item.name !== file.name))
              }
            >
              {file.name}
            </Badge>
          ))}
        </div>
      )}
      <div className="flex items-end gap-1.5 p-2">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="text-muted-foreground hover:text-foreground h-7 w-7 shrink-0 rounded-lg"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isLoading}
        >
          <PaperClip className="h-3.5 w-3.5" />
          <span className="sr-only">Attach files</span>
        </Button>
        <Textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Rekdin to research or run commands..."
          disabled={disabled || isLoading}
          className="placeholder:text-muted-foreground/60 max-h-36 min-h-[4.5rem] flex-1 resize-none border-0 bg-transparent p-1.5 text-sm focus-visible:ring-0 focus-visible:outline-none"
        />
        <Button
          onClick={() => void handleSend()}
          size="icon"
          className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 w-8 shrink-0 rounded-lg disabled:opacity-40"
          disabled={
            disabled || isLoading || (value.trim().length === 0 && attachments.length === 0)
          }
        >
          {isLoading ? (
            <Loader className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          if (!event.target.files) return
          setAttachments((prev) => [...prev, ...Array.from(event.target.files!)])
          event.target.value = ""
        }}
      />
      <p className="text-muted-foreground/60 px-3 pb-2 text-[11px]">↵ Send · Shift+↵ New line</p>
    </div>
  )
}
