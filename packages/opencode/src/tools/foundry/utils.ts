import { spawn } from "node:child_process"

const isWindows = process.platform === "win32"

export async function runCommand(cmdArgs: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const command = isWindows ? "cmd" : cmdArgs[0]
    const args = isWindows ? ["/c", ...cmdArgs] : cmdArgs.slice(1)

    const proc = spawn(command, args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""

    proc.stdout.on("data", (data) => {
      stdout += data.toString()
    })

    proc.stderr.on("data", (data) => {
      stderr += data.toString()
    })

    proc.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 1 })
    })

    proc.on("error", (err) => {
      reject(err)
    })
  })
}

export function parseTestSummary(stdout: string): { passed: number; failed: number } {
  const passMatch = stdout.match(/(\d+) tests? passed/)
  const failMatch = stdout.match(/(\d+) tests? failed/)
  return {
    passed: passMatch ? parseInt(passMatch[1]) : 0,
    failed: failMatch ? parseInt(failMatch[1]) : 0,
  }
}
