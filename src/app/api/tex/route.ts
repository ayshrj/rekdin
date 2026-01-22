import { NextResponse } from "next/server"
import { z } from "zod"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const requestSchema = z
  .object({
    filename: z.string().optional(),
    texContent: z.string().optional(),
    markdown: z.string().optional(),
  })
  .refine((v) => Boolean(v.texContent || v.markdown), {
    message: "Provide either texContent or markdown",
  })

function sanitizeTexFileName(filename?: string) {
  const raw = (filename ?? "document.tex").trim()
  const base = raw.toLowerCase().endsWith(".tex") ? raw : `${raw}.tex`
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, "_")
  return safe.length > 0 ? safe : "document.tex"
}

function markdownToLatex(markdown: string) {
  const lines = markdown.split(/\r?\n/)
  const latexLines: string[] = []
  for (const line of lines) {
    if (/^#{1,6}\s+/.test(line)) {
      const level = line.match(/^#+/)?.[0].length ?? 1
      const text = line.replace(/^#{1,6}\s+/, "").trim()
      const cmd = level === 1 ? "\\section" : level === 2 ? "\\subsection" : "\\subsubsection"
      latexLines.push(`${cmd}{${text}}`)
      continue
    }
    const transformed = line
      .replace(/\*\*(.+?)\*\*/g, "\\\\textbf{$1}")
      .replace(/\*(.+?)\*/g, "\\\\textit{$1}")
      .replace(/`([^`]+)`/g, "\\\\texttt{$1}")
    latexLines.push(transformed)
  }
  return latexLines.join("\n\n")
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const filename = sanitizeTexFileName(parsed.data.filename)
  const tex =
    typeof parsed.data.texContent === "string" && parsed.data.texContent.length > 0
      ? parsed.data.texContent
      : `\\documentclass{article}
\\usepackage[margin=1in]{geometry}
\\usepackage{hyperref}
\\usepackage{graphicx}
\\begin{document}
${markdownToLatex(parsed.data.markdown ?? "")}
\\end{document}
`

  if (tex.length > 100_000) {
    return NextResponse.json({ error: "texContent too large (max 100KB)" }, { status: 413 })
  }

  return new NextResponse(tex, {
    headers: {
      "Content-Type": "application/x-tex; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
