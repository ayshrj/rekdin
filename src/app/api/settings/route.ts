import { stat } from "fs/promises"
import { NextResponse } from "next/server"
import { z } from "zod"

import { getSettingsStore, normalizeProvider } from "@/lib/server/settings-store"
import { findBlockedWorkspacePathSegment } from "@/lib/server/workspace"
import { ServerSettings } from "@/types/runtime"

export const runtime = "nodejs"

const workflowSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  prompt: z.string(),
  mode: z.string(),
  toolPolicy: z.string().optional(),
  responseSchema: z.record(z.string(), z.unknown()).nullable().optional(),
  category: z.string().optional(),
  supportsBackground: z.boolean().optional(),
  custom: z.boolean().optional(),
})

const requestSchema = z.object({
  currentSessionId: z.string().nullable().optional(),
  workspaceRoot: z.string().optional(),
  llmProvider: z.string().optional(),
  customWorkflows: z.array(workflowSchema).optional(),
  openRouterModel: z.string().optional(),
  openRouterApiKey: z.string().optional(),
  openAIModel: z.string().optional(),
  openAIApiKey: z.string().optional(),
  geminiModel: z.string().optional(),
  geminiApiKey: z.string().optional(),
  claudeModel: z.string().optional(),
  claudeApiKey: z.string().optional(),
  grokModel: z.string().optional(),
  grokApiKey: z.string().optional(),
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
  return NextResponse.json({ settings })
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (typeof parsed.data.workspaceRoot === "string" && parsed.data.workspaceRoot.trim()) {
    const workspaceRoot = parsed.data.workspaceRoot.trim()
    const blockedSegment = findBlockedWorkspacePathSegment(workspaceRoot)
    if (blockedSegment) {
      return NextResponse.json(
        { error: `Workspace root cannot be inside protected directory "${blockedSegment}"` },
        { status: 400 }
      )
    }
    const workspaceStat = await stat(workspaceRoot).catch(() => null)
    if (!workspaceStat?.isDirectory()) {
      return NextResponse.json(
        { error: "Workspace root must be an existing directory" },
        { status: 400 }
      )
    }
  }

  const next = await getSettingsStore().save({
    ...parsed.data,
    ...(typeof parsed.data.llmProvider === "string"
      ? { llmProvider: normalizeProvider(parsed.data.llmProvider) }
      : {}),
  } as Partial<ServerSettings>)

  return NextResponse.json({ settings: next })
}
