"use client"

import { AnimatePresence, motion } from "motion/react"
import type React from "react"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Torus } from "@/lib/icons"
import { cn } from "@/lib/utils"

export interface TourStep {
  content: React.ReactNode
  selectorId: string
  width?: number
  height?: number
  onClickWithinArea?: () => void
  position?: "top" | "bottom" | "left" | "right"
}

interface TargetRect {
  top: number
  left: number
  width: number
  height: number
}

interface TourContextType {
  currentStep: number
  totalSteps: number
  nextStep: () => void
  previousStep: () => void
  endTour: () => void
  isActive: boolean
  startTour: () => void
  restartTour: () => void
  steps: TourStep[]
}

interface TourProviderProps {
  children: React.ReactNode
  steps: TourStep[]
  className?: string
  onStart?: () => void
  onComplete?: () => void
  onSkip?: () => void
}

const TourContext = createContext<TourContextType | null>(null)

const SPOTLIGHT_PADDING = 10
const CONTENT_WIDTH = 220
const CONTENT_MIN_HEIGHT = 160

function getElementRect(step: TourStep | undefined): TargetRect | null {
  if (typeof document === "undefined") return null
  if (!step?.selectorId) return null
  const element = document.getElementById(step.selectorId)
  if (!element) return null

  const rect = element.getBoundingClientRect()
  return {
    top: Math.max(rect.top - SPOTLIGHT_PADDING, 8),
    left: Math.max(rect.left - SPOTLIGHT_PADDING, 8),
    width: Math.max((step.width ?? rect.width) + SPOTLIGHT_PADDING * 2, 24),
    height: Math.max((step.height ?? rect.height) + SPOTLIGHT_PADDING * 2, 24),
  }
}

function calculateContentPosition(
  targetRect: TargetRect | null,
  position: TourStep["position"] = "bottom"
): { top: number; left: number; width: number; minHeight: number } {
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800
  const width = Math.min(CONTENT_WIDTH, Math.max(viewportWidth - 24, 260))

  if (!targetRect) {
    return {
      top: Math.max((viewportHeight - CONTENT_MIN_HEIGHT) / 2, 24),
      left: Math.max((viewportWidth - width) / 2, 24),
      width,
      minHeight: CONTENT_MIN_HEIGHT,
    }
  }

  let top = targetRect.top
  let left = targetRect.left

  switch (position) {
    case "top":
      top = targetRect.top - CONTENT_MIN_HEIGHT - 20
      left = targetRect.left + targetRect.width / 2 - width / 2
      break
    case "left":
      top = targetRect.top + targetRect.height / 2 - CONTENT_MIN_HEIGHT / 2
      left = targetRect.left - width - 20
      break
    case "right":
      top = targetRect.top + targetRect.height / 2 - CONTENT_MIN_HEIGHT / 2
      left = targetRect.left + targetRect.width + 20
      break
    case "bottom":
    default:
      top = targetRect.top + targetRect.height + 20
      left = targetRect.left + targetRect.width / 2 - width / 2
      break
  }

  return {
    top: Math.max(24, Math.min(top, viewportHeight - CONTENT_MIN_HEIGHT - 24)),
    left: Math.max(24, Math.min(left, viewportWidth - width - 24)),
    width,
    minHeight: CONTENT_MIN_HEIGHT,
  }
}

export function TourProvider({
  children,
  steps,
  className,
  onStart,
  onComplete,
  onSkip,
}: TourProviderProps) {
  const [currentStep, setCurrentStep] = useState(-1)
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  const pendingLifecycleRef = useRef<"start" | "complete" | "skip" | null>(null)

  const activeStep = currentStep >= 0 ? steps[currentStep] : undefined

  const updateTargetRect = useCallback(() => {
    if (currentStep < 0) {
      setTargetRect(null)
      return
    }
    setTargetRect(getElementRect(steps[currentStep]))
  }, [currentStep, steps])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (currentStep >= steps.length && steps.length > 0) {
      setCurrentStep(steps.length - 1)
      return
    }
    if (steps.length === 0) {
      setCurrentStep(-1)
      setTargetRect(null)
    }
  }, [currentStep, steps.length])

  useEffect(() => {
    if (currentStep < 0) {
      setTargetRect(null)
      return
    }
    updateTargetRect()
    const handleLayoutChange = () => updateTargetRect()
    const intervalId = window.setInterval(handleLayoutChange, 250)
    window.addEventListener("resize", handleLayoutChange)
    window.addEventListener("scroll", handleLayoutChange, true)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener("resize", handleLayoutChange)
      window.removeEventListener("scroll", handleLayoutChange, true)
    }
  }, [currentStep, updateTargetRect])

  useEffect(() => {
    if (currentStep < 0 || !activeStep?.onClickWithinArea) return
    const handleClick = (event: MouseEvent) => {
      const rect = getElementRect(activeStep)
      if (!rect) return
      const withinBounds =
        event.clientX >= rect.left &&
        event.clientX <= rect.left + rect.width &&
        event.clientY >= rect.top &&
        event.clientY <= rect.top + rect.height
      if (withinBounds) activeStep.onClickWithinArea?.()
    }
    window.addEventListener("click", handleClick)
    return () => window.removeEventListener("click", handleClick)
  }, [activeStep, currentStep])

  useEffect(() => {
    const pendingLifecycle = pendingLifecycleRef.current
    if (!pendingLifecycle) return
    pendingLifecycleRef.current = null
    if (pendingLifecycle === "start") {
      onStart?.()
      return
    }
    if (pendingLifecycle === "complete") {
      onComplete?.()
      return
    }
    onSkip?.()
  }, [currentStep, onComplete, onSkip, onStart])

  const nextStep = useCallback(() => {
    if (currentStep >= steps.length - 1) {
      pendingLifecycleRef.current = "complete"
      setCurrentStep(-1)
      return
    }
    setCurrentStep(currentStep + 1)
  }, [currentStep, steps.length])

  const previousStep = useCallback(() => {
    setCurrentStep((prev) => (prev > 0 ? prev - 1 : prev))
  }, [])

  const endTour = useCallback(() => {
    setCurrentStep(-1)
  }, [])

  const startTour = useCallback(() => {
    if (steps.length === 0) return
    pendingLifecycleRef.current = "start"
    setCurrentStep(0)
  }, [steps.length])

  const restartTour = useCallback(() => {
    if (steps.length === 0) return
    pendingLifecycleRef.current = "start"
    setCurrentStep(0)
  }, [steps.length])

  const skipTour = useCallback(() => {
    pendingLifecycleRef.current = "skip"
    setCurrentStep(-1)
  }, [])

  const contentPosition = useMemo(() => {
    if (!isMounted) {
      return { top: 24, left: 24, width: CONTENT_WIDTH, minHeight: CONTENT_MIN_HEIGHT }
    }
    return calculateContentPosition(targetRect, activeStep?.position)
  }, [activeStep?.position, isMounted, targetRect])

  return (
    <TourContext.Provider
      value={{
        currentStep,
        totalSteps: steps.length,
        nextStep,
        previousStep,
        endTour,
        isActive: currentStep >= 0,
        startTour,
        restartTour,
        steps,
      }}
    >
      {children}
      <AnimatePresence>
        {isMounted && currentStep >= 0 && (
          <>
            {!targetRect ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none fixed inset-0 z-50 bg-black/70"
              />
            ) : null}

            {targetRect ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className={cn(
                  "border-primary pointer-events-none fixed z-60 rounded-xl border-4 shadow-[0_0_0_9999px_rgba(0,0,0,0.7)]",
                  className
                )}
                style={{
                  top: targetRect.top,
                  left: targetRect.left,
                  width: targetRect.width,
                  height: targetRect.height,
                }}
              />
            ) : null}

            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="fixed z-70"
              style={{
                top: contentPosition.top,
                left: contentPosition.left,
                width: contentPosition.width,
              }}
            >
              <div className="bg-surface-3 border-border rounded-xl border p-4 shadow-none">
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.16em] uppercase">
                      {currentStep + 1} / {steps.length}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={skipTour}
                    className="text-muted-foreground/60 hover:text-muted-foreground text-xs font-medium transition-colors"
                  >
                    Skip
                  </button>
                </div>

                <div className="min-h-24">
                  {activeStep?.content}
                  {!targetRect ? (
                    <p className="text-muted-foreground/50 mt-3 text-xs">
                      Waiting for this section to appear. If it stays hidden, you can skip and
                      restart the tour later.
                    </p>
                  ) : null}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={previousStep}
                    disabled={currentStep === 0}
                  >
                    Previous
                  </Button>
                  <Button type="button" size="sm" onClick={nextStep}>
                    {currentStep === steps.length - 1 ? "Finish" : "Next"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </TourContext.Provider>
  )
}

export function useTour() {
  const context = useContext(TourContext)
  if (!context) throw new Error("useTour must be used within a TourProvider")
  return context
}

export function TourAlertDialog({
  isOpen,
  setIsOpen,
  onStart,
  onSkip,
  title = "Take a quick tour",
  description = "Walk through the key parts of this workspace and learn where everything lives.",
}: {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  onStart?: () => void
  onSkip?: () => void
  title?: string
  description?: string
}) {
  const { currentStep, startTour, steps } = useTour()

  if (!isOpen || steps.length === 0 || currentStep >= 0) return null

  const handleStart = () => {
    setIsOpen(false)
    onStart?.()
    startTour()
  }

  const handleSkip = () => {
    setIsOpen(false)
    onSkip?.()
  }

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="max-w-md rounded-xl p-6">
        <AlertDialogHeader className="flex flex-col items-center justify-center">
          <div className="relative mx-auto mb-4">
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
              <Torus className="text-primary size-16" />
            </motion.div>
          </div>
          <AlertDialogTitle className="w-full text-center text-xl font-semibold tracking-tight">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground mt-2 text-center text-sm leading-6">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="mt-6 space-y-3">
          <Button onClick={handleStart} className="w-full">
            Start tour
          </Button>
          <Button onClick={handleSkip} variant="ghost" className="w-full">
            Not now
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
