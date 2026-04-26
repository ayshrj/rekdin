import { spawn } from "node:child_process"
import process from "node:process"

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm"

const steps = [
  { label: "Unit tests", command: npmCommand, args: ["test"] },
  { label: "Type check", command: npmCommand, args: ["run", "typecheck"] },
  { label: "Production build", command: npmCommand, args: ["run", "build"] },
]

function runStep(step) {
  return new Promise((resolve, reject) => {
    console.log(`\n==> ${step.label}`)
    const child = spawn(step.command, step.args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    })

    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`${step.label} failed with exit code ${code ?? 1}`))
    })
  })
}

console.log("Running Rekdin demo preflight checks.")
console.log(
  "Note: a successful Next.js build may still print one Turbopack NFT tracing warning around runtime prompt loading."
)

try {
  for (const step of steps) {
    // Run sequentially so a failure stops the pre-record checklist immediately.
    await runStep(step)
  }

  console.log("\nDemo verification passed.")
  console.log("Open public/rekdin-demo-architecture.svg for the system-design slide.")
} catch (error) {
  console.error("\nDemo verification failed.")
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
