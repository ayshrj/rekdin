import { chromium } from "playwright"

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001"

const providers = [
  {
    label: "OpenRouter",
    expectedSelectors: ["#openrouter-key", "#openrouter-model"],
  },
  {
    label: "OpenAI",
    expectedSelectors: ["#openai-key", "#openai-model"],
  },
  {
    label: "Gemini",
    expectedSelectors: ["#gemini-key", "#gemini-model"],
  },
  {
    label: "Claude",
    expectedSelectors: ["#claude-key", "#claude-model"],
  },
  {
    label: "Grok",
    expectedSelectors: ["#grok-key", "#grok-model"],
  },
  {
    label: "Azure OpenAI",
    expectedSelectors: [
      "#azure-openai-key",
      "#azure-openai-endpoint",
      "#azure-openai-deployment",
      "#azure-openai-api-version",
    ],
  },
]

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
})

async function openProviderSelect() {
  await page.locator('[data-slot="dialog-content"] button[role="combobox"]').first().click()
}

async function selectProvider(label) {
  await openProviderSelect()
  await page.getByRole("option", { name: label, exact: true }).click()
  await page.waitForTimeout(150)
}

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 })
  await page.waitForTimeout(2_000)

  await page.locator('button[aria-label="Open settings"]').first().click()
  const dialog = page.locator('[data-slot="dialog-content"]')
  await dialog.waitFor({ state: "visible", timeout: 15_000 })

  await openProviderSelect()
  const optionTexts = await page.getByRole("option").allInnerTexts()
  await page.keyboard.press("Escape")

  const results = []
  for (const provider of providers) {
    await selectProvider(provider.label)

    const visibleSelectors = []
    for (const selector of provider.expectedSelectors) {
      const locator = page.locator(selector)
      if (await locator.isVisible()) {
        visibleSelectors.push(selector)
      }
    }

    results.push({
      provider: provider.label,
      visibleSelectors,
      matchedAllExpected: provider.expectedSelectors.every((selector) =>
        visibleSelectors.includes(selector)
      ),
    })
  }

  console.log(
    JSON.stringify(
      {
        baseUrl,
        optionTexts,
        results,
      },
      null,
      2
    )
  )
} finally {
  await browser.close()
}
