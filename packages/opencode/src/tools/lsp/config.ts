import { existsSync } from "node:fs"
import { join } from "node:path"
import { BUILTIN_SERVERS, EXT_TO_LANG, LSP_INSTALL_HINTS } from "./constants"
import type { ResolvedServer, ServerLookupResult } from "./types"

type ConfigSource = "project" | "user" | "builtin"

interface ServerWithSource extends ResolvedServer {
  source: ConfigSource
}

function getMergedServers(): ServerWithSource[] {
  const servers: ServerWithSource[] = []

  for (const [id, config] of Object.entries(BUILTIN_SERVERS)) {
    servers.push({
      id,
      command: config.command,
      extensions: config.extensions,
      priority: config.priority ?? -100,
      env: config.env,
      initialization: config.initialization,
      source: "builtin",
    })
  }

  return servers.sort((a, b) => b.priority - a.priority)
}

export function findServerForExtension(ext: string): ServerLookupResult {
  const servers = getMergedServers()

  for (const server of servers) {
    if (server.extensions.includes(ext) && isServerInstalled(server.command)) {
      return {
        status: "found",
        server: {
          id: server.id,
          command: server.command,
          extensions: server.extensions,
          priority: server.priority,
          env: server.env,
          initialization: server.initialization,
        },
      }
    }
  }

  for (const server of servers) {
    if (server.extensions.includes(ext)) {
      const installHint =
        LSP_INSTALL_HINTS[server.id] || `Install '${server.command[0]}' and ensure it's in your PATH`
      return {
        status: "not_installed",
        server: {
          id: server.id,
          command: server.command,
          extensions: server.extensions,
        },
        installHint,
      }
    }
  }

  const availableServers = [...new Set(servers.map((s) => s.id))]
  return {
    status: "not_configured",
    extension: ext,
    availableServers,
  }
}

export function getLanguageId(ext: string): string {
  return EXT_TO_LANG[ext] || "plaintext"
}

export function isServerInstalled(command: string[]): boolean {
  if (command.length === 0) return false

  const cmd = command[0]

  if (cmd.includes("/") || cmd.includes("\\")) {
    if (existsSync(cmd)) return true
  }

  const isWindows = process.platform === "win32"

  let exts = [""]
  if (isWindows) {
    const pathExt = process.env.PATHEXT || ""
    if (pathExt) {
      const systemExts = pathExt.split(";").filter(Boolean)
      exts = [...new Set([...exts, ...systemExts, ".exe", ".cmd", ".bat", ".ps1"])]
    } else {
      exts = ["", ".exe", ".cmd", ".bat", ".ps1"]
    }
  }

  let pathEnv = process.env.PATH || ""
  if (isWindows && !pathEnv) {
    pathEnv = process.env.Path || ""
  }

  const pathSeparator = isWindows ? ";" : ":"
  const paths = pathEnv.split(pathSeparator)

  for (const p of paths) {
    for (const suffix of exts) {
      if (existsSync(join(p, cmd + suffix))) {
        return true
      }
    }
  }

  const cwd = process.cwd()
  const additionalBases = [
    join(cwd, "node_modules", ".bin"),
  ]

  for (const base of additionalBases) {
    for (const suffix of exts) {
      if (existsSync(join(base, cmd + suffix))) {
        return true
      }
    }
  }

  if (cmd === "bun" || cmd === "node" || cmd === "npx") {
    return true
  }

  return false
}

export function getAllServers(): Array<{
  id: string
  installed: boolean
  extensions: string[]
  source: string
  priority: number
}> {
  const servers = getMergedServers()

  return servers.map((server) => ({
    id: server.id,
    installed: isServerInstalled(server.command),
    extensions: server.extensions,
    source: server.source,
    priority: server.priority,
  }))
}

export function getInstalledWeb3Servers(): string[] {
  const web3Extensions = [".sol", ".vy", ".cairo", ".move"]
  const installed: string[] = []

  for (const ext of web3Extensions) {
    const result = findServerForExtension(ext)
    if (result.status === "found") {
      installed.push(result.server.id)
    }
  }

  return [...new Set(installed)]
}
