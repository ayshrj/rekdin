import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-border bg-surface-4 text-foreground placeholder:text-muted-foreground selection:bg-primary/35 file:text-foreground h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base shadow-none transition-colors duration-150 ease-out outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 md:text-sm",
        "focus-visible:border-primary/50 focus-visible:ring-0",
        "aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
