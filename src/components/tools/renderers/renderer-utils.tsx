"use client"

import { type ToolResultContentPart } from "./tool-result-renderer"

export type JsonRecord = Record<string, unknown>

export function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

export function getResult(part: ToolResultContentPart): JsonRecord {
  if (isRecord(part.toolResult)) return part.toolResult
  if (isRecord(part)) return part
  return {}
}

export function getArray(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord)
}

export function getString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return fallback
}

export function getNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

export function getBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback
}

export function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => getString(item)).filter(Boolean)
}

export function coalesce<T>(...values: T[]): T | undefined {
  return values.find((value) => value !== undefined && value !== null && value !== "")
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value)
}

export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B"
  const units = ["B", "kB", "MB", "GB"]
  let size = value
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  return `${size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unit]}`
}

export function stringifyPayload(value: unknown): string {
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function truncateMiddle(value: string, max = 96): string {
  if (value.length <= max) return value
  const side = Math.max(8, Math.floor((max - 1) / 2))
  return `${value.slice(0, side)}…${value.slice(-side)}`
}

export function pickArray(record: JsonRecord, keys: string[]): JsonRecord[] {
  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) return getArray(value)
  }
  return []
}

export function pickStringArray(record: JsonRecord, keys: string[]): string[] {
  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) return getStringArray(value)
  }
  return []
}

export function pathWithLine(record: JsonRecord): string {
  const file = getString(coalesce(record.file, record.path, record.source, record.filename))
  const line = getNumber(record.line)
  return line ? `${file}:${line}` : file
}

export function stableKey(...parts: unknown[]): string {
  return parts.map((part) => getString(part, "item")).join(":")
}
