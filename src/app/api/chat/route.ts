import crypto from "crypto"
import { NextResponse } from "next/server"
import { z } from "zod"

import { runAgent } from "@/lib/server/chat-agent"
import { getReplayStore } from "@/lib/server/replay-store"
import { ChatMessage } from "@/types/chat"

export const runtime = "nodejs"

const messageSchema = z.object({
  id: z.string(),
  sessionId: z.string().optional(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  attachments: z.array(z.string()).optional(),
  toolCalls: z.array(z.any()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  timestamp: z.string().optional(),
})

const requestSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1).max(10_000),
  agentType: z.string().optional(),
  attachments: z.array(z.string()).optional(),
  history: z.array(messageSchema).optional(),
})

type EventPayload =
  | { type: "ack"; message: ChatMessage }
  | { type: "assistant_thinking"; value: boolean }
  | { type: "message_chunk"; messageId: string; content: string }
  | { type: "message_complete"; message: ChatMessage; tempId?: string }
  | { type: "tool_result"; toolCall: Record<string, unknown> }
  | { type: "error"; error: string }

function createEventStream(responder: (send: (payload: EventPayload) => void) => Promise<void>) {
  const encoder = new TextEncoder()
  return new ReadableStream({
    async start(controller) {
      const send = (payload: EventPayload) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }
      try {
        await responder(send)
      } catch (err) {
        const error = err instanceof Error ? err.message : "Unknown error"
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error })}\n\n`))
      } finally {
        controller.close()
      }
    },
  })
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { sessionId, message, attachments = [], agentType, history = [] } = parsed.data
  const provider = req.headers.get("x-llm-provider") ?? undefined
  const openRouterApiKey = req.headers.get("x-openrouter-api-key") ?? undefined
  const openRouterModel = req.headers.get("x-openrouter-model") ?? undefined
  const openAIApiKey = req.headers.get("x-openai-api-key") ?? undefined
  const openAIModel = req.headers.get("x-openai-model") ?? undefined
  const azureOpenAIApiKey = req.headers.get("x-azure-openai-api-key") ?? undefined
  const azureOpenAIEndpoint = req.headers.get("x-azure-openai-endpoint") ?? undefined
  const azureOpenAIDeployment = req.headers.get("x-azure-openai-deployment") ?? undefined
  const azureOpenAIApiVersion = req.headers.get("x-azure-openai-api-version") ?? undefined
  const replayStore = getReplayStore()
  const userMessage: ChatMessage =
    history[history.length - 1] && history[history.length - 1].role === "user"
      ? (history[history.length - 1] as ChatMessage)
      : {
          id: crypto.randomUUID(),
          role: "user",
          content: message,
          attachments,
          sessionId,
          timestamp: new Date().toISOString(),
        }
  replayStore.record(sessionId, "user_message", { message: userMessage })

  const streamingMessageId = crypto.randomUUID()
  const stream = createEventStream(async (send) => {
    send({ type: "ack", message: userMessage })
    send({ type: "assistant_thinking", value: true })
    replayStore.record(sessionId, "assistant_thinking", { value: true })
    try {
      const contextMessages = history.length > 0 ? (history as ChatMessage[]) : [userMessage]
      const agentResult = await runAgent({
        headers: req.headers,
        contextMessages,
        provider,
        openRouterApiKey,
        openRouterModel,
        openAIApiKey,
        openAIModel,
        azureOpenAIApiKey,
        azureOpenAIEndpoint,
        azureOpenAIDeployment,
        azureOpenAIApiVersion,
        onToolResult: (toolCall) => {
          const serialized = JSON.parse(JSON.stringify(toolCall)) as Record<string, unknown>
          replayStore.record(sessionId, "tool_call", { toolCall: serialized })
          send({ type: "tool_result", toolCall: serialized })
        },
        onChunk: (chunk) => {
          replayStore.record(sessionId, "message_chunk", {
            messageId: streamingMessageId,
            content: chunk,
          })
          send({ type: "message_chunk", messageId: streamingMessageId, content: chunk })
        },
      })

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: agentResult.reply,
        toolCalls: agentResult.toolCalls,
        metadata: {
          tokens: agentResult.usageTokens,
          agentType: agentType,
        },
        sessionId,
        timestamp: new Date().toISOString(),
      }
      replayStore.record(sessionId, "assistant_message", { message: assistantMessage })
      send({ type: "message_complete", message: assistantMessage, tempId: streamingMessageId })
    } catch (err) {
      const error = err instanceof Error ? err.message : "Failed to generate response"
      replayStore.record(sessionId, "assistant_message", { error })
      send({ type: "error", error })
    } finally {
      send({ type: "assistant_thinking", value: false })
      replayStore.record(sessionId, "assistant_thinking", { value: false })
    }
  })

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
