"use client"

import { useState } from "react"

import {
  CopyButton,
  EmptyState,
  RawPayloadDisclosure,
  ToolRendererShell,
  ToolStatusBadge,
} from "./renderer-primitives"
import { type ToolResultContentPart } from "./tool-result-renderer"

// ── EXIF grouping ─────────────────────────────────────────────────────────────

const GPS_KEYS = new Set([
  "gpslatitude",
  "gpslongitude",
  "gpsaltitude",
  "gpslatituderef",
  "gpslongituderef",
  "gpsaltituderef",
  "gpsdatestamp",
  "gpstimestamp",
  "gpsimgdirection",
  "gpsspeed",
  "gpstrack",
])

const CAMERA_KEYS = new Set([
  "make",
  "model",
  "lensmodel",
  "lensmake",
  "software",
  "artist",
  "iso",
  "isospeedratings",
  "fnumber",
  "aperture",
  "exposuretime",
  "shutterspeedvalue",
  "exposureprogram",
  "meteringmode",
  "flash",
  "focallength",
  "focallengthin35mmfilm",
  "whitebalance",
  "exposuremode",
  "exposurebias",
  "exposurecompensation",
  "digitalzoomratio",
  "brightnessvalue",
  "lightsource",
  "scenecapturetype",
])

const DIMENSION_KEYS = new Set([
  "imagewidth",
  "imageheight",
  "pixelxdimension",
  "pixelydimension",
  "exifimagewidth",
  "exifimageheight",
  "xresolution",
  "yresolution",
  "resolutionunit",
  "orientation",
  "colorspace",
  "bitspersample",
])

const DATE_KEYS = new Set([
  "datetime",
  "datetimeoriginal",
  "datetimedigitized",
  "createdate",
  "modifydate",
  "subsectime",
  "offsettime",
  "offsettimeoriginal",
])

type ExifGroup = "Camera" | "Dimensions" | "DateTime" | "GPS" | "Other"

function classifyKey(key: string): ExifGroup {
  const lower = key.toLowerCase().replace(/[^a-z]/g, "")
  if (GPS_KEYS.has(lower)) return "GPS"
  if (CAMERA_KEYS.has(lower)) return "Camera"
  if (DIMENSION_KEYS.has(lower)) return "Dimensions"
  if (DATE_KEYS.has(lower)) return "DateTime"
  return "Other"
}

interface ExifEntry {
  key: string
  value: string
}

function normalizeExif(raw: unknown): Record<ExifGroup, ExifEntry[]> {
  const groups: Record<ExifGroup, ExifEntry[]> = {
    Camera: [],
    Dimensions: [],
    DateTime: [],
    GPS: [],
    Other: [],
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return groups
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const value = val == null ? "" : typeof val === "object" ? JSON.stringify(val) : String(val)
    const group = classifyKey(key)
    groups[group].push({ key, value })
  }
  return groups
}

const GROUP_ORDER: ExifGroup[] = ["Camera", "Dimensions", "DateTime", "GPS", "Other"]

// ── Main renderer ─────────────────────────────────────────────────────────────

export function ImageExifRenderer({ part }: { part: ToolResultContentPart }) {
  const result = part.toolResult as Record<string, unknown> | undefined
  const [showGps, setShowGps] = useState(false)

  const rawExif = result?.exif ?? result?.tags ?? result?.metadata ?? result
  const groups = normalizeExif(rawExif)
  const totalFields = Object.values(groups).reduce((n, g) => n + g.length, 0)
  const exifJson = JSON.stringify(rawExif, null, 2)

  const filePath = (result?.file ?? result?.path ?? result?.source ?? "") as string
  const hasGps = groups.GPS.length > 0

  return (
    <ToolRendererShell
      header={
        <>
          <span className="text-foreground font-mono text-[11px] font-semibold">Image EXIF</span>
          {filePath && <span className="rk-path-chip max-w-40 min-w-0 truncate">{filePath}</span>}
          <ToolStatusBadge variant="neutral">
            {totalFields} field{totalFields !== 1 ? "s" : ""}
          </ToolStatusBadge>
          {hasGps && (
            <button
              type="button"
              onClick={() => setShowGps((v) => !v)}
              className="rk-flat-button ml-auto text-[10px]"
            >
              {showGps ? "hide GPS" : "show GPS"}
            </button>
          )}
          <CopyButton text={exifJson} className={hasGps ? "" : "ml-auto"} />
        </>
      }
      footer={<RawPayloadDisclosure payload={result} />}
    >
      {totalFields === 0 ? (
        <EmptyState>No EXIF data</EmptyState>
      ) : (
        <div className="rk-scrollbar max-h-[45vh] divide-y overflow-auto">
          {GROUP_ORDER.map((groupName) => {
            const entries = groups[groupName]
            if (entries.length === 0) return null
            if (groupName === "GPS" && !showGps) {
              return (
                <div key={groupName} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="rk-section-label">{groupName}</span>
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {entries.length} field{entries.length !== 1 ? "s" : ""} — hidden
                  </span>
                </div>
              )
            }
            return (
              <div key={groupName}>
                <div className="bg-surface-4 px-3 py-1">
                  <span className="rk-section-label">{groupName}</span>
                </div>
                {entries.map((e, i) => (
                  <div key={i} className="hover:bg-surface-4 flex items-start gap-3 px-3 py-1">
                    <span className="text-muted-foreground w-40 shrink-0 truncate pt-px font-mono text-[10px]">
                      {e.key}
                    </span>
                    <span className="text-foreground/80 min-w-0 flex-1 font-mono text-[10px] break-all">
                      {e.value}
                    </span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </ToolRendererShell>
  )
}
