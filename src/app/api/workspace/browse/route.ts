import { readdir, stat } from "fs/promises"
import { NextResponse } from "next/server"
import path from "path"

import {
  findBlockedWorkspacePathSegment,
  getDefaultWorkspaceRoot,
  isBlockedWorkspaceDirectoryName,
} from "@/lib/server/workspace"

export const runtime = "nodejs"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const requestedPath = url.searchParams.get("path")?.trim()
  const currentPath = requestedPath ? path.resolve(requestedPath) : getDefaultWorkspaceRoot()
  const blockedSegment = findBlockedWorkspacePathSegment(currentPath)
  if (blockedSegment) {
    return NextResponse.json(
      { error: `Protected workspace directory "${blockedSegment}" cannot be opened` },
      { status: 400 }
    )
  }
  const currentStat = await stat(currentPath).catch(() => null)

  if (!currentStat?.isDirectory()) {
    return NextResponse.json({ error: "Path must be an existing directory" }, { status: 400 })
  }

  const entries = await readdir(currentPath, { withFileTypes: true }).catch(() => [])
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      path: path.join(currentPath, entry.name),
      hidden: entry.name.startsWith("."),
      protected: isBlockedWorkspaceDirectoryName(entry.name),
      skipped: isBlockedWorkspaceDirectoryName(entry.name),
      reason: isBlockedWorkspaceDirectoryName(entry.name)
        ? "Expected to be large; not opened by default."
        : undefined,
    }))
    .sort((a, b) => {
      if (a.hidden !== b.hidden) return a.hidden ? 1 : -1
      return a.name.localeCompare(b.name)
    })

  const parent = path.dirname(currentPath)

  return NextResponse.json({
    currentPath,
    parentPath: parent === currentPath ? null : parent,
    defaultPath: getDefaultWorkspaceRoot(),
    directories,
  })
}
