"use client"

import * as SwitchPrimitive from "@radix-ui/react-switch"
import * as React from "react"

import { cn } from "@/lib/utils"

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-surface-5 focus-visible:outline-primary/40 inline-flex h-[18px] w-8 shrink-0 items-center rounded-full border border-transparent shadow-none transition-colors duration-150 ease-out outline-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-3.5 rounded-full bg-white ring-0 transition-transform duration-150 ease-out data-[state=checked]:translate-x-[14px] data-[state=unchecked]:translate-x-0.5"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
