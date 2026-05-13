import { z } from "zod"

import { boundedLimit } from "../shared/formatting"
import { toolDefinition } from "../shared/tool-base"
import { goto, screenshotDataUrl, withTemporaryPage } from "./browser-core"

export const screenshotCompareTool = toolDefinition(
  "screenshot_compare",
  "Capture two URLs or screenshots and return visual comparison metadata.",
  z.object({
    beforeUrl: z.string().url().optional(),
    afterUrl: z.string().url().optional(),
    url: z.string().url().optional(),
  }),
  async ({ beforeUrl, afterUrl, url }) => {
    const first = beforeUrl ?? url
    const second = afterUrl ?? url
    if (!first || !second) throw new Error("Provide url or beforeUrl/afterUrl")
    const before = await withTemporaryPage(async (page) => {
      await goto(page, first)
      return screenshotDataUrl(page, true)
    })
    const after = await withTemporaryPage(async (page) => {
      await goto(page, second)
      return screenshotDataUrl(page, true)
    })
    return {
      type: "screenshot_compare",
      before,
      after,
      mismatchPercent: first === second ? 0 : undefined,
      url: second,
    }
  }
)

export const pageVisualAuditTool = toolDefinition(
  "page_visual_audit",
  "Use screenshot plus DOM heuristics to audit spacing, overflow, clipping, and hidden buttons.",
  z.object({ url: z.string().url() }),
  async ({ url }) =>
    withTemporaryPage(async (page) => {
      await goto(page, url, "networkidle0")
      const screenshot = await screenshotDataUrl(page, true)
      const findings = await page.evaluate(() => {
        const rows: Array<Record<string, unknown>> = []
        for (const el of Array.from(
          document.querySelectorAll("button,a,input,textarea,select")
        ).slice(0, 300)) {
          const rect = el.getBoundingClientRect()
          if (rect.width === 0 || rect.height === 0)
            rows.push({
              severity: "warning",
              message: "Interactive element has zero-size box",
              selector: el.tagName.toLowerCase(),
            })
          if (rect.right > window.innerWidth || rect.left < 0)
            rows.push({
              severity: "warning",
              message: "Interactive element overflows viewport",
              selector: el.tagName.toLowerCase(),
            })
        }
        return rows
      })
      return { type: "page_visual_audit", url, screenshot, findings }
    })
)

export const responsiveScreenshotMatrixTool = toolDefinition(
  "responsive_screenshot_matrix",
  "Capture screenshots at common responsive breakpoints.",
  z.object({ url: z.string().url(), fullPage: z.boolean().optional().default(true) }),
  async ({ url, fullPage }) => {
    const viewports = [
      { label: "mobile", width: 375, height: 812 },
      { label: "tablet", width: 768, height: 1024 },
      { label: "desktop", width: 1024, height: 768 },
      { label: "wide", width: 1440, height: 900 },
    ]
    const screenshots = []
    for (const viewport of viewports) {
      screenshots.push(
        await withTemporaryPage(async (page) => {
          await page.setViewport(viewport)
          await goto(page, url, "networkidle0")
          return { ...viewport, screenshot: await screenshotDataUrl(page, fullPage) }
        })
      )
    }
    return { type: "responsive_screenshot_matrix", url, screenshots }
  }
)

export const domLayoutBoxMapTool = toolDefinition(
  "dom_layout_box_map",
  "Return bounding boxes for matching DOM elements.",
  z.object({
    url: z.string().url(),
    selector: z.string().default("body *"),
    limit: z.number().int().optional(),
  }),
  async ({ url, selector, limit }) =>
    withTemporaryPage(async (page) => {
      await goto(page, url, "networkidle0")
      const max = boundedLimit(limit, 100, 500)
      const boxes = await page.evaluate(
        ({ selector: sel, max: maxItems }) =>
          Array.from(document.querySelectorAll(sel))
            .slice(0, maxItems)
            .map((el) => {
              const rect = el.getBoundingClientRect()
              return {
                tag: el.tagName.toLowerCase(),
                text: el.textContent?.trim().slice(0, 80),
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
              }
            }),
        { selector, max }
      )
      return { type: "dom_layout_box_map", url, selector, boxes }
    })
)

export const cssComputedStyleExtractTool = toolDefinition(
  "css_computed_style_extract",
  "Extract computed CSS styles for a selector.",
  z.object({ url: z.string().url(), selector: z.string().min(1) }),
  async ({ url, selector }) =>
    withTemporaryPage(async (page) => {
      await goto(page, url, "networkidle0")
      const styles = await page.evaluate((sel) => {
        const el = document.querySelector(sel)
        if (!el) return null
        const s = getComputedStyle(el)
        return {
          display: s.display,
          position: s.position,
          overflow: s.overflow,
          zIndex: s.zIndex,
          padding: s.padding,
          margin: s.margin,
          fontSize: s.fontSize,
          lineHeight: s.lineHeight,
          color: s.color,
          backgroundColor: s.backgroundColor,
        }
      }, selector)
      return { type: "css_computed_style_extract", url, selector, styles }
    })
)
