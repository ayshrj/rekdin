/**
 * Loads the optional sharp dependency only for image metadata/conversion tools.
 */
export async function loadSharp() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("sharp")
    return mod
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = await import("sharp" as any)
      return mod
    } catch {
      return null
    }
  }
}

/**
 * Loads OCR support only when requested. Tesseract is intentionally optional
 * because most Rekdin installs do not need the worker payload on the hot path.
 */
export async function loadTesseract() {
  try {
    // Keep this dynamic so the app can build without bundling OCR workers.
    const dynamicImport = new Function("specifier", "return import(specifier)")
    return await dynamicImport("tesseract.js")
  } catch {
    return null
  }
}

/**
 * Loads the optional YAML dependency only when a YAML patch tool call needs it.
 */
export async function loadYamlModule() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("yaml")
    return mod
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = await import("yaml" as any)
      return mod
    } catch {
      return null
    }
  }
}
