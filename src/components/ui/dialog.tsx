"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import * as React from "react"

import { XMarkIcon } from "@/lib/icons"
import { cn } from "@/lib/utils"

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 outline-none sm:max-w-lg",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XMarkIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

// Responsive dialog shell with sticky header/footer and a single scrollable body.
// Works across iOS/Android/desktop, dark mode, and small screens.
type DialogShellProps = React.ComponentProps<typeof DialogContent> & {
  title?: React.ReactNode
  description?: React.ReactNode
  footer?: React.ReactNode
  bodyClassName?: string
  headerClassName?: string
  contentClassName?: string
  descriptionClassName?: string
  footerClassName?: string
  withSeparator?: boolean
}

function DialogShell({
  title,
  description,
  footer,
  children,
  className,
  bodyClassName,
  headerClassName,
  contentClassName,
  descriptionClassName,
  footerClassName,
  withSeparator = true,
  ...props
}: DialogShellProps) {
  const showDividers = withSeparator !== false

  return (
    <DialogContent
      {...props}
      className={cn("w-[96vw] overflow-hidden p-0 sm:w-auto sm:max-w-2xl", className)}
    >
      <div
        className={cn(
          "from-background via-background to-background/95 flex max-h-[min(92dvh,720px)] flex-col bg-linear-to-b",
          contentClassName
        )}
      >
        <DialogHeader
          className={cn(
            "bg-background/90 supports-backdrop-filter:bg-background/75 sticky top-0 z-20 px-6 py-4 text-left backdrop-blur",
            showDividers ? "border-border/60 border-b shadow-[0_1px_0_rgba(15,23,42,0.08)]" : null,
            headerClassName
          )}
        >
          {title ? <DialogTitle>{title}</DialogTitle> : null}
          {description ? (
            <DialogDescription className={cn("mt-1", descriptionClassName)}>
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <div className={cn("flex-1 overflow-y-auto", bodyClassName)}>{children}</div>

        {(footer ?? null) && (
          <DialogFooter
            className={cn(
              "bg-muted/40! supports-backdrop-filter:bg-background/75 sticky bottom-0 z-20 px-6 py-4 backdrop-blur",
              showDividers
                ? "border-border/60 border-t shadow-[0_-1px_0_rgba(15,23,42,0.08)]"
                : null,
              footerClassName
            )}
          >
            {footer}
          </DialogFooter>
        )}
      </div>
    </DialogContent>
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogShell,
  DialogTitle,
  DialogTrigger,
}
