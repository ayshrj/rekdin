"use client"

import { useTheme } from "next-themes"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Moon, Sun } from "@/lib/icons"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const toggleTheme = React.useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark")
  }, [setTheme, theme])

  return (
    <Button variant="ghost" size="icon" onClick={toggleTheme} className="rk-icon-button">
      <Sun className="h-4 w-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute h-4 w-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
