import { chromium } from "playwright"

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001"
const openRouterKey = process.env.OPENROUTER_TEST_KEY?.trim() ?? ""

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
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
})

const requestLog = []
page.on("response", async (response) => {
  const url = response.url()
  if (!url.includes("/api/openrouter/models")) return
  let bodySnippet = ""
  try {
    bodySnippet = (await response.text()).slice(0, 500)
  } catch {
    bodySnippet = "<unavailable>"
  }
  requestLog.push({
    url,
    status: response.status(),
    bodySnippet,
  })
})

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 })
  await page.waitForTimeout(3_000)

  await page.locator('button[aria-label="Open settings"]').first().click()
  const dialog = page.locator('[data-slot="dialog-content"]')
  await dialog.waitFor({ state: "visible", timeout: 15_000 })
  await page.waitForTimeout(750)

  const keyInput = page.locator("#openrouter-key")
  if (openRouterKey) {
    await keyInput.fill(openRouterKey)
  }

  const beforeBox = await dialog.boundingBox()

  await page.getByRole("button", { name: /fetch models/i }).click()
  await page.waitForTimeout(4_000)

  const afterBox = await dialog.boundingBox()
  const command = page.locator('[data-slot="command"]')
  const commandBox = (await command.count()) > 0 ? await command.boundingBox() : null
  const modelItems = await page.locator('[data-slot="command-item"]').count()
  const toastTexts = await getToastTexts(page)

  console.log(
    JSON.stringify(
      {
        baseUrl,
        beforeBox,
        afterBox,
        commandBox,
        modelItems,
        toastTexts,
        requestLog,
      },
      null,
      2
    )
  )
} finally {
  await browser.close()
}
