import { z } from "zod"

import { linesOf } from "../shared/code-utils"
import { gitOutput } from "../shared/command"
import { previewString, truncateString } from "../shared/formatting"
import { unifiedPatch } from "../shared/patching"
import { dryRunSchema, toolDefinition } from "../shared/tool-base"

async function githubJson(url: string) {
  const response = await fetch(url, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "rekdin-local-tool" },
  })
  if (!response.ok) throw new Error(`GitHub request failed: ${response.status}`)
  return (await response.json()) as unknown
}

export const githubPrSummaryTool = toolDefinition(
  "github_pr_summary",
  "Fetch and summarize a GitHub pull request.",
  z.object({
    owner: z.string().min(1),
    repo: z.string().min(1),
    pullNumber: z.number().int().min(1),
  }),
  async ({ owner, repo, pullNumber }) => {
    const pr = (await githubJson(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}`
    )) as Record<string, unknown>
    const files = (await githubJson(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/files`
    )) as unknown[]
    const commits = (await githubJson(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/commits`
    )) as Array<Record<string, unknown>>
    return {
      type: "github_pr_summary",
      title: pr.title,
      summary: previewString(pr.body, 1000),
      files: files.slice(0, 100),
      commits: commits.slice(0, 50).map((commit) => ({
        sha: commit.sha,
        message: (commit.commit as Record<string, unknown> | undefined)?.message,
      })),
    }
  }
)

export const githubIssueTriageTool = toolDefinition(
  "github_issue_triage",
  "Fetch and triage a GitHub issue.",
  z.object({
    owner: z.string().min(1),
    repo: z.string().min(1),
    issueNumber: z.number().int().min(1),
  }),
  async ({ owner, repo, issueNumber }) => {
    const issue = (await githubJson(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`
    )) as Record<string, unknown>
    return {
      type: "github_issue_triage",
      title: issue.title,
      summary: previewString(issue.body, 1500),
      labels: issue.labels,
    }
  }
)

export const githubActionLogsAnalyzeTool = toolDefinition(
  "github_action_logs_analyze",
  "Analyze pasted GitHub Actions logs or fetch metadata when provided.",
  z.object({
    log: z.string().optional(),
    owner: z.string().optional(),
    repo: z.string().optional(),
    runId: z.number().int().optional(),
  }),
  async ({ log, owner, repo, runId }) => {
    const text =
      log ??
      (owner && repo && runId
        ? JSON.stringify(
            await githubJson(`https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}`),
            null,
            2
          )
        : "")
    return {
      type: "github_action_logs_analyze",
      log: truncateString(text, 12_000),
      errors: linesOf(text)
        .filter((line) => /error|failed|exception/i.test(line))
        .slice(0, 100),
    }
  }
)

export const prDescriptionGenerateTool = toolDefinition(
  "pr_description_generate",
  "Generate PR description markdown from current diff.",
  dryRunSchema,
  async ({ dryRun }) => {
    const statOut = await gitOutput("git diff --stat")
    const text = `## Summary\n\nDescribe the change here.\n\n## Changed Files\n\n\`\`\`\n${statOut.stdout}\n\`\`\`\n\n## Validation\n\n- [ ] npm test\n- [ ] npm run typecheck\n`
    return {
      type: "pr_description_generate",
      dryRun,
      text,
      patch: unifiedPatch("PULL_REQUEST_TEMPLATE.md", "", text),
    }
  }
)

export const branchCleanupCandidatesTool = toolDefinition(
  "branch_cleanup_candidates",
  "Find stale local branches.",
  z.object({ mergedOnly: z.boolean().optional().default(false) }),
  async ({ mergedOnly }) => {
    const cmd = mergedOnly
      ? "git branch --merged"
      : "git for-each-ref --format='%(refname:short)|%(committerdate:iso8601)' refs/heads"
    const out = await gitOutput(cmd)
    return {
      type: "branch_cleanup_candidates",
      branches: out.stdout.split(/\r?\n/).filter(Boolean).slice(0, 200),
    }
  }
)
