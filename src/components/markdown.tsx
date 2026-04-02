import * as React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { Image } from "@/components/ui/image"
import { cn } from "@/lib/utils"

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("text-sm leading-relaxed", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ className: pClassName, ...props }) => (
            <p className={cn("not-first:mt-2", pClassName)} {...props} />
          ),
          a: ({ className: aClassName, ...props }) => (
            <a
              className={cn("text-primary underline underline-offset-4", aClassName)}
              target="_blank"
              rel="noreferrer"
              {...props}
            />
          ),
          img: ({ className: imgClassName, alt, src, width, height, ...props }) =>
            typeof src === "string" && src.length > 0 ? (
              <Image
                className={cn(
                  "border-border my-3 h-auto max-w-full rounded-lg border shadow-sm",
                  imgClassName
                )}
                alt={alt ?? ""}
                src={src}
                width={typeof width === "number" ? width : undefined}
                height={typeof height === "number" ? height : undefined}
                unoptimized
                loading="lazy"
                {...props}
              />
            ) : null,
          ul: ({ className: ulClassName, ...props }) => (
            <ul className={cn("my-2 list-disc pl-5", ulClassName)} {...props} />
          ),
          ol: ({ className: olClassName, ...props }) => (
            <ol className={cn("my-2 list-decimal pl-5", olClassName)} {...props} />
          ),
          li: ({ className: liClassName, ...props }) => (
            <li className={cn("my-1", liClassName)} {...props} />
          ),
          blockquote: ({ className: bqClassName, ...props }) => (
            <blockquote
              className={cn("border-l-2 pl-3 italic opacity-90", bqClassName)}
              {...props}
            />
          ),
          hr: ({ className: hrClassName, ...props }) => (
            <hr className={cn("my-3 border-t", hrClassName)} {...props} />
          ),
          pre: ({ className: preClassName, ...props }) => (
            <pre
              className={cn(
                "bg-muted my-2 overflow-x-auto rounded-md border p-3 font-mono text-xs",
                preClassName
              )}
              {...props}
            />
          ),
          code: ({ className: codeClassName, children, ...props }) => {
            const isBlock = typeof codeClassName === "string" && codeClassName.includes("language-")
            return (
              <code
                className={cn(
                  !isBlock
                    ? "bg-muted rounded px-1 py-0.5 font-mono text-[0.85em]"
                    : "bg-transparent p-0 font-mono text-xs",
                  codeClassName
                )}
                {...props}
              >
                {children}
              </code>
            )
          },
          table: ({ className: tableClassName, ...props }) => (
            <div className="my-2 overflow-x-auto">
              <table className={cn("w-full border-collapse text-sm", tableClassName)} {...props} />
            </div>
          ),
          th: ({ className: thClassName, ...props }) => (
            <th className={cn("border px-2 py-1 text-left font-medium", thClassName)} {...props} />
          ),
          td: ({ className: tdClassName, ...props }) => (
            <td className={cn("border px-2 py-1 align-top", tdClassName)} {...props} />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
