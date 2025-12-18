"use client"

import * as React from "react"
import { Loader2, Paperclip, Send } from "lucide-react"

import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

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
    <div className="rounded-2xl border bg-card/80 p-4 shadow-inner">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isLoading}
        >
          <Paperclip className="h-4 w-4" />
          <span className="sr-only">Attach files</span>
        </Button>
        <Textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Terminator to research or run commands..."
          disabled={disabled || isLoading}
          className="min-h-[80px] flex-1 resize-none border-none bg-transparent focus-visible:ring-0"
        />
        <Button
          onClick={() => void handleSend()}
          disabled={disabled || isLoading || (value.trim().length === 0 && attachments.length === 0)}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
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
              onClick={() => setAttachments((prev) => prev.filter((item) => item.name !== file.name))}
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
      <p className="mt-2 text-xs text-muted-foreground">Shift + Enter to add a new line.</p>
    </div>
  )
}
