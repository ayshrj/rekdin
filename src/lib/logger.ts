import { SHOW_LOGS } from "@/configs"

type LogLevel = "info" | "warn" | "error" | "debug"

function emit(level: LogLevel, message: string, ...meta: unknown[]) {
  if (!SHOW_LOGS) return
  const prefix = `[${level.toUpperCase()}]`

  console[level === "debug" ? "log" : level](prefix, message, ...meta)
}

export const logger = {
  info: (msg: string, ...meta: unknown[]) => emit("info", msg, ...meta),
  warn: (msg: string, ...meta: unknown[]) => emit("warn", msg, ...meta),
  error: (msg: string, ...meta: unknown[]) => emit("error", msg, ...meta),
  debug: (msg: string, ...meta: unknown[]) => emit("debug", msg, ...meta),
}
