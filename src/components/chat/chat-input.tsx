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
        <div className="bg-popover text-popover-foreground absolute right-0 bottom-full left-0 z-30 mb-2 overflow-hidden rounded-xl border shadow-(--shadow-float)">
          <div className="border-b px-3 py-2">
            <p className="text-foreground text-xs font-semibold">Slash commands</p>
            <p className="text-muted-foreground text-[11px]">Use ↑/↓ to choose, Enter to insert.</p>
          </div>
          <div className="max-h-64 overflow-y-auto p-1.5">
            {commandSuggestions.map((command, index) => (
              <button
                key={command.id}
                ref={(element) => {
                  commandItemRefs.current[index] = element
                }}
                type="button"
                className={[
                  "flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                  index === activeCommandIndex ? "bg-muted" : "hover:bg-muted/70",
                ].join(" ")}
                onMouseEnter={() => setActiveCommandIndex(index)}
                onClick={() => selectCommand(command)}
              >
                <span className="bg-primary/10 text-primary mt-0.5 rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold">
                  /{command.id}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-foreground block text-xs font-semibold">
                    {command.label}
                  </span>
                  <span className="text-muted-foreground line-clamp-1 block text-[11px]">
                    {command.description}
                  </span>
                  <span className="text-muted-foreground/80 mt-0.5 block font-mono text-[10px]">
                    {command.usage}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div
        id="tour-chat-input"
        className="bg-background ring-border/50 focus-within:ring-primary/30 rounded-xl border shadow-(--shadow-float) ring-1 transition-shadow"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
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
            ref={textareaRef}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Rekdin to research or run commands..."
            disabled={disabled || isLoading}
            className="placeholder:text-muted-foreground/60 max-h-36 min-h-18 flex-1 resize-none border-0 bg-transparent p-1.5 text-base focus-visible:ring-0 focus-visible:outline-none sm:text-sm"
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
    </div>
  )
})
