"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { Image, type ImageProps } from "@/components/ui/image"
import {
  LightboxCloseIcon as IcoClose,
  LightboxDownloadIcon as IcoDownload,
  LightboxResetIcon as IcoReset,
  LightboxRotateIcon as IcoRotate,
  LightboxZoomInIcon as IcoZoomIn,
  LightboxZoomOutIcon as IcoZoomOut,
} from "@/lib/icons"
import { cn } from "@/lib/utils"

// ── module-level event bus ────────────────────────────────────────────────────

type LightboxListener = (src: string, alt: string) => void
const _listeners = new Set<LightboxListener>()

export function openLightbox(src: string, alt = "") {
  _listeners.forEach((fn) => fn(src, alt))
}

// ── constants ─────────────────────────────────────────────────────────────────

const SCALE_MIN = 0.1
const SCALE_MAX = 10
const SCALE_WHEEL = 0.12 // multiplicative step per wheel tick
const SCALE_BTN = 0.25 // additive step per button click
const DRAG_THRESHOLD = 4 // px of movement before treating as drag not click

const INITIAL_T = { scale: 1, rotation: 0, tx: 0, ty: 0 }
type T = typeof INITIAL_T

// ── ImageLightboxPortal ───────────────────────────────────────────────────────
// Render once in layout.tsx. The portal mounts after hydration.

export function ImageLightboxPortal() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(<LightboxModal />, document.body)
}

// ── ClickableImage ────────────────────────────────────────────────────────────
// Drop-in replacement for <Image> that opens the lightbox on click.

export const ClickableImage = React.forwardRef<HTMLImageElement, ImageProps>(
  function ClickableImage({ src, alt = "", onClick, style, ...props }, ref) {
    return (
      <Image
        ref={ref}
        src={src}
        alt={alt}
        style={{ cursor: "zoom-in", ...style }}
        onClick={(e) => {
          openLightbox(src, alt)
          onClick?.(e)
        }}
        {...props}
      />
    )
  }
)

// ── Toolbar button ────────────────────────────────────────────────────────────

function TBtn({
  onClick,
  title,
  children,
  active,
}: {
  onClick: () => void
  title: string
  children: React.ReactNode
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded transition-colors",
        active ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/15 hover:text-white"
      )}
    >
      {children}
    </button>
  )
}

// ── LightboxModal ─────────────────────────────────────────────────────────────

function LightboxModal() {
  const [src, setSrc] = useState<string | null>(null)
  const [alt, setAlt] = useState("")
  const [t, setT] = useState<T>(INITIAL_T)
  const [isDragging, setIsDragging] = useState(false)

  const dragRef = useRef({ active: false, moved: false, startX: 0, startY: 0, tx0: 0, ty0: 0 })
  const pinchRef = useRef<{ dist0: number; scale0: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // subscribe to openLightbox() calls
  useEffect(() => {
    const listener: LightboxListener = (s, a) => {
      setSrc(s)
      setAlt(a)
      setT(INITIAL_T)
    }
    _listeners.add(listener)
    return () => {
      _listeners.delete(listener)
    }
  }, [])

  const close = useCallback(() => setSrc(null), [])

  const zoomBy = useCallback((delta: number) => {
    setT((p) => ({ ...p, scale: Math.max(SCALE_MIN, Math.min(SCALE_MAX, p.scale + delta)) }))
  }, [])

  const rotate = useCallback(() => {
    setT((p) => ({ ...p, rotation: (p.rotation + 90) % 360, tx: 0, ty: 0 }))
  }, [])

  const reset = useCallback(() => setT(INITIAL_T), [])

  // keyboard
  useEffect(() => {
    if (!src) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close()
        return
      }
      if (e.key === "+" || e.key === "=") {
        zoomBy(SCALE_BTN)
        return
      }
      if (e.key === "-") {
        zoomBy(-SCALE_BTN)
        return
      }
      if (e.key === "0") {
        reset()
        return
      }
      if (e.key === "r" || e.key === "R") {
        rotate()
        return
      }
      if (e.key === "ArrowLeft") setT((p) => ({ ...p, tx: p.tx - 40 }))
      else if (e.key === "ArrowRight") setT((p) => ({ ...p, tx: p.tx + 40 }))
      else if (e.key === "ArrowUp") setT((p) => ({ ...p, ty: p.ty - 40 }))
      else if (e.key === "ArrowDown") setT((p) => ({ ...p, ty: p.ty + 40 }))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [src, close, zoomBy, rotate, reset])

  // wheel zoom — must be non-passive to call preventDefault (prevents browser zoom)
  useEffect(() => {
    if (!src) return
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1 + SCALE_WHEEL : 1 - SCALE_WHEEL
      setT((p) => ({ ...p, scale: Math.max(SCALE_MIN, Math.min(SCALE_MAX, p.scale * factor)) }))
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [src])

  // touch pinch — non-passive to prevent browser pinch-zoom
  useEffect(() => {
    if (!src) return
    const el = containerRef.current
    if (!el) return
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      if (e.touches.length !== 2 || !pinchRef.current) return
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.hypot(dx, dy)
      const ratio = dist / pinchRef.current.dist0
      setT((p) => ({
        ...p,
        scale: Math.max(SCALE_MIN, Math.min(SCALE_MAX, pinchRef.current!.scale0 * ratio)),
      }))
    }
    el.addEventListener("touchmove", onTouchMove, { passive: false })
    return () => el.removeEventListener("touchmove", onTouchMove)
  }, [src])

  // pointer drag handlers
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      dragRef.current = {
        active: true,
        moved: false,
        startX: e.clientX,
        startY: e.clientY,
        tx0: t.tx,
        ty0: t.ty,
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      setIsDragging(true)
    },
    [t.tx, t.ty]
  )

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    if (!dragRef.current.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      dragRef.current.moved = true
    }
    setT((p) => ({ ...p, tx: dragRef.current.tx0 + dx, ty: dragRef.current.ty0 + dy }))
  }, [])

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const wasDrag = dragRef.current.moved
      dragRef.current.active = false
      dragRef.current.moved = false
      setIsDragging(false)
      // click-outside-to-close only when not a drag
      if (!wasDrag && e.target === e.currentTarget) close()
    },
    [close]
  )

  // touch start for pinch
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 2) return
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      pinchRef.current = { dist0: Math.hypot(dx, dy), scale0: t.scale }
    },
    [t.scale]
  )

  const onTouchEnd = useCallback(() => {
    pinchRef.current = null
  }, [])

  const download = () => {
    if (!src) return
    const a = document.createElement("a")
    a.href = src
    a.download = alt || "screenshot"
    a.click()
  }

  if (!src) return null

  const isTransformed = t.scale !== 1 || t.rotation !== 0 || t.tx !== 0 || t.ty !== 0

  return (
    <div
      className="fixed inset-0 z-9999 select-none"
      style={{ background: "rgba(0,0,0,0.88)" }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {/* top toolbar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 bg-linear-to-b from-black/70 to-transparent px-3 py-2">
        <span className="pointer-events-auto max-w-sm truncate font-mono text-[11px] text-white/50">
          {alt}
        </span>
        <div className="pointer-events-auto flex items-center gap-0.5">
          <span className="w-12 pr-1 text-right font-mono text-[10px] text-white/40 tabular-nums">
            {Math.round(t.scale * 100)}%
          </span>
          <TBtn onClick={() => zoomBy(-SCALE_BTN)} title="Zoom out (−)">
            <IcoZoomOut className="h-4 w-4" />
          </TBtn>
          <TBtn onClick={() => zoomBy(SCALE_BTN)} title="Zoom in (+)">
            <IcoZoomIn className="h-4 w-4" />
          </TBtn>
          <TBtn onClick={rotate} title="Rotate 90° (R)">
            <IcoRotate className="h-4 w-4" />
          </TBtn>
          <TBtn onClick={reset} title="Reset (0)" active={!isTransformed}>
            <IcoReset className="h-4 w-4" />
          </TBtn>
          <TBtn onClick={download} title="Download">
            <IcoDownload className="h-4 w-4" />
          </TBtn>
          <div className="mx-1 h-4 w-px bg-white/15" />
          <TBtn onClick={close} title="Close (Esc)">
            <IcoClose className="h-4 w-4" />
          </TBtn>
        </div>
      </div>

      {/* image container — fills viewport, handles all gestures */}
      <div
        ref={containerRef}
        className="absolute inset-0 flex items-center justify-center overflow-hidden"
        style={{
          touchAction: "none",
          cursor: isDragging ? "grabbing" : t.scale !== 1 ? "grab" : "zoom-out",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{
            transform: `translate(${t.tx}px, ${t.ty}px) rotate(${t.rotation}deg) scale(${t.scale})`,
            transformOrigin: "center",
            transition: isDragging ? "none" : "transform 0.1s ease-out",
            maxWidth: "90vw",
            maxHeight: "90vh",
            objectFit: "contain",
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
      </div>

      {/* keyboard hint bar */}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-4">
        {(
          [
            ["scroll", "zoom"],
            ["drag", "pan"],
            ["R", "rotate"],
            ["0", "reset"],
            ["Esc", "close"],
          ] as const
        ).map(([key, label]) => (
          <span key={key} className="flex items-center gap-1.5">
            <kbd className="rounded border border-white/20 bg-white/10 px-1 py-px font-mono text-[9px] text-white/55">
              {key}
            </kbd>
            <span className="font-mono text-[9px] text-white/35">{label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
