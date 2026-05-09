import { AsyncLocalStorage } from "async_hooks"

type ToolExecutionContext = {
  sessionId?: string
  workspaceRoot?: string
}

const storage = new AsyncLocalStorage<ToolExecutionContext>()

export function runWithToolExecutionContext<T>(
  context: ToolExecutionContext,
  fn: () => Promise<T>
) {
  return storage.run(context, fn)
}

export function getToolExecutionContext() {
  return storage.getStore()
}
