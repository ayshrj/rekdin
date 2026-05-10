"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

import { Loader } from "@/lib/icons"
import {
  CheckCircleIcon,
  ExclamationCircleIcon as TriangleAlertIcon,
  InformationCircleIcon as InfoIcon,
  XMarkBadgeIcon as OctagonXIcon,
} from "@/lib/icons"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      richColors
      className="toaster group"
      icons={{
        success: <CheckCircleIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "0.5rem",
          "--width": "300px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "border-border bg-surface-5 text-foreground shadow-none",
          title: "text-foreground text-sm font-medium",
          description: "text-muted-foreground text-xs",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-surface-4 text-muted-foreground",
          closeButton: "bg-surface-4 text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
