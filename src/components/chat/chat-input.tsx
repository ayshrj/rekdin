"use client"

import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { SLASH_COMMANDS, SlashCommandDefinition } from "@/lib/commands"
import {
  BookOpen,
  Loader,
  MicrophoneIcon,
  PaperAirplane as Send,
  PaperClip,
  XMark,
} from "@/lib/icons"

// Web Speech API — not in lib.dom.d.ts; typed minimally here
interface SpeechRec extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult:
    | ((e: { results: { [i: number]: { [i: number]: { transcript: string } } } }) => void)
    | null
  onend: (() => void) | null
  onerror: (() => void) | null
}
type SpeechRecCtor = new () => SpeechRec
type WinWithSR = typeof window & {
  SpeechRecognition?: SpeechRecCtor
  webkitSpeechRecognition?: SpeechRecCtor
}

function getSR(): SpeechRecCtor | undefined {
  if (typeof window === "undefined") return undefined
  const w = window as WinWithSR
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

interface ChatInputProps {
  value: string
  onValueChange: (v: string) => void
  onSend: (content: string, attachments: File[]) => Promise<void> | void
  isLoading: boolean
  disabled?: boolean
  onStop?: () => void
}

export interface ChatInputHandle {
  focus(): void
  addFiles(files: File[]): void
}

/**
 * Controlled prompt composer with attachment support and slash command suggestions.
 * Imperative focus handle for workflow preset launches.
 */
export const ChatInput = React.forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput(
  { value, onValueChange, onSend, isLoading, disabled, onStop },
  ref
) {
  const [attachments, setAttachments] = React.useState<File[]>([])
  const [activeCommandIndex, setActiveCommandIndex] = React.useState(0)
  const [isListening, setIsListening] = React.useState(false)
  const [promptLibOpen, setPromptLibOpen] = React.useState(false)
  const [savedPrompts, setSavedPrompts] = React.useState<Array<{ id: string; text: string }>>([])

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("rekdin-prompt-library")
      if (raw) setSavedPrompts(JSON.parse(raw) as Array<{ id: string; text: string }>)
    } catch {
      /* ignore */
    }
  }, [promptLibOpen])

  const savePrompt = React.useCallback(() => {
    if (!value.trim()) return
    const next = [{ id: Date.now().toString(), text: value.trim() }, ...savedPrompts].slice(0, 20)
    setSavedPrompts(next)
    try {
      localStorage.setItem("rekdin-prompt-library", JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }, [value, savedPrompts])

  const deletePrompt = React.useCallback(
    (id: string) => {
      const next = savedPrompts.filter((p) => p.id !== id)
      setSavedPrompts(next)
      try {
        localStorage.setItem("rekdin-prompt-library", JSON.stringify(next))
      } catch {
        /* ignore */
      }
    },
    [savedPrompts]
  )
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const commandItemRefs = React.useRef<Array<HTMLButtonElement | null>>([])
  const recognitionRef = React.useRef<SpeechRec | null>(null)
  const supportsVoice = typeof window !== "undefined" && !!getSR()

  const toggleVoice = React.useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }
    const SR = getSR()
    if (!SR) return
    const rec = new SR()
    rec.continuous = false
    rec.interimResults = false
    rec.lang = "en-US"
    rec.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? ""
      if (transcript) onValueChange((value ? value + " " : "") + transcript)
    }
    rec.onend = () => setIsListening(false)
    rec.onerror = () => setIsListening(false)
    recognitionRef.current = rec
    rec.start()
    setIsListening(true)
  }, [isListening, onValueChange, value])

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
    addFiles: (files: File[]) => setAttachments((prev) => [...prev, ...files]),
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
    if (e.key === "Escape" && isLoading && onStop) {
      e.preventDefault()
      onStop()
      return
    }
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

  const handlePaste = React.useCallback((event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files ?? []).filter((file) =>
      file.type.startsWith("image/")
    )
    if (files.length === 0) return
    event.preventDefault()
    setAttachments((prev) => [...prev, ...files])
  }, [])

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

          {/* Prompt library */}
          <Popover open={promptLibOpen} onOpenChange={setPromptLibOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className={
                  promptLibOpen
                    ? "text-primary bg-primary/10 h-8 w-8 shrink-0 rounded-md"
                    : "text-muted-foreground hover:bg-surface-5 hover:text-foreground h-8 w-8 shrink-0 rounded-md"
                }
                disabled={disabled || isLoading}
                aria-label="Prompt library"
              >
                <BookOpen className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" side="top" className="w-80 p-0">
              <div className="border-border flex items-center justify-between border-b px-3 py-2">
                <span className="text-foreground text-xs font-semibold">Prompt library</span>
                <button
                  type="button"
                  onClick={savePrompt}
                  disabled={!value.trim()}
                  className="text-primary disabled:text-muted-foreground text-[11px] font-medium hover:underline disabled:cursor-not-allowed"
                >
                  + Save current
                </button>
              </div>
              {savedPrompts.length === 0 ? (
                <p className="text-muted-foreground px-3 py-4 text-center text-xs">
                  No saved prompts yet. Type something and click &quot;+ Save current&quot;.
                </p>
              ) : (
                <div className="rk-scrollbar max-h-60 overflow-y-auto">
                  {savedPrompts.map((p) => (
                    <div
                      key={p.id}
                      className="border-border hover:bg-surface-3 group flex items-start gap-2 border-b px-3 py-2 last:border-0"
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => {
                          onValueChange(p.text)
                          setPromptLibOpen(false)
                          setTimeout(() => textareaRef.current?.focus(), 0)
                        }}
                      >
                        <span className="text-foreground line-clamp-2 text-xs">{p.text}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePrompt(p.id)}
                        className="text-muted-foreground hover:text-destructive mt-0.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label="Delete prompt"
                      >
                        <XMark className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Voice input */}
          {supportsVoice && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className={
                isListening
                  ? "text-destructive hover:bg-destructive/10 h-8 w-8 shrink-0 rounded-md"
                  : "text-muted-foreground hover:bg-surface-5 hover:text-foreground h-8 w-8 shrink-0 rounded-md"
              }
              onClick={toggleVoice}
              disabled={disabled || isLoading}
              aria-label={isListening ? "Stop recording" : "Start voice input"}
            >
              <MicrophoneIcon className={`h-3.5 w-3.5 ${isListening ? "animate-pulse" : ""}`} />
            </Button>
          )}

          {/* Textarea */}
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Ask Rekdin to research or run commands…"
            disabled={disabled || isLoading}
            className="placeholder:text-muted-foreground max-h-40 min-h-11 flex-1 resize-none border-0 bg-transparent p-1.5 text-sm leading-relaxed focus-visible:ring-0 focus-visible:outline-none"
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
          {isLoading && onStop ? (
            <Button
              type="button"
              onClick={onStop}
              size="icon"
              variant="outline"
              className="h-8 w-8 shrink-0 rounded-md"
              aria-label="Stop generation"
            >
              <XMark className="h-3.5 w-3.5" />
            </Button>
          ) : null}
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
