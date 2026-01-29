import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import type { ConfigMergeResult, DetectedConfig, InstallConfig } from "./types"
import { generateModelConfig } from "./model-fallback"

const PACKAGE_NAME = "vigilo"

interface NodeError extends Error {
  code?: string
}

function isPermissionError(err: unknown): boolean {
  const nodeErr = err as NodeError
  return nodeErr?.code === "EACCES" || nodeErr?.code === "EPERM"
}

function formatErrorWithSuggestion(err: unknown, context: string): string {
  if (isPermissionError(err)) {
    return `Permission denied: Cannot ${context}. Try running with elevated permissions.`
  }

  if (err instanceof SyntaxError) {
    return `JSON syntax error while trying to ${context}: ${err.message}`
  }

  const message = err instanceof Error ? err.message : String(err)
  return `Failed to ${context}: ${message}`
}

function getConfigDir(): string {
  return join(homedir(), ".config", "opencode")
}

function getConfigJson(): string {
  return join(getConfigDir(), "opencode.json")
}

function getConfigJsonc(): string {
  return join(getConfigDir(), "opencode.jsonc")
}

function getVigiloConfig(): string {
  return join(getConfigDir(), "vigilo.json")
}

function ensureConfigDir(): void {
  const configDir = getConfigDir()
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true })
  }
}

type ConfigFormat = "json" | "jsonc" | "none"

interface OpenCodeConfig {
  plugin?: string[]
  [key: string]: unknown
}

function detectConfigFormat(): { format: ConfigFormat; path: string } {
  const configJsonc = getConfigJsonc()
  const configJson = getConfigJson()

  if (existsSync(configJsonc)) {
    return { format: "jsonc", path: configJsonc }
  }
  if (existsSync(configJson)) {
    return { format: "json", path: configJson }
  }
  return { format: "none", path: configJson }
}

function parseConfig(path: string): OpenCodeConfig | null {
  try {
    const stat = statSync(path)
    if (stat.size === 0) return null

    const content = readFileSync(path, "utf-8")
    if (content.trim().length === 0) return null

    const config = JSON.parse(content)
    if (typeof config !== "object" || Array.isArray(config)) return null

    return config
  } catch {
    return null
  }
}

export async function fetchLatestVersion(packageName: string): Promise<string | null> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${packageName}/latest`)
    if (!res.ok) return null
    const data = await res.json() as { version: string }
    return data.version
  } catch {
    return null
  }
}

export async function getPluginNameWithVersion(currentVersion: string): Promise<string> {
  const latestVersion = await fetchLatestVersion(PACKAGE_NAME)
  if (latestVersion === currentVersion) {
    return `${PACKAGE_NAME}@latest`
  }
  return `${PACKAGE_NAME}@${currentVersion}`
}

export async function addPluginToOpenCodeConfig(currentVersion: string): Promise<ConfigMergeResult> {
  try {
    ensureConfigDir()
  } catch (err) {
    return { success: false, configPath: getConfigDir(), error: formatErrorWithSuggestion(err, "create config directory") }
  }

  const { format, path } = detectConfigFormat()
  const pluginEntry = await getPluginNameWithVersion(currentVersion)

  try {
    if (format === "none") {
      const config: OpenCodeConfig = { plugin: [pluginEntry] }
      writeFileSync(path, JSON.stringify(config, null, 2) + "\n")
      return { success: true, configPath: path }
    }

    const config = parseConfig(path)
    if (!config) {
      const newConfig: OpenCodeConfig = { plugin: [pluginEntry] }
      writeFileSync(path, JSON.stringify(newConfig, null, 2) + "\n")
      return { success: true, configPath: path }
    }

    const plugins = config.plugin ?? []
    const existingIndex = plugins.findIndex((p) => p === PACKAGE_NAME || p.startsWith(`${PACKAGE_NAME}@`))

    if (existingIndex !== -1) {
      if (plugins[existingIndex] === pluginEntry) {
        return { success: true, configPath: path }
      }
      plugins[existingIndex] = pluginEntry
    } else {
      plugins.push(pluginEntry)
    }

    config.plugin = plugins
    writeFileSync(path, JSON.stringify(config, null, 2) + "\n")

    return { success: true, configPath: path }
  } catch (err) {
    return { success: false, configPath: path, error: formatErrorWithSuggestion(err, "update opencode config") }
  }
}

function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target }

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceValue = source[key]
    const targetValue = result[key]

    if (
      sourceValue !== null &&
      typeof sourceValue === "object" &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === "object" &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      ) as T[keyof T]
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[keyof T]
    }
  }

  return result
}

export function writeVigiloConfig(installConfig: InstallConfig): ConfigMergeResult {
  try {
    ensureConfigDir()
  } catch (err) {
    return { success: false, configPath: getConfigDir(), error: formatErrorWithSuggestion(err, "create config directory") }
  }

  const vigiloConfigPath = getVigiloConfig()

  try {
    const newConfig = generateModelConfig(installConfig)

    if (existsSync(vigiloConfigPath)) {
      try {
        const stat = statSync(vigiloConfigPath)
        const content = readFileSync(vigiloConfigPath, "utf-8")

        if (stat.size === 0 || content.trim().length === 0) {
          writeFileSync(vigiloConfigPath, JSON.stringify(newConfig, null, 2) + "\n")
          return { success: true, configPath: vigiloConfigPath }
        }

        const existing = JSON.parse(content) as Record<string, unknown>
        if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
          writeFileSync(vigiloConfigPath, JSON.stringify(newConfig, null, 2) + "\n")
          return { success: true, configPath: vigiloConfigPath }
        }

        const merged = deepMerge(existing, newConfig)
        writeFileSync(vigiloConfigPath, JSON.stringify(merged, null, 2) + "\n")
      } catch (parseErr) {
        if (parseErr instanceof SyntaxError) {
          writeFileSync(vigiloConfigPath, JSON.stringify(newConfig, null, 2) + "\n")
          return { success: true, configPath: vigiloConfigPath }
        }
        throw parseErr
      }
    } else {
      writeFileSync(vigiloConfigPath, JSON.stringify(newConfig, null, 2) + "\n")
    }

    return { success: true, configPath: vigiloConfigPath }
  } catch (err) {
    return { success: false, configPath: vigiloConfigPath, error: formatErrorWithSuggestion(err, "write vigilo config") }
  }
}

export async function isOpenCodeInstalled(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["opencode", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    })
    await proc.exited
    return proc.exitCode === 0
  } catch {
    return false
  }
}

export async function getOpenCodeVersion(): Promise<string | null> {
  try {
    const proc = Bun.spawn(["opencode", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const output = await new Response(proc.stdout).text()
    await proc.exited
    if (proc.exitCode === 0) {
      return output.trim()
    }
    return null
  } catch {
    return null
  }
}

export async function isFoundryInstalled(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["forge", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    })
    await proc.exited
    return proc.exitCode === 0
  } catch {
    return false
  }
}

export async function getFoundryVersion(): Promise<string | null> {
  try {
    const proc = Bun.spawn(["forge", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const output = await new Response(proc.stdout).text()
    await proc.exited
    if (proc.exitCode === 0) {
      const match = output.match(/forge (\S+)/)
      return match ? match[1] : output.trim().split("\n")[0]
    }
    return null
  } catch {
    return null
  }
}

function detectProvidersFromVigiloConfig(): { hasOpenAI: boolean; hasOpencodeZen: boolean } {
  const vigiloConfigPath = getVigiloConfig()
  if (!existsSync(vigiloConfigPath)) {
    return { hasOpenAI: true, hasOpencodeZen: true }
  }

  try {
    const content = readFileSync(vigiloConfigPath, "utf-8")
    const vigiloConfig = JSON.parse(content) as Record<string, unknown>
    if (!vigiloConfig || typeof vigiloConfig !== "object") {
      return { hasOpenAI: true, hasOpencodeZen: true }
    }

    const configStr = JSON.stringify(vigiloConfig)
    const hasOpenAI = configStr.includes('"openai/')
    const hasOpencodeZen = configStr.includes('"opencode/')

    return { hasOpenAI, hasOpencodeZen }
  } catch {
    return { hasOpenAI: true, hasOpencodeZen: true }
  }
}

export function detectCurrentConfig(): DetectedConfig {
  const result: DetectedConfig = {
    isInstalled: false,
    hasClaude: true,
    isMax20: true,
    hasOpenAI: true,
    hasGemini: false,
    hasCopilot: false,
    hasOpencodeZen: true,
    hasFoundry: false,
  }

  const { format, path } = detectConfigFormat()
  if (format === "none") {
    return result
  }

  const config = parseConfig(path)
  if (!config) {
    return result
  }

  const plugins = config.plugin ?? []
  result.isInstalled = plugins.some((p) => 
    p.startsWith(PACKAGE_NAME) || 
    p.includes(`/${PACKAGE_NAME}`) ||
    p.includes(`\\${PACKAGE_NAME}`)
  )

  if (!result.isInstalled) {
    return result
  }

  const vigiloConfigPath = getVigiloConfig()
  if (existsSync(vigiloConfigPath)) {
    try {
      const vigiloConfig = JSON.parse(readFileSync(vigiloConfigPath, "utf-8")) as Record<string, unknown>
      result.hasFoundry = (vigiloConfig.foundry as boolean) ?? false
    } catch {
      // ignore parse errors
    }
  }

  const { hasOpenAI, hasOpencodeZen } = detectProvidersFromVigiloConfig()
  result.hasOpenAI = hasOpenAI
  result.hasOpencodeZen = hasOpencodeZen

  return result
}
