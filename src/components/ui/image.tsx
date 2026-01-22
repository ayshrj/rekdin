// Image.tsx
import * as React from "react"

type LoaderArgs = {
  src: string
  width: number
  quality?: number
}

export type ImageProps = Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  "src" | "srcSet" | "sizes" | "loading" | "width" | "height"
> & {
  src: string
  alt: string

  /** Provide either width+height OR fill */
  width?: number
  height?: number
  fill?: boolean

  /** Responsive behavior */
  sizes?: string
  widths?: number[] // used to build srcSet (if not unoptimized)
  quality?: number
  loader?: (args: LoaderArgs) => string
  unoptimized?: boolean

  /** Next-like flags */
  priority?: boolean // preload + eager + high fetchPriority
  loading?: "lazy" | "eager" // defaults to "lazy" unless priority
  placeholder?: "blur" | "empty"
  blurDataURL?: string

  /** If true, delay setting src/srcSet until in/near viewport (CSR only). */
  useIntersectionObserver?: boolean
  rootMargin?: string // e.g. "300px"
}

const DEFAULT_WIDTHS = [320, 420, 640, 750, 828, 1080, 1200, 1920, 2048, 3840]

function defaultLoader({ src }: LoaderArgs) {
  return src
}

function buildSrcSet(
  src: string,
  widths: number[],
  quality: number | undefined,
  loader: (args: LoaderArgs) => string
) {
  return widths.map((w) => `${loader({ src, width: w, quality })} ${w}w`).join(", ")
}

function pickPreloadHref(
  src: string,
  width: number | undefined,
  quality: number | undefined,
  widths: number[],
  loader: (args: LoaderArgs) => string
) {
  // If fixed width provided, preload that. Otherwise preload a sensible mid/high size.
  const target =
    width ??
    widths[Math.min(widths.length - 1, widths.indexOf(1200) >= 0 ? widths.indexOf(1200) : 5)]
  return loader({ src, width: target, quality })
}

function ensurePreloadLink(opts: {
  key: string
  href: string
  imagesrcset?: string
  imagesizes?: string
  crossOrigin?: string
  referrerPolicy?: string
}) {
  if (typeof document === "undefined") return

  const id = `react-image-preload:${opts.key}`
  if (document.getElementById(id)) return

  const link = document.createElement("link")
  link.id = id
  link.rel = "preload"
  link.as = "image"
  link.href = opts.href

  // These properties improve preload for responsive images in supporting browsers.
  if (opts.imagesrcset) link.setAttribute("imagesrcset", opts.imagesrcset)
  if (opts.imagesizes) link.setAttribute("imagesizes", opts.imagesizes)

  if (opts.crossOrigin) link.crossOrigin = opts.crossOrigin
  if (opts.referrerPolicy) link.referrerPolicy = opts.referrerPolicy

  document.head.appendChild(link)
}

export const Image = React.forwardRef<HTMLImageElement, ImageProps>(function Image(
  {
    src,
    alt,
    width,
    height,
    fill,

    sizes,
    widths = DEFAULT_WIDTHS,
    quality,
    loader = defaultLoader,
    unoptimized,

    priority,
    loading: loadingProp,
    placeholder = "empty",
    blurDataURL,

    useIntersectionObserver = true,
    rootMargin = "300px",

    style,
    className,
    crossOrigin,
    referrerPolicy,

    onLoad,
    ...imgProps
  },
  ref
) {
  const isBrowser = typeof window !== "undefined"
  const [loaded, setLoaded] = React.useState(false)
  const [shouldLoad, setShouldLoad] = React.useState(() => {
    // For SSR or priority images, render with src immediately.
    if (!isBrowser) return true
    if (priority) return true
    if (loadingProp === "eager") return true
    return !useIntersectionObserver // if not using IO, let browser handle loading="lazy"
  })

  const effectiveLoading: "lazy" | "eager" = priority ? "eager" : (loadingProp ?? "lazy")
  const fetchPriority = priority ? "high" : undefined

  const imgSrc = shouldLoad ? loader({ src, width: width ?? widths[0], quality }) : undefined

  const imgSrcSet =
    !unoptimized && shouldLoad ? buildSrcSet(src, widths, quality, loader) : undefined

  // Prevent CLS:
  // - if width+height => wrapper uses aspect-ratio
  // - if fill => wrapper must have its own dimensions (via parent styling)
  const wrapperStyle: React.CSSProperties = fill
    ? { position: "relative", display: "block", ...style }
    : {
        position: "relative",
        display: "block",
        ...(width && height ? { aspectRatio: `${width} / ${height}` } : null),
        ...style,
      }

  const imgStyle: React.CSSProperties = fill
    ? {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        objectFit: (style as any)?.objectFit ?? "cover",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        objectPosition: (style as any)?.objectPosition,
      }
    : {
        width: "100%",
        height: "100%",
        display: "block",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        objectFit: (style as any)?.objectFit,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        objectPosition: (style as any)?.objectPosition,
      }

  // IntersectionObserver: delay setting src/srcSet until near viewport (CSR).
  const wrapperRef = React.useRef<HTMLSpanElement | null>(null)
  React.useEffect(() => {
    if (!isBrowser) return
    if (shouldLoad) return
    if (!useIntersectionObserver) return

    const el = wrapperRef.current
    if (!el) return

    if (!("IntersectionObserver" in window)) {
      setShouldLoad(true)
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShouldLoad(true)
            io.disconnect()
            break
          }
        }
      },
      { root: null, rootMargin }
    )

    io.observe(el)
    return () => io.disconnect()
  }, [isBrowser, shouldLoad, useIntersectionObserver, rootMargin])

  // Preload for LCP candidates
  React.useEffect(() => {
    if (!priority) return

    const href = pickPreloadHref(src, width, quality, widths, loader)
    const imagesrcset = !unoptimized ? buildSrcSet(src, widths, quality, loader) : undefined

    ensurePreloadLink({
      key: `${src}|${sizes ?? ""}|${width ?? ""}|${height ?? ""}`,
      href,
      imagesrcset,
      imagesizes: sizes,
      crossOrigin: typeof crossOrigin === "string" ? crossOrigin : undefined,
      referrerPolicy,
    })
  }, [
    priority,
    src,
    sizes,
    width,
    height,
    quality,
    widths,
    loader,
    unoptimized,
    crossOrigin,
    referrerPolicy,
  ])

  const showBlur = placeholder === "blur" && !!blurDataURL && !loaded

  return (
    <span ref={wrapperRef} className={className} style={wrapperStyle}>
      {showBlur ? (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url("${blurDataURL}")`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(16px)",
            transform: "scale(1.05)",
            transition: "opacity 200ms ease",
            opacity: loaded ? 0 : 1,
          }}
        />
      ) : null}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        {...imgProps}
        ref={ref}
        alt={alt}
        src={imgSrc}
        srcSet={imgSrcSet}
        sizes={sizes}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        loading={effectiveLoading}
        // TS might complain depending on DOM lib; cast is safe for modern browsers.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fetchPriority={fetchPriority as any}
        decoding="async"
        style={{
          ...imgStyle,
          // fade-in like Next placeholder behavior
          transition: "opacity 200ms ease",
          opacity: loaded ? 1 : 0,
        }}
        crossOrigin={crossOrigin}
        referrerPolicy={referrerPolicy}
        onLoad={(e) => {
          setLoaded(true)
          onLoad?.(e)
        }}
      />
    </span>
  )
})
