import { tool } from "@langchain/core/tools"
import { Readability } from "@mozilla/readability"
import { mkdtemp, readdir, readFile, rm, stat } from "fs/promises"
import { JSDOM } from "jsdom"
import os from "os"
import path from "path"
import TurndownService from "turndown"
import { z } from "zod"

import { storeArtifact } from "../../artifact-store"
import { truncateString } from "../shared/formatting"
import {
  centerOfSelector,
  goto,
  screenshotArtifact,
  screenshotDataUrl,
  withPage,
  withTemporaryPage,
} from "./browser-core"

const turndown = new TurndownService({ headingStyle: "atx" })

/**
 * Navigates the session browser to a URL and returns load metadata for the timeline.
 */
export const browserNavigateTool = tool(
  async ({ url }) => {
    const steps: Array<Record<string, unknown>> = []
    const result = await withPage(async (page) => {
      const started = Date.now()
      steps.push({ label: "Start", detail: `Navigating to ${url}`, at: new Date().toISOString() })
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 })
      const title = await page.title()
      steps.push({
        label: "Loaded",
        detail: `DOM content loaded (status ${response?.status() ?? "n/a"})`,
        at: new Date().toISOString(),
      })
      return {
        url: page.url(),
        status: response?.status() ?? null,
        title,
        duration: Date.now() - started,
        type: "browser_navigate",
        steps,
      }
    })
    return result
  },
  {
    name: "browser_navigate",
    description: "Navigate a headless browser to a URL.",
    schema: z.object({ url: z.string().url() }),
  }
)

/**
 * Loads a page in the browser and extracts readable Markdown from the rendered DOM.
 */
export const browserGetMarkdownTool = tool(
  async ({ url, pageNumber }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      const steps: Array<Record<string, unknown>> = []
      steps.push({ label: "Start", detail: `Loading ${url}`, at: new Date().toISOString() })
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 })
      steps.push({
        label: "Loaded",
        detail: "DOM ready, extracting readable content",
        at: new Date().toISOString(),
      })
      const html = await page.content()
      const dom = new JSDOM(html, { url })
      const reader = new Readability(dom.window.document)
      const article = reader.parse()
      const markdown = article?.content
        ? turndown.turndown(article.content)
        : turndown.turndown(html)
      const content = markdown
      return {
        url: page.url(),
        title: article?.title ?? dom.window.document.title ?? "Untitled",
        markdown: content,
        type: "browser_get_markdown",
        duration: Date.now() - started,
        pageNumber: pageNumber ?? 1,
        steps,
      }
    })
  },
  {
    name: "browser_get_markdown",
    description: "Get readable markdown from the current page.",
    schema: z.object({ url: z.string().url(), pageNumber: z.number().int().optional() }),
  }
)

/**
 * Captures a viewport screenshot after a page reaches network idle.
 */
export const browserScreenshotTool = tool(
  async ({ url }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      const steps: Array<Record<string, unknown>> = []
      steps.push({ label: "Start", detail: `Loading ${url}`, at: new Date().toISOString() })
      await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 })
      steps.push({
        label: "Loaded",
        detail: "Network idle, capturing screenshot",
        at: new Date().toISOString(),
      })
      const screenshot = await screenshotDataUrl(page, false)
      const title = await page.title()
      return {
        url: page.url(),
        title,
        screenshot,
        type: "browser_screenshot",
        duration: Date.now() - started,
        steps,
      }
    })
  },
  {
    name: "browser_screenshot",
    description: "Capture a viewport screenshot of a page.",
    schema: z.object({ url: z.string().url() }),
  }
)

/**
 * Clicks a page element by CSS selector or coordinates and returns a screenshot.
 */
export const browserClickTool = tool(
  async ({ url, selector, x, y, button, clickCount }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      await goto(page, url, "domcontentloaded")
      let clickX = typeof x === "number" ? x : null
      let clickY = typeof y === "number" ? y : null
      if ((!clickX || !clickY) && selector) {
        const center = await centerOfSelector(page, selector)
        clickX = center?.x ?? null
        clickY = center?.y ?? null
      }
      if (typeof clickX === "number" && typeof clickY === "number") {
        await page.mouse.click(clickX, clickY, {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          button: (button ?? "left") as any,
          clickCount: clickCount ?? 1,
        })
      } else if (selector) {
        await page.click(selector, {
          clickCount: clickCount ?? 1,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          button: (button ?? "left") as any,
        })
      }
      const shot = await screenshotDataUrl(page, true)
      return {
        url: page.url(),
        title: await page.title(),
        screenshot: shot,
        x: clickX,
        y: clickY,
        status: "success",
        type: "browser_click",
        duration: Date.now() - started,
      }
    })
  },
  {
    name: "browser_click",
    description: "Click an element in a headless browser using a selector or coordinates.",
    schema: z.object({
      url: z.string().url(),
      selector: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      button: z.enum(["left", "right", "middle"]).optional(),
      clickCount: z.number().int().min(1).max(3).optional(),
    }),
  }
)

/**
 * Compatibility wrapper that performs a double click through the standard click tool.
 */
export const browserDoubleClickTool = tool(
  async (args) => {
    return await browserClickTool.invoke({ ...args, clickCount: 2 })
  },
  {
    name: "browser_double_click",
    description: "Double click an element in a headless browser.",
    schema: z.object({
      url: z.string().url(),
      selector: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
    }),
  }
)

/**
 * Compatibility wrapper that performs a right click through the standard click tool.
 */
export const browserRightClickTool = tool(
  async (args) => {
    return await browserClickTool.invoke({ ...args, button: "right", clickCount: 1 })
  },
  {
    name: "browser_right_click",
    description: "Right click an element in a headless browser.",
    schema: z.object({
      url: z.string().url(),
      selector: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
    }),
  }
)

/**
 * Moves the browser pointer over a selector or coordinate and captures the page state.
 */
export const browserHoverTool = tool(
  async ({ url, selector, x, y }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      await goto(page, url, "domcontentloaded")
      let hoverX = typeof x === "number" ? x : null
      let hoverY = typeof y === "number" ? y : null
      if ((!hoverX || !hoverY) && selector) {
        const center = await centerOfSelector(page, selector)
        hoverX = center?.x ?? null
        hoverY = center?.y ?? null
      }
      if (typeof hoverX === "number" && typeof hoverY === "number") {
        await page.mouse.move(hoverX, hoverY)
      } else if (selector) {
        await page.hover(selector)
      }
      const shot = await screenshotDataUrl(page, true)
      return {
        url: page.url(),
        title: await page.title(),
        screenshot: shot,
        x: hoverX,
        y: hoverY,
        status: "success",
        type: "browser_hover",
        duration: Date.now() - started,
      }
    })
  },
  {
    name: "browser_hover",
    description: "Hover an element in a headless browser using a selector or coordinates.",
    schema: z.object({
      url: z.string().url(),
      selector: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
    }),
  }
)

/**
 * Scrolls the session browser by wheel deltas and captures the resulting page state.
 */
export const browserScrollTool = tool(
  async ({ url, deltaY, deltaX }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      await goto(page, url, "domcontentloaded")
      await page.mouse.wheel({ deltaY: deltaY ?? 800, deltaX: deltaX ?? 0 })
      const shot = await screenshotDataUrl(page, true)
      return {
        url: page.url(),
        title: await page.title(),
        screenshot: shot,
        action: "scroll",
        status: "success",
        type: "browser_scroll",
        duration: Date.now() - started,
      }
    })
  },
  {
    name: "browser_scroll",
    description: "Scroll the page in a headless browser.",
    schema: z.object({
      url: z.string().url(),
      deltaY: z.number().optional(),
      deltaX: z.number().optional(),
    }),
  }
)

/**
 * Types text into a browser input, optionally clearing the field first.
 */
export const browserTypeTool = tool(
  async ({ url, selector, text, clear }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      await goto(page, url, "domcontentloaded")
      if (clear) {
        await page.focus(selector)
        await page.keyboard.down(os.platform() === "darwin" ? "Meta" : "Control")
        await page.keyboard.press("A")
        await page.keyboard.up(os.platform() === "darwin" ? "Meta" : "Control")
        await page.keyboard.press("Backspace")
      }
      await page.type(selector, text, { delay: 10 })
      const shot = await screenshotDataUrl(page, true)
      return {
        url: page.url(),
        title: await page.title(),
        screenshot: shot,
        status: "success",
        type: "browser_type",
        duration: Date.now() - started,
      }
    })
  },
  {
    name: "browser_type",
    description: "Type into an input element in a headless browser.",
    schema: z.object({
      url: z.string().url(),
      selector: z.string().min(1),
      text: z.string(),
      clear: z.boolean().optional(),
    }),
  }
)

/**
 * Fills one form field by delegating to the browser typing tool.
 */
export const browserFormFillTool = tool(
  async ({ url, selector, value, clear }) => {
    return await browserTypeTool.invoke({ url, selector, text: value, clear })
  },
  {
    name: "browser_form_input_fill",
    description: "Fill a form input in a headless browser.",
    schema: z.object({
      url: z.string().url(),
      selector: z.string().min(1),
      value: z.string(),
      clear: z.boolean().optional(),
    }),
  }
)

/**
 * Fills several form fields on one page visit and returns a screenshot of the result.
 */
export const browserFormFillBatchTool = tool(
  async ({ url, fields }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      await goto(page, url, "domcontentloaded")
      for (const field of fields) {
        if (field.clear) {
          await page.focus(field.selector)
          await page.keyboard.down(os.platform() === "darwin" ? "Meta" : "Control")
          await page.keyboard.press("A")
          await page.keyboard.up(os.platform() === "darwin" ? "Meta" : "Control")
          await page.keyboard.press("Backspace")
        }
        await page.type(field.selector, field.value, { delay: 10 })
      }
      const shot = await screenshotDataUrl(page, true)
      return {
        url: page.url(),
        title: await page.title(),
        screenshot: shot,
        filled: fields.map((f) => f.selector),
        status: "success",
        type: "browser_form_fill_batch",
        duration: Date.now() - started,
      }
    })
  },
  {
    name: "browser_form_fill_batch",
    description: "Fill multiple form fields on a page (best-effort).",
    schema: z.object({
      url: z.string().url(),
      fields: z
        .array(
          z.object({
            selector: z.string().min(1),
            value: z.string(),
            clear: z.boolean().optional(),
          })
        )
        .min(1),
    }),
  }
)

/**
 * Waits for a fixed delay after loading a page and captures the current state.
 */
export const browserWaitTool = tool(
  async ({ url, duration, condition }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      await goto(page, url, "domcontentloaded")
      if (typeof duration === "number") {
        await new Promise((r) => setTimeout(r, duration * 1000))
      }
      const shot = await screenshotDataUrl(page, true)
      return {
        url: page.url(),
        title: await page.title(),
        screenshot: shot,
        condition: condition ?? null,
        status: "success",
        type: "browser_wait",
        duration: Date.now() - started,
      }
    })
  },
  {
    name: "browser_wait",
    description: "Wait for some time after loading a page (simple delay).",
    schema: z.object({
      url: z.string().url(),
      duration: z.number().optional(),
      condition: z.string().optional(),
    }),
  }
)

/**
 * Waits for a selector or page function to become true before capturing the state.
 */
export const browserWaitForTool = tool(
  async ({ url, selector, script, timeoutMs }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      await goto(page, url, "domcontentloaded")
      try {
        if (selector) {
          await page.waitForSelector(selector, { timeout: timeoutMs ?? 15000 })
        } else if (script) {
          await page.waitForFunction(script, { timeout: timeoutMs ?? 15000 })
        } else {
          throw new Error("Provide `selector` or `script`")
        }
      } catch (err) {
        const shot = await screenshotDataUrl(page, true)
        return {
          url: page.url(),
          title: await page.title(),
          screenshot: shot,
          status: "timeout",
          waitedFor: selector ?? "function",
          error: err instanceof Error ? err.message : "Wait failed",
          type: "browser_wait_for",
          duration: Date.now() - started,
        }
      }
      const shot = await screenshotDataUrl(page, true)
      return {
        url: page.url(),
        title: await page.title(),
        screenshot: shot,
        status: "success",
        waitedFor: selector ?? "function",
        type: "browser_wait_for",
        duration: Date.now() - started,
      }
    })
  },
  {
    name: "browser_wait_for",
    description: "Wait for a selector or page function to succeed, then capture a screenshot.",
    schema: z
      .object({
        url: z.string().url(),
        selector: z.string().optional(),
        script: z.string().optional(),
        timeoutMs: z.number().int().min(1000).max(60000).optional(),
      })
      .refine((v) => v.selector || v.script, { message: "Provide selector or script" }),
  }
)

/**
 * Extracts text or an attribute from a selected element in the rendered page.
 */
export const browserExtractTool = tool(
  async ({ url, selector, attribute }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      await goto(page, url, "domcontentloaded")
      const extractedData = await page.$eval(
        selector,
        (el, attr) => {
          if (!attr) return (el as HTMLElement).innerText || (el as HTMLElement).textContent || ""
          return (el as HTMLElement).getAttribute(attr) || ""
        },
        attribute ?? null
      )
      const shot = await screenshotDataUrl(page, true)
      return {
        url: page.url(),
        title: await page.title(),
        screenshot: shot,
        extractedData,
        status: "success",
        type: "browser_extract",
        duration: Date.now() - started,
      }
    })
  },
  {
    name: "browser_extract",
    description: "Extract text or an attribute from a CSS selector on a page.",
    schema: z.object({
      url: z.string().url(),
      selector: z.string().min(1),
      attribute: z.string().optional(),
    }),
  }
)

/**
 * Extracts text from the whole page or from a specific selector.
 */
export const browserGetTextTool = tool(
  async ({ url, selector }) => {
    return await browserExtractTool.invoke({ url, selector: selector ?? "body" })
  },
  {
    name: "browser_get_text",
    description: "Extract readable text from the page (or a selector).",
    schema: z.object({
      url: z.string().url(),
      selector: z.string().optional(),
    }),
  }
)

/**
 * Lists links from the rendered page for navigation and extraction workflows.
 */
export const browserGetLinksTool = tool(
  async ({ url }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      await goto(page, url, "domcontentloaded")
      const extractedData = await page.$$eval("a[href]", (anchors) =>
        anchors
          .map((a) => ({
            text: (a as HTMLAnchorElement).innerText?.trim() ?? "",
            href: (a as HTMLAnchorElement).href,
          }))
          .filter((a) => a.href)
          .slice(0, 200)
      )
      const shot = await screenshotDataUrl(page, true)
      return {
        url: page.url(),
        title: await page.title(),
        screenshot: shot,
        extractedData,
        status: "success",
        type: "browser_get_links",
        duration: Date.now() - started,
      }
    })
  },
  {
    name: "browser_get_links",
    description: "Extract links from a page.",
    schema: z.object({ url: z.string().url() }),
  }
)

/**
 * Lists likely clickable elements so the model can choose stable interaction targets.
 */
export const browserGetClickableElementsTool = tool(
  async ({ url }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      await goto(page, url, "domcontentloaded")
      const extractedData = await page.$$eval(
        "a[href],button,[role='button'],input[type='button'],input[type='submit']",
        (els) =>
          els
            .map((el) => {
              const tag = (el as HTMLElement).tagName.toLowerCase()
              const text =
                (el as HTMLElement).innerText?.trim() ||
                (el as HTMLInputElement).value?.trim() ||
                ""
              const href = (el as HTMLAnchorElement).href || ""
              const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : ""
              const cls = (el as HTMLElement).className
                ? `.${String((el as HTMLElement).className)
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .join(".")}`
                : ""
              const selector = id || cls || tag
              return { tag, text, href, selector }
            })
            .filter((x) => x.text || x.href)
            .slice(0, 200)
      )
      const shot = await screenshotDataUrl(page, true)
      return {
        url: page.url(),
        title: await page.title(),
        screenshot: shot,
        extractedData,
        status: "success",
        type: "browser_get_clickable_elements",
        duration: Date.now() - started,
      }
    })
  },
  {
    name: "browser_get_clickable_elements",
    description: "List clickable elements on a page (best-effort).",
    schema: z.object({ url: z.string().url() }),
  }
)

/**
 * Drags from a source selector to a target selector using pointer coordinates.
 */
export const browserDragAndDropTool = tool(
  async ({ url, sourceSelector, targetSelector }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      await goto(page, url, "domcontentloaded")
      const src = await centerOfSelector(page, sourceSelector)
      const tgt = await centerOfSelector(page, targetSelector)
      if (src && tgt) {
        await page.mouse.move(src.x, src.y)
        await page.mouse.down()
        await page.mouse.move(tgt.x, tgt.y, { steps: 15 })
        await page.mouse.up()
      }
      const shot = await screenshotDataUrl(page, true)
      return {
        url: page.url(),
        title: await page.title(),
        screenshot: shot,
        sourceX: src?.x ?? null,
        sourceY: src?.y ?? null,
        targetX: tgt?.x ?? null,
        targetY: tgt?.y ?? null,
        status: "success",
        type: "browser_drag_and_drop",
        duration: Date.now() - started,
      }
    })
  },
  {
    name: "browser_drag_and_drop",
    description: "Drag from a source selector to a target selector.",
    schema: z.object({
      url: z.string().url(),
      sourceSelector: z.string().min(1),
      targetSelector: z.string().min(1),
    }),
  }
)

/**
 * Alias for drag-and-drop interactions used by older tool policies/renderers.
 */
export const browserDragTool = tool(
  async ({ url, sourceSelector, targetSelector }) => {
    return await browserDragAndDropTool.invoke({ url, sourceSelector, targetSelector })
  },
  {
    name: "browser_drag",
    description: "Drag from source to target (alias).",
    schema: z.object({
      url: z.string().url(),
      sourceSelector: z.string().min(1),
      targetSelector: z.string().min(1),
    }),
  }
)

/**
 * Sends a single keyboard key press to the active browser page.
 */
export const browserKeyPressTool = tool(
  async ({ url, key }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      await goto(page, url, "domcontentloaded")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.keyboard.press(key as any)
      const shot = await screenshotDataUrl(page, true)
      return {
        url: page.url(),
        title: await page.title(),
        screenshot: shot,
        action: `key_press:${key}`,
        status: "success",
        type: "browser_key_press",
        duration: Date.now() - started,
      }
    })
  },
  {
    name: "browser_key_press",
    description: "Press a key on the page.",
    schema: z.object({ url: z.string().url(), key: z.string().min(1) }),
  }
)

/**
 * Sends a multi-key browser shortcut such as Ctrl+K or Meta+A.
 */
export const browserHotkeyTool = tool(
  async ({ url, keys }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      await goto(page, url, "domcontentloaded")
      for (const key of keys) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await page.keyboard.down(key as any)
      }
      for (const key of [...keys].reverse()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await page.keyboard.up(key as any)
      }
      const shot = await screenshotDataUrl(page, true)
      return {
        url: page.url(),
        title: await page.title(),
        screenshot: shot,
        action: `hotkey:${keys.join("+")}`,
        status: "success",
        type: "browser_hotkey",
        duration: Date.now() - started,
      }
    })
  },
  {
    name: "browser_hotkey",
    description: "Trigger a keyboard shortcut (best-effort).",
    schema: z.object({ url: z.string().url(), keys: z.array(z.string().min(1)).min(1).max(5) }),
  }
)

/**
 * Evaluates JavaScript inside the current browser page and captures the page state.
 */
export const browserEvaluateTool = tool(
  async ({ url, script }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      await goto(page, url, "domcontentloaded")
      const result = await page.evaluate(script)
      const shot = await screenshotDataUrl(page, true)
      return {
        url: page.url(),
        title: await page.title(),
        screenshot: shot,
        result,
        status: "success",
        type: "browser_evaluate",
        duration: Date.now() - started,
      }
    })
  },
  {
    name: "browser_evaluate",
    description: "Run JavaScript in the browser page and return the result.",
    schema: z.object({ url: z.string().url(), script: z.string().min(1) }),
  }
)

export const browserAccessibilitySnapshotTool = tool(
  async ({ url }) => {
    return await withPage(async (page) => {
      await goto(page, url, "domcontentloaded")
      const snapshot = await page.accessibility.snapshot({ interestingOnly: true })
      return {
        type: "browser_accessibility_snapshot",
        url: page.url(),
        title: await page.title(),
        snapshot,
      }
    })
  },
  {
    name: "browser_accessibility_snapshot",
    description: "Return Puppeteer accessibility tree snapshot for a page.",
    schema: z.object({ url: z.string().url() }),
  }
)

export const browserConsoleLogsTool = tool(
  async ({ url, waitMs }) => {
    return await withPage(async (page) => {
      const logs: Array<{ type: string; text: string }> = []
      const handler = (msg: { type: () => string; text: () => string }) => {
        logs.push({ type: msg.type(), text: truncateString(msg.text(), 1000) })
      }
      page.on("console", handler)
      try {
        await goto(page, url, "domcontentloaded")
        if (waitMs) await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, 10000)))
        return {
          type: "browser_console_logs",
          url: page.url(),
          title: await page.title(),
          logs: logs.slice(0, 200),
        }
      } finally {
        page.off("console", handler)
      }
    })
  },
  {
    name: "browser_console_logs",
    description: "Load a page and capture browser console logs.",
    schema: z.object({
      url: z.string().url(),
      waitMs: z.number().int().min(0).max(10000).optional(),
    }),
  }
)

export const browserNetworkLogTool = tool(
  async ({ url, waitMs }) => {
    return await withPage(async (page) => {
      const requests: Array<Record<string, unknown>> = []
      const onResponse = (res: {
        url: () => string
        status: () => number
        request: () => { method: () => string; resourceType: () => string }
      }) => {
        requests.push({
          url: res.url(),
          status: res.status(),
          method: res.request().method(),
          resourceType: res.request().resourceType(),
        })
      }
      page.on("response", onResponse)
      try {
        await goto(page, url, "domcontentloaded")
        if (waitMs) await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, 10000)))
        return {
          type: "browser_network_log",
          url: page.url(),
          title: await page.title(),
          requests: requests.slice(0, 300),
        }
      } finally {
        page.off("response", onResponse)
      }
    })
  },
  {
    name: "browser_network_log",
    description: "Load a page and capture response status metadata.",
    schema: z.object({
      url: z.string().url(),
      waitMs: z.number().int().min(0).max(10000).optional(),
    }),
  }
)

export const browserStorageSnapshotTool = tool(
  async ({ url }) => {
    return await withPage(async (page) => {
      await goto(page, url, "domcontentloaded")
      const cookies = await page.cookies()
      const storage = await page.evaluate(() => ({
        localStorage: Object.keys(window.localStorage),
        sessionStorage: Object.keys(window.sessionStorage),
      }))
      return {
        type: "browser_storage_snapshot",
        url: page.url(),
        title: await page.title(),
        cookies: cookies.map((cookie) => ({
          name: cookie.name,
          domain: cookie.domain,
          path: cookie.path,
          expires: cookie.expires,
        })),
        storage,
      }
    })
  },
  {
    name: "browser_storage_snapshot",
    description: "Read cookie metadata and storage keys for a page, without values.",
    schema: z.object({ url: z.string().url() }),
  }
)

export const browserSetViewportTool = tool(
  async ({ url, width, height, deviceScaleFactor }) => {
    return await withPage(async (page) => {
      await page.setViewport({ width, height, deviceScaleFactor: deviceScaleFactor ?? 1 })
      await goto(page, url, "domcontentloaded")
      const screenshot = await screenshotDataUrl(page, true)
      return {
        type: "browser_set_viewport",
        url: page.url(),
        title: await page.title(),
        width,
        height,
        screenshot,
      }
    })
  },
  {
    name: "browser_set_viewport",
    description: "Set browser viewport dimensions and capture the page.",
    schema: z.object({
      url: z.string().url(),
      width: z.number().int().min(100).max(3840),
      height: z.number().int().min(100).max(3840),
      deviceScaleFactor: z.number().min(0.1).max(4).optional(),
    }),
  }
)

export const browserSelectorScreenshotTool = tool(
  async ({ url, selector }) => {
    return await withPage(async (page) => {
      await goto(page, url, "domcontentloaded")
      const element = await page.$(selector)
      if (!element) throw new Error(`Selector not found: ${selector}`)
      const shot = (await element.screenshot({ encoding: "binary" })) as Buffer
      const artifact = await storeArtifact({
        filename: "selector-screenshot.png",
        bytes: shot,
        mimeType: "image/png",
      })
      return {
        type: "browser_selector_screenshot",
        url: page.url(),
        title: await page.title(),
        selector,
        screenshot: artifact.url,
        artifact,
      }
    })
  },
  {
    name: "browser_selector_screenshot",
    description: "Capture a screenshot of a specific page element.",
    schema: z.object({ url: z.string().url(), selector: z.string().min(1) }),
  }
)

export const browserFullPageScreenshotTool = tool(
  async ({ url }) => {
    return await withTemporaryPage(async (page) => {
      await goto(page, url, "networkidle0")
      const artifact = await screenshotArtifact(page, true, "full-page-screenshot.png")
      return {
        type: "browser_full_page_screenshot",
        url: page.url(),
        title: await page.title(),
        screenshot: artifact.url,
        artifact,
      }
    })
  },
  {
    name: "browser_full_page_screenshot",
    description: "Capture a full-page browser screenshot.",
    schema: z.object({ url: z.string().url() }),
  }
)

export const browserPrintPdfTool = tool(
  async ({ url, filename }) => {
    return await withPage(async (page) => {
      await goto(page, url, "networkidle0")
      const pdf = Buffer.from(await page.pdf({ format: "A4", printBackground: true }))
      const artifact = await storeArtifact({
        filename: filename ?? "browser-page.pdf",
        bytes: pdf,
        mimeType: "application/pdf",
      })
      return {
        type: "browser_print_pdf",
        url: page.url(),
        title: await page.title(),
        artifact,
        artifactUrl: artifact.url,
      }
    })
  },
  {
    name: "browser_print_pdf",
    description: "Print a web page to PDF artifact.",
    schema: z.object({ url: z.string().url(), filename: z.string().optional() }),
  }
)

export const browserDownloadsTool = tool(
  async ({ url, selector, waitMs, maxBytes }) => {
    const downloadDir = await mkdtemp(path.join(os.tmpdir(), "rekdin-browser-downloads-"))
    try {
      return await withPage(async (page) => {
        const client = await page.target().createCDPSession()
        await client.send("Page.setDownloadBehavior", {
          behavior: "allow",
          downloadPath: downloadDir,
        })

        await goto(page, url, "domcontentloaded")
        if (selector) {
          await page.click(selector)
        }
        await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs ?? 5000, 20000)))

        const entries = await readdir(downloadDir, { withFileTypes: true }).catch(() => [])
        const files = []
        const pending = []
        for (const entry of entries) {
          if (!entry.isFile()) continue
          const filePath = path.join(downloadDir, entry.name)
          const info = await stat(filePath)
          if (entry.name.endsWith(".crdownload")) {
            pending.push({ name: entry.name, size: info.size })
            continue
          }

          const limit = maxBytes ?? 15_000_000
          if (info.size > limit) {
            files.push({
              name: entry.name,
              size: info.size,
              stored: false,
              omittedReason: `File exceeds maxBytes (${limit}).`,
            })
            continue
          }

          const bytes = await readFile(filePath)
          const artifact = await storeArtifact({
            filename: entry.name,
            bytes,
            mimeType: "application/octet-stream",
          })
          files.push({ name: entry.name, size: info.size, stored: true, artifact })
        }

        return {
          type: "browser_downloads",
          url: page.url(),
          title: await page.title(),
          selector: selector ?? null,
          files,
          pending,
        }
      })
    } finally {
      await rm(downloadDir, { recursive: true, force: true })
    }
  },
  {
    name: "browser_downloads",
    description: "Capture browser-triggered downloads as bounded Rekdin artifacts.",
    schema: z.object({
      url: z.string().url(),
      selector: z.string().min(1).optional(),
      waitMs: z.number().int().min(0).max(20000).optional(),
      maxBytes: z.number().int().min(1024).max(50_000_000).optional(),
    }),
  }
)

export const browserFormSchemaTool = tool(
  async ({ url }) => {
    return await withPage(async (page) => {
      await goto(page, url, "domcontentloaded")
      const forms = await page.$$eval("form", (formEls) =>
        formEls.map((form, formIndex) => ({
          index: formIndex,
          action: (form as HTMLFormElement).action,
          method: (form as HTMLFormElement).method,
          fields: Array.from(form.querySelectorAll("input, textarea, select")).map((field) => {
            const el = field as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
            return {
              tag: el.tagName.toLowerCase(),
              name: el.getAttribute("name"),
              id: el.id,
              type: (el as HTMLInputElement).type,
              placeholder: el.getAttribute("placeholder"),
              required: el.hasAttribute("required"),
            }
          }),
        }))
      )
      return { type: "browser_form_schema", url: page.url(), title: await page.title(), forms }
    })
  },
  {
    name: "browser_form_schema",
    description: "Extract forms and field metadata from a page.",
    schema: z.object({ url: z.string().url() }),
  }
)

export const browserTableExtractTool = tool(
  async ({ url }) => {
    return await withPage(async (page) => {
      await goto(page, url, "domcontentloaded")
      const tables = await page.$$eval("table", (tableEls) =>
        tableEls.slice(0, 20).map((table, index) => ({
          index,
          rows: Array.from(table.querySelectorAll("tr"))
            .slice(0, 200)
            .map((row) =>
              Array.from(row.querySelectorAll("th,td")).map((cell) =>
                (cell.textContent ?? "").trim()
              )
            ),
        }))
      )
      return { type: "browser_table_extract", url: page.url(), title: await page.title(), tables }
    })
  },
  {
    name: "browser_table_extract",
    description: "Extract HTML tables from a rendered page.",
    schema: z.object({ url: z.string().url() }),
  }
)

/**
 * Records a lightweight browser control step with a screenshot for visual timelines.
 */
export const browserControlTool = tool(
  async ({ url, action, thought, x, y }) => {
    return await withPage(async (page) => {
      const started = Date.now()
      await goto(page, url, "domcontentloaded")
      const shot = await screenshotDataUrl(page, true)
      return {
        url: page.url(),
        title: await page.title(),
        screenshot: shot,
        thought: thought ?? "",
        step: action ?? "",
        action: action ?? "",
        x: x ?? null,
        y: y ?? null,
        status: "success",
        type: "browser_control",
        duration: Date.now() - started,
      }
    })
  },
  {
    name: "browser_control",
    description: "Report a browser control step (lightweight visual step for progress).",
    schema: z.object({
      url: z.string().url(),
      action: z.string().optional(),
      thought: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
    }),
  }
)

/**
 * Compatibility wrapper for visual browser-control steps with pointer coordinates.
 */
export const browserVisionControlTool = tool(
  async ({ url, thought, x, y }) => {
    return await browserControlTool.invoke({ url, thought, x, y, action: "vision_control" })
  },
  {
    name: "browser_vision_control",
    description: "Provide a screenshot + cursor position for a visual browser step (compat).",
    schema: z.object({
      url: z.string().url(),
      thought: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
    }),
  }
)

/**
 * Compatibility wrapper for named browser action steps.
 */
export const browserActionTool = tool(
  async ({ url, action, thought }) => {
    return await browserControlTool.invoke({ url, action, thought })
  },
  {
    name: "browser_action",
    description: "Record a browser action step (compat).",
    schema: z.object({
      url: z.string().url(),
      action: z.string().min(1),
      thought: z.string().optional(),
    }),
  }
)
