"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

import {
  DEFAULT_FILE_ICON_DATA,
  FILE_EXTENSION_ICON_DATA,
  FILE_EXTENSION_ICON_IDS,
  type FileExtensionIconData,
} from "./file-extension-icon-data"

const FONT_FAMILIES: Record<string, string> = {
  devicons: "Rekdin Devopicons",
  fa: "Rekdin FontAwesome File Icons",
  fi: "Rekdin File Icons",
  mf: "Rekdin MFizz File Icons",
  octicons: "Rekdin Octicons File Icons",
}

const FONT_STYLE_ID = "rekdin-file-extension-icon-fonts"
const FONT_FACE_CSS = `
@font-face {
  font-family: "Rekdin File Icons";
  src: url("/file-icons/file-icons.woff2") format("woff2");
  font-display: block;
}
@font-face {
  font-family: "Rekdin Devopicons";
  src: url("/file-icons/devopicons.woff2") format("woff2");
  font-display: block;
}
@font-face {
  font-family: "Rekdin FontAwesome File Icons";
  src: url("/file-icons/fontawesome.woff2") format("woff2");
  font-display: block;
}
@font-face {
  font-family: "Rekdin MFizz File Icons";
  src: url("/file-icons/mfixx.woff2") format("woff2");
  font-display: block;
}
@font-face {
  font-family: "Rekdin Octicons File Icons";
  src: url("/file-icons/octicons.woff2") format("woff2");
  font-display: block;
}
`

function useFileIconFonts() {
  React.useInsertionEffect(() => {
    if (document.getElementById(FONT_STYLE_ID)) return

    const style = document.createElement("style")
    style.id = FONT_STYLE_ID
    style.textContent = FONT_FACE_CSS
    document.head.append(style)
  }, [])
}

function normalizeExtensionName(extensionName: string): string {
  const basename = extensionName.trim().toLowerCase().split(/[\\/]/).pop() ?? ""
  return basename.replace(/^\.+/, "")
}

function getExtensionCandidates(extensionName: string): string[] {
  const normalized = normalizeExtensionName(extensionName)
  if (!normalized) return []

  const parts = normalized.split(".").filter(Boolean)
  const candidates = [normalized]

  for (let index = 1; index < parts.length; index += 1) {
    candidates.push(parts.slice(index).join("."))
  }

  return candidates
}

function resolveIconData(extensionName: string): FileExtensionIconData {
  for (const candidate of getExtensionCandidates(extensionName)) {
    const iconId = FILE_EXTENSION_ICON_IDS[candidate]
    if (iconId) {
      return FILE_EXTENSION_ICON_DATA[iconId] ?? DEFAULT_FILE_ICON_DATA
    }
  }

  return DEFAULT_FILE_ICON_DATA
}

function glyphToCharacter(glyph: string): string {
  if (!glyph.startsWith("\\")) return glyph

  const codePoint = Number.parseInt(glyph.slice(1), 16)
  return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : glyph
}

export type FileExtensionIconProps = Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> & {
  extensionName: string
}

export function getFileExtensionIconData(extensionName: string): FileExtensionIconData {
  return resolveIconData(extensionName)
}

export function FileExtensionIcon({
  extensionName,
  className,
  style,
  title,
  "aria-label": ariaLabel,
  ...props
}: FileExtensionIconProps) {
  useFileIconFonts()

  const icon = resolveIconData(extensionName)
  const glyph = glyphToCharacter(icon.glyph)

  return (
    <span
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
      role={ariaLabel ? "img" : undefined}
      style={{
        color: icon.color ?? "currentColor",
        fontFamily: FONT_FAMILIES[icon.fontId] ?? FONT_FAMILIES.octicons,
        fontSize: icon.fontSize,
        fontStyle: "normal",
        fontWeight: 400,
        lineHeight: 1,
        ...style,
      }}
      title={title}
      {...props}
    >
      {glyph}
    </span>
  )
}
