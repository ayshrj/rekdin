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
 * Controlled prompt composer with attachment support and slash command suggestions.
 * Imperative focus handle for workflow preset launches.
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

  // ── Slash command matching ────────────────────────────────────────────────
  const slashQuery = React.useMemo(() => {
    const match = value.match(/^\/([^\s/]*)$/)
    return match ? match[1].toLowerCase() : null
  }, [value])

  const commandSuggestions = React.useMemo(() => {
    if (slashQuery === null) return []
    return SLASH_COMMANDS.filter((cmd) => {
      if (!slashQuery) return true
      return (
        cmd.id.includes(slashQuery) ||
        cmd.label.toLowerCase().includes(slashQuery) ||
        cmd.description.toLowerCase().includes(slashQuery)
      )
    })
  }, [slashQuery])

  const showCommandSuggestions = commandSuggestions.length > 0 && !disabled && !isLoading

  // Reset active index when query changes
  React.useEffect(() => {
    setActiveCommandIndex(0)
  }, [slashQuery])

  // Keep active suggestion scrolled into view
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

  // ── Send ─────────────────────────────────────────────────────────────────
  const handleSend = React.useCallback(async () => {
    if (!value.trim() && attachments.length === 0) return
    const nextValue = value
    const nextAttachments = attachments
    try {
      await onSend(nextValue, nextAttachments)
      onValueChange("")
      setAttachments([])
    } catch {
      // errors handled by parent
    }
  }, [attachments, onSend, value, onValueChange])

  // ── Command select ───────────────────────────────────────────────────────
  const selectCommand = React.useCallback(
    (cmd: SlashCommandDefinition) => {
      onValueChange(`/${cmd.id} `)
      setTimeout(() => textareaRef.current?.focus(), 0)
    },
    [onValueChange]
  )

  // ── Keyboard navigation ──────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommandSuggestions) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveCommandIndex((i) => (i + 1) % commandSuggestions.length)
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveCommandIndex(
          (i) => (i - 1 + commandSuggestions.length) % commandSuggestions.length
        )
        return
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault()
        selectCommand(commandSuggestions[activeCommandIndex] ?? commandSuggestions[0])
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        onValueChange("")
        return
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const isSendDisabled =
    disabled || isLoading || (value.trim().length === 0 && attachments.length === 0)

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="relative">
      {/* ── Slash command suggestions ────────────────────────────────────── */}
      {showCommandSuggestions && (
        <div className="rk-command-popover">
          <div className="rk-scrollbar max-h-56 overflow-y-auto p-1.5">
            {commandSuggestions.map((cmd, index) => (
              <button
                key={cmd.id}
                ref={(el) => {
                  commandItemRefs.current[index] = el
                }}
                type="button"
                className={[
                  "rk-command-item",
                  index === activeCommandIndex ? "rk-command-item--active" : "",
                ].join(" ")}
                onMouseEnter={() => setActiveCommandIndex(index)}
                onClick={() => selectCommand(cmd)}
              >
                <span className="rk-command-name">/{cmd.id}</span>
                <span className="rk-command-desc">{cmd.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input container ──────────────────────────────────────────────── */}
      <div id="tour-chat-input" className="rk-input-container">
        {/* Attachment chips */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
            {attachments.map((file) => (
              <Badge
                key={file.name}
                variant="secondary"
                className="border-border bg-surface-5 h-6 cursor-pointer rounded-md border font-mono text-[10px]"
                onClick={() => setAttachments((prev) => prev.filter((f) => f.name !== file.name))}
              >
                {file.name}
              </Badge>
            ))}
          </div>
        )}

        {/* Textarea + action buttons */}
        <div className="flex items-end gap-1.5 p-2">
          {/* Attach */}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="text-muted-foreground hover:bg-surface-5 hover:text-foreground h-8 w-8 shrink-0 rounded-md"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isLoading}
          >
            <PaperClip className="h-3.5 w-3.5" />
            <span className="sr-only">Attach files</span>
          </Button>

          {/* Textarea */}
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Rekdin to research or run commands…"
            disabled={disabled || isLoading}
            className="placeholder:text-muted-foreground max-h-40 min-h-[44px] flex-1 resize-none border-0 bg-transparent p-1.5 text-sm leading-relaxed focus-visible:ring-0 focus-visible:outline-none"
          />

          {/* Send */}
          <Button
            onClick={() => void handleSend()}
            size="icon"
            className="bg-primary text-primary-foreground disabled:bg-surface-4 disabled:text-muted-foreground h-8 w-8 shrink-0 rounded-md hover:bg-[#4a80ff] disabled:opacity-100"
            disabled={isSendDisabled}
          >
            {isLoading ? (
              <Loader className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (!e.target.files) return
            setAttachments((prev) => [...prev, ...Array.from(e.target.files!)])
            e.target.value = ""
          }}
        />
      </div>
    </div>
  )
})
