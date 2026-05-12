import * as React from "react"

import {
  SafariIconBack,
  SafariIconForward,
  SafariIconLock,
  SafariIconPlus,
  SafariIconRefresh,
  SafariIconShare,
  SafariIconShield,
  SafariIconSidebar,
  SafariIconTabs,
} from "@/lib/icons"

type SafariMockupProps = {
  /** If not provided, it will use window.location.href on the client */
  url?: string
  defaultUrl?: string
  /** Optional: control what gets displayed in the address bar */
  formatUrl?: (url: string) => string
  className?: string
  contentClassName?: string
  children?: React.ReactNode
}

export function SafariMockup({
  url,
  defaultUrl = "shadcn.io",
  formatUrl,
  className = "",
  contentClassName = "",
  children,
}: SafariMockupProps) {
  const raw = url ?? defaultUrl
  const display = formatUrl ? formatUrl(raw) : raw

  return (
    <div
      className={[
        "w-full overflow-hidden rounded-2xl",
        "bg-[#E5E5E5] dark:bg-[#404040]",
        "border border-black/10 dark:border-white/10",
        className,
      ].join(" ")}
    >
      {/* Top chrome */}
      <div className="h-13">
        <div className="flex h-full w-full items-center gap-3 rounded-t-xl bg-white px-3 dark:bg-[#262626]">
          {/* mac dots */}
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#E5E5E5] dark:bg-[#404040]" />
            <span className="h-3 w-3 rounded-full bg-[#E5E5E5] dark:bg-[#404040]" />
            <span className="h-3 w-3 rounded-full bg-[#E5E5E5] dark:bg-[#404040]" />
          </div>

          {/* left controls */}
          <div className="ml-2 flex items-center gap-3">
            <SafariIconSidebar />
            <SafariIconBack />
            <SafariIconForward />
          </div>

          {/* address area */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <SafariIconShield />

            <div className="min-w-0 flex-1">
              <div className="flex h-7 min-w-0 items-center gap-2 rounded-md bg-[#E5E5E5] px-3 dark:bg-[#404040]">
                <SafariIconLock />
                <span className="truncate text-xs text-[#A3A3A3]">{display}</span>
              </div>
            </div>

            <SafariIconRefresh />
          </div>

          {/* right controls */}
          <div className="ml-2 flex items-center gap-3">
            <SafariIconShare />
            <SafariIconPlus />
            <SafariIconTabs />
          </div>
        </div>
      </div>

      {/* content area */}
      <div className={["p-4", contentClassName].join(" ")}>{children}</div>
    </div>
  )
}
