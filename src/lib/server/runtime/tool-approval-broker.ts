import { ToolApprovalRequest } from "@/types/runtime"

type PendingApproval = {
  request: ToolApprovalRequest
  resolve: (approved: boolean) => void
  timeout: ReturnType<typeof setTimeout>
}

const APPROVAL_TIMEOUT_MS = 60_000

declare global {
  var __REKDIN_TOOL_APPROVALS: Map<string, PendingApproval> | undefined
}

function getApprovalMap() {
  if (!globalThis.__REKDIN_TOOL_APPROVALS) {
    globalThis.__REKDIN_TOOL_APPROVALS = new Map()
  }
  return globalThis.__REKDIN_TOOL_APPROVALS
}

export function createToolApprovalRequest(input: {
  sessionId: string
  toolName: string
  arguments: Record<string, unknown>
  reason: string
}) {
  const id = `approval_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const now = Date.now()
  const request: ToolApprovalRequest = {
    id,
    sessionId: input.sessionId,
    toolName: input.toolName,
    arguments: input.arguments,
    reason: input.reason,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + APPROVAL_TIMEOUT_MS).toISOString(),
  }
  const decision = new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => {
      getApprovalMap().delete(id)
      resolve(false)
    }, APPROVAL_TIMEOUT_MS)
    getApprovalMap().set(id, { request, resolve, timeout })
  })
  return { request, decision }
}

export function resolveToolApproval(id: string, approved: boolean) {
  const pending = getApprovalMap().get(id)
  if (!pending) return false
  clearTimeout(pending.timeout)
  getApprovalMap().delete(id)
  pending.resolve(approved)
  return true
}
