"use client"

import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { SLASH_COMMANDS, SlashCommandDefinition } from "@/lib/commands"
import { Loader, PaperAirplane as Send, PaperClip } from "@/lib/icons"

interface ChatInputProps {
  value: string
  onValueChange: (v: string) => void
  onSend: (content: string, attachments: File[]) => Promise<void> | void
  isLoading: boolean
  disabled?: boolean
}

export interface ChatInputHandle {
  focus(): void
}

/**
 * Controlled prompt composer with attachment support and an imperative focus handle for workflow
 * preset launches.
 */
export const ChatInput = React.forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput(
  { value, onValueChange, onSend, isLoading, disabled },
  ref
) {
  const [attachments, setAttachments] = React.useState<File[]>([])
  const [activeCommandIndex, setActiveCommandIndex] = React.useState(0)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const commandItemRefs = React.useRef<Array<HTMLButtonElement | null>>([])

  const slashQuery = React.useMemo(() => {
    const match = value.match(/^\/([^\s/]*)$/)
    return match ? match[1].toLowerCase() : null
  }, [value])

  const commandSuggestions = React.useMemo(() => {
    if (slashQuery === null) return []
    return SLASH_COMMANDS.filter((command) => {
      if (!slashQuery) return true
      return (
        command.id.includes(slashQuery) ||
        command.label.toLowerCase().includes(slashQuery) ||
        command.description.toLowerCase().includes(slashQuery)
      )
    })
  }, [slashQuery])

  const showCommandSuggestions = commandSuggestions.length > 0 && !disabled && !isLoading

  React.useEffect(() => {
    setActiveCommandIndex(0)
  }, [slashQuery])

  React.useEffect(() => {
    if (!showCommandSuggestions) return
    commandItemRefs.current[activeCommandIndex]?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    })
  }, [activeCommandIndex, showCommandSuggestions])

  React.useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }))

  const handleSend = React.useCallback(async () => {
    if (!value.trim() && attachments.length === 0) return
    const nextValue = value
    const nextAttachments = attachments
    try {
      await onSend(nextValue, nextAttachments)
      onValueChange("")
      setAttachments([])
    } catch {
      // errors handled by parent hook
    }
  }, [attachments, onSend, value, onValueChange])

  const selectCommand = React.useCallback(
    (command: SlashCommandDefinition) => {
      onValueChange(`/${command.id} `)
      setTimeout(() => textareaRef.current?.focus(), 0)
    },
    [onValueChange]
  )

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommandSuggestions) {
      if (event.key === "ArrowDown") {
        event.preventDefault()
        setActiveCommandIndex((index) => (index + 1) % commandSuggestions.length)
        return
      }
      if (event.key === "ArrowUp") {
        event.preventDefault()
        setActiveCommandIndex(
          (index) => (index - 1 + commandSuggestions.length) % commandSuggestions.length
        )
        return
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault()
        selectCommand(commandSuggestions[activeCommandIndex] ?? commandSuggestions[0])
        return
      }
      if (event.key === "Escape") {
        event.preventDefault()
        onValueChange("")
        return
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      void handleSend()
    }
  }

  return (
    <div className="relative">
      {showCommandSuggestions ? (
        <div className="bg-surface-5 text-popover-foreground data-[state=open]:animate-in border-border absolute right-0 bottom-full left-0 z-30 mb-2 overflow-hidden rounded-lg border shadow-none">
          <div className="rk-scrollbar max-h-60 overflow-y-auto p-2">
            {commandSuggestions.map((command, index) => (
              <button
                key={command.id}
                ref={(element) => {
                  commandItemRefs.current[index] = element
                }}
                type="button"
                className={[
                  "flex h-9 w-full items-center justify-between gap-3 rounded-md px-3 text-left transition-colors",
                  index === activeCommandIndex
                    ? "bg-surface-4 text-foreground"
                    : "text-muted-foreground hover:bg-surface-4 hover:text-foreground",
                ].join(" ")}
                onMouseEnter={() => setActiveCommandIndex(index)}
                onClick={() => selectCommand(command)}
              >
                <span className="text-foreground shrink-0 font-mono text-sm font-medium">
                  /{command.id}
                </span>
                <span className="text-muted-foreground min-w-0 truncate text-xs">
                  {command.description}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div
        id="tour-chat-input"
        className="border-border bg-surface-4 focus-within:border-primary/50 rounded-lg border transition-colors"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-3">
            {attachments.map((file) => (
              <Badge
                key={file.name}
                variant="secondary"
                className="border-border bg-surface-5 h-7 cursor-pointer rounded-md font-mono text-[10px]"
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
            className="text-muted-foreground hover:text-foreground hover:bg-surface-5 h-8 w-8 shrink-0 rounded-md"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isLoading}
          >
            <PaperClip className="h-3.5 w-3.5" />
            <span className="sr-only">Attach files</span>
          </Button>
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Rekdin to research or run commands..."
            disabled={disabled || isLoading}
            className="placeholder:text-muted-foreground max-h-40 min-h-11 flex-1 resize-none border-0 bg-transparent p-1.5 text-base leading-relaxed focus-visible:ring-0 focus-visible:outline-none sm:text-sm"
          />
          <Button
            onClick={() => void handleSend()}
            size="icon"
            className="bg-primary text-primary-foreground disabled:bg-surface-5 disabled:text-muted-foreground h-8 w-8 shrink-0 rounded-md hover:bg-[#4a80ff] disabled:opacity-100"
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
      </div>
    </div>
  )
})
