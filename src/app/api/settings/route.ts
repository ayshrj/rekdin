import { NextResponse } from "next/server"
import { z } from "zod"

import {
  getSettingsStore,
  normalizeProvider,
  sanitizeSettingsForClient,
} from "@/lib/server/settings-store"
import { ServerSettings } from "@/types/runtime"

export const runtime = "nodejs"

const requestSchema = z.object({
  currentSessionId: z.string().nullable().optional(),
  llmProvider: z.string().optional(),
  openRouterModel: z.string().optional(),
  openRouterApiKey: z.string().optional(),
  openAIModel: z.string().optional(),
  openAIApiKey: z.string().optional(),
  azureOpenAIApiKey: z.string().optional(),
  azureOpenAIEndpoint: z.string().optional(),
  azureOpenAIApiVersion: z.string().optional(),
  azureOpenAIDeployment: z.string().optional(),
  liveModeEnabled: z.boolean().optional(),
  cloudinaryCloudName: z.string().optional(),
  cloudinaryApiKey: z.string().optional(),
  cloudinaryApiSecret: z.string().optional(),
})

export async function GET() {
  const settings = await getSettingsStore().load()
  return NextResponse.json({ settings: sanitizeSettingsForClient(settings) })
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const next = await getSettingsStore().save({
    ...parsed.data,
    ...(typeof parsed.data.llmProvider === "string"
      ? { llmProvider: normalizeProvider(parsed.data.llmProvider) }
      : {}),
  } as Partial<ServerSettings>)

  return NextResponse.json({ settings: next })
}
