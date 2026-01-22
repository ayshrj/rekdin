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
    <div className="bg-card/80 rounded-2xl border p-4 shadow-inner">
      <div className="flex items-end gap-2">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isLoading}
        >
          <PaperClip className="h-4 w-4" />
          <span className="sr-only">Attach files</span>
        </Button>
        <Textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Rekdin to research or run commands..."
          disabled={disabled || isLoading}
          className="max-h-40 min-h-20 flex-1 resize-none bg-transparent focus-visible:ring-0"
        />
        <Button
          onClick={() => void handleSend()}
          disabled={
            disabled || isLoading || (value.trim().length === 0 && attachments.length === 0)
          }
        >
          {isLoading ? (
            <Loader className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <span className="mr-2 hidden md:inline">Send</span>
              <Send className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
      {attachments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
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
      <p className="text-muted-foreground mt-2 text-xs">Shift + Enter to add a new line.</p>
    </div>
  )
}
