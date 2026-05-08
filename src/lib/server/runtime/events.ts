import { ServerEventV2 } from "@/types/runtime"

/**
 * Encodes a typed server event as an SSE `data:` frame.
 */
function encodeEvent(payload: ServerEventV2) {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`)
}

/**
 * Wraps an async producer in a heartbeat-enabled SSE stream and guarantees a terminal idle/done
 * event even when the producer throws.
 */
export function createEventStream(
  responder: (send: (payload: ServerEventV2) => void) => Promise<void>,
  heartbeatMs = 10_000
) {
  return new ReadableStream({
    async start(controller) {
      const send = (payload: ServerEventV2) => {
        controller.enqueue(encodeEvent(payload))
      }

      const heartbeat = setInterval(() => {
        send({ version: 2, type: "heartbeat", at: new Date().toISOString() })
      }, heartbeatMs)

      try {
        await responder(send)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        send({ version: 2, type: "error", error: message })
      } finally {
        clearInterval(heartbeat)
        send({ version: 2, type: "status", phase: "idle" })
        send({ version: 2, type: "done" })
        controller.close()
      }
    },
  })
}
