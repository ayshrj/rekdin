"use client"

import { useTheme } from "next-themes"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Moon, Sun } from "@/lib/icons"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    const handler = (e: Event) => {
      const { action, payload } = (
        e as CustomEvent<{ action: string; payload?: Record<string, unknown> }>
      ).detail
      if (action === "set_theme" && typeof payload?.theme === "string") {
        setTheme(payload.theme)
      }
    }
    window.addEventListener("rekdin:ui-action", handler)
    return () => window.removeEventListener("rekdin:ui-action", handler)
  }, [setTheme])

  const toggleTheme = React.useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }, [resolvedTheme, setTheme])

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        disabled
        aria-label="Toggle theme"
        className="rk-icon-button opacity-70"
      >
        <Sun className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggleTheme} className="rk-icon-button">
      <Sun className="h-4 w-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute h-4 w-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
