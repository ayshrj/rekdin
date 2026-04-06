import fs from "fs"
import { chromium } from "playwright"

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001"
const envText = fs.readFileSync(".env", "utf8")
const geminiApiKey = envText.match(/^GEMINI_API_KEY=(.+)$/m)?.[1]?.trim() ?? ""
const geminiModel = "gemini-2.0-flash-lite"

if (!geminiApiKey) {
  throw new Error("Missing GEMINI_API_KEY in .env")
}

async function getToastTexts(page) {
  const toasts = page.locator("[data-sonner-toast]")
  const count = await toasts.count()
  const texts = []
  for (let index = 0; index < count; index += 1) {
    texts.push((await toasts.nth(index).innerText()).trim())
  }
  return texts.filter(Boolean)
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
})

await page.addInitScript(() => {
  window.localStorage.setItem("rekdin-tour-seen", "1")
})

const requestLog = []

page.on("response", async (response) => {
  const url = response.url()
  if (!url.includes("/api/chat")) return

  let bodySnippet = ""
  try {
    bodySnippet = (await response.text()).slice(0, 4000)
  } catch {
    bodySnippet = "<stream-unavailable>"
  }

  requestLog.push({
    status: response.status(),
    url,
    bodySnippet,
  })
})

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 })
  await page.waitForTimeout(2_000)

  await page.locator('button[aria-label="Open settings"]:visible').first().click()
  const dialog = page.locator('[data-slot="dialog-content"]')
  await dialog.waitFor({ state: "visible", timeout: 15_000 })

  const providerSelect = dialog.locator('button[role="combobox"]').first()
  await providerSelect.click()
  await page.getByRole("option", { name: "Gemini", exact: true }).click()

  await page.locator("#gemini-key").fill(geminiApiKey)
  await page.locator("#gemini-model").fill(geminiModel)
  await page.getByRole("button", { name: "Save", exact: true }).click()

  await page.waitForTimeout(1_000)

  const textarea = page.locator("textarea").first()
  await textarea.fill("Say hello in one short sentence.")
  await textarea.press("Enter")

  await page.waitForTimeout(8_000)

  const toasts = await getToastTexts(page)
  const messages = await page.locator("[data-role='chat-message']").allInnerTexts().catch(() => [])
  const errorBlocks = await page.locator("text=/Invalid JSON payload|GoogleGenerativeAI Error/i").allInnerTexts()

  console.log(
    JSON.stringify(
      {
        baseUrl,
        geminiModel,
        toasts,
        errorBlocks,
        messageCount: messages.length,
        requestLog,
      },
      null,
      2
    )
  )
} finally {
  await browser.close()
}
