import { tool } from "@langchain/core/tools"
import { z } from "zod"

import { storeArtifact } from "../../artifact-store"
import { fetchBuffer } from "../pdf/pdf-core"
import { truncateString } from "../shared/formatting"
import { loadSharp, loadTesseract } from "../shared/loaders"
import { readWorkspaceText } from "../workspace/workspace-fs"
import { collectWorkspaceFiles } from "../workspace/workspace-fs"

/**
 * Reads basic image metadata such as width, height, format, and byte size.
 */
export const imageInfoTool = tool(
  async ({ source }) => {
    const sharp = await loadSharp()
    if (!sharp) {
      return {
        type: "image_info",
        error: "Image tooling requires `sharp`. Install with `npm install sharp`.",
      }
    }
    const buf = await fetchBuffer(source)
    const meta = await sharp(buf).metadata()
    return {
      type: "image_info",
      width: meta.width,
      height: meta.height,
      format: meta.format,
      size: buf.length,
    }
  },
  {
    name: "image_info",
    description: "Get basic image metadata (requires `sharp`).",
    schema: z.object({ source: z.string().min(1) }),
  }
)

/**
 * Converts an image to PNG, JPEG, or WebP and stores the result as an artifact.
 */
export const imageConvertTool = tool(
  async ({ source, format }) => {
    const sharp = await loadSharp()
    if (!sharp) {
      return {
        type: "image_convert",
        error: "Image tooling requires `sharp`. Install with `npm install sharp`.",
      }
    }
    const buf = await fetchBuffer(source)
    const converted = await sharp(buf)[format as "png" | "jpeg" | "webp"]().toBuffer()
    const extension = format === "jpeg" ? "jpg" : format
    const artifact = await storeArtifact({
      filename: `image-convert-${Date.now()}.${extension}`,
      bytes: converted,
      mimeType: `image/${format}`,
    })
    return {
      type: "image_convert",
      format,
      size: converted.length,
      artifact,
      artifactUrl: artifact.url,
    }
  },
  {
    name: "image_convert",
    description: "Convert an image to png/jpg/webp (requires `sharp`).",
    schema: z.object({ source: z.string().min(1), format: z.enum(["png", "jpeg", "webp"]) }),
  }
)

export const imageExifTool = tool(
  async ({ source }) => {
    const sharp = await loadSharp()
    if (!sharp) return { type: "image_exif", error: "Image tooling requires `sharp`." }
    const buf = await fetchBuffer(source)
    const meta = await sharp(buf).metadata()
    return {
      type: "image_exif",
      width: meta.width,
      height: meta.height,
      format: meta.format,
      space: meta.space,
      density: meta.density,
      hasAlpha: meta.hasAlpha,
      orientation: meta.orientation,
      exifBytes: meta.exif?.length ?? 0,
      iccBytes: meta.icc?.length ?? 0,
    }
  },
  {
    name: "image_exif",
    description: "Read image metadata and EXIF/ICC byte presence.",
    schema: z.object({ source: z.string().min(1) }),
  }
)

export const imageOcrTool = tool(
  async ({ source, language }) => {
    const tesseract = await loadTesseract()
    if (!tesseract?.createWorker) {
      return {
        type: "image_ocr",
        error: "OCR tooling requires optional dependency `tesseract.js`.",
      }
    }

    const worker = await tesseract.createWorker(language ?? "eng")
    try {
      const bytes = await fetchBuffer(source)
      const result = await worker.recognize(bytes)
      const data = result?.data ?? {}
      return {
        type: "image_ocr",
        language: language ?? "eng",
        confidence: data.confidence ?? null,
        text: truncateString(String(data.text ?? ""), 12000),
        lines: Array.isArray(data.lines)
          ? data.lines.slice(0, 80).map((line: { text?: string; confidence?: number }) => ({
              text: truncateString(String(line.text ?? ""), 500),
              confidence: line.confidence ?? null,
            }))
          : [],
      }
    } finally {
      await worker.terminate()
    }
  },
  {
    name: "image_ocr",
    description:
      "Extract text from a remote or data URL image using optional local OCR support (`tesseract.js`).",
    schema: z.object({
      source: z.string().min(1),
      language: z.string().min(2).max(20).optional(),
    }),
  }
)

export const imageDiffTool = tool(
  async ({ before, after }) => {
    const sharp = await loadSharp()
    if (!sharp) return { type: "image_diff", error: "Image tooling requires `sharp`." }
    const beforeImage = sharp(await fetchBuffer(before))
      .resize(256, 256, { fit: "contain", background: "white" })
      .raw()
    const afterImage = sharp(await fetchBuffer(after))
      .resize(256, 256, { fit: "contain", background: "white" })
      .raw()
    const [beforeBuffer, afterBuffer] = await Promise.all([
      beforeImage.toBuffer(),
      afterImage.toBuffer(),
    ])
    const length = Math.min(beforeBuffer.length, afterBuffer.length)
    let changed = 0
    let totalDelta = 0
    for (let index = 0; index < length; index += 1) {
      const delta = Math.abs(beforeBuffer[index] - afterBuffer[index])
      totalDelta += delta
      if (delta > 12) changed += 1
    }
    return {
      type: "image_diff",
      comparedBytes: length,
      changedBytes: changed,
      changedRatio: length ? changed / length : 0,
      averageDelta: length ? totalDelta / length : 0,
    }
  },
  {
    name: "image_diff",
    description: "Compute a lightweight pixel difference between two images.",
    schema: z.object({ before: z.string().min(1), after: z.string().min(1) }),
  }
)

export const svgOptimizeTool = tool(
  async ({ path: filePath, svg }) => {
    const input = svg ?? (await readWorkspaceText(filePath!))
    const optimized = input
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/>\s+</g, "><")
      .replace(/\s{2,}/g, " ")
      .trim()
    return {
      type: "svg_optimize",
      path: filePath,
      originalBytes: Buffer.byteLength(input),
      optimizedBytes: Buffer.byteLength(optimized),
      optimized,
    }
  },
  {
    name: "svg_optimize",
    description: "Minify SVG text without changing files.",
    schema: z
      .object({ path: z.string().optional(), svg: z.string().optional() })
      .refine((value) => value.path || value.svg, { message: "Provide path or svg" }),
  }
)

export const assetManifestTool = tool(
  async ({ path: inputPath }) => {
    const { files } = await collectWorkspaceFiles({
      path: inputPath,
      maxFiles: 3000,
      extensions: [
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".gif",
        ".svg",
        ".ico",
        ".woff",
        ".woff2",
        ".ttf",
        ".otf",
      ],
    })
    return {
      type: "asset_manifest",
      assets: files.map(({ path, size, modified }) => ({ path, size, modified })).slice(0, 1000),
      count: files.length,
    }
  },
  {
    name: "asset_manifest",
    description: "List image/font/static assets in the workspace.",
    schema: z.object({ path: z.string().optional() }),
  }
)

export const imageResizeTool = tool(
  async ({
    source,
    width,
    height,
    fit = "inside",
  }: {
    source: string
    width?: number
    height?: number
    fit?: "cover" | "contain" | "fill" | "inside" | "outside"
  }) => {
    const sharp = await loadSharp()
    if (!sharp) return { type: "image_resize", error: "Image tooling requires `sharp`." }
    const buf = await fetchBuffer(source)
    const meta = await sharp(buf).metadata()
    const resized = await sharp(buf).resize(width, height, { fit }).png().toBuffer()
    const artifact = await storeArtifact({
      filename: `image-resize-${Date.now()}.png`,
      bytes: resized,
      mimeType: "image/png",
    })
    return {
      type: "image_resize",
      originalWidth: meta.width,
      originalHeight: meta.height,
      targetWidth: width,
      targetHeight: height,
      fit,
      size: resized.length,
      artifact,
      artifactUrl: artifact.url,
    }
  },
  {
    name: "image_resize",
    description: "Resize an image (URL, data URI, or workspace path) and return as an artifact.",
    schema: z.object({
      source: z.string().min(1),
      width: z.number().int().min(1).max(8000).optional(),
      height: z.number().int().min(1).max(8000).optional(),
      fit: z.enum(["cover", "contain", "fill", "inside", "outside"]).optional(),
    }),
  }
)

export const imageCropTool = tool(
  async ({
    source,
    left,
    top,
    width,
    height,
  }: {
    source: string
    left: number
    top: number
    width: number
    height: number
  }) => {
    const sharp = await loadSharp()
    if (!sharp) return { type: "image_crop", error: "Image tooling requires `sharp`." }
    const buf = await fetchBuffer(source)
    const meta = await sharp(buf).metadata()
    const cropped = await sharp(buf).extract({ left, top, width, height }).png().toBuffer()
    const artifact = await storeArtifact({
      filename: `image-crop-${Date.now()}.png`,
      bytes: cropped,
      mimeType: "image/png",
    })
    return {
      type: "image_crop",
      originalWidth: meta.width,
      originalHeight: meta.height,
      region: { left, top, width, height },
      size: cropped.length,
      artifact,
      artifactUrl: artifact.url,
    }
  },
  {
    name: "image_crop",
    description: "Crop an image to a specified region (left, top, width, height).",
    schema: z.object({
      source: z.string().min(1),
      left: z.number().int().min(0),
      top: z.number().int().min(0),
      width: z.number().int().min(1),
      height: z.number().int().min(1),
    }),
  }
)
