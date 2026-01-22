import * as React from "react"
import TextareaAutosize from "react-textarea-autosize"

import { cn } from "@/lib/utils"

interface TextareaProps extends React.ComponentProps<"textarea"> {
  textareaSize?: "sm" | "md" | "lg"
  isAutoresize?: boolean
}

function Textarea({
  textareaSize = "md",
  isAutoresize,
  className,
  style,
  ...props
}: TextareaProps) {
  const sizeClasses = {
    sm: "min-h-[40px] text-sm px-2 py-1",
    md: "min-h-[60px] text-base px-3 py-2",
    lg: "min-h-[80px] text-lg px-4 py-3",
  }

  if (isAutoresize) {
    return (
      <TextareaAutosize
        data-slot="textarea"
        className={cn(
          "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          sizeClasses[textareaSize],
          className
        )}
        style={style as React.CSSProperties & { height?: number }}
        {...props}
      />
    )
  }
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        sizeClasses[textareaSize],
        className
      )}
      style={style}
      {...props}
    />
  )
}

export { Textarea }
