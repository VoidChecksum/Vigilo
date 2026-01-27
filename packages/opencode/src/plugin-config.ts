import * as fs from "fs"
import * as path from "path"
import { VigiloConfigSchema, type VigiloConfig } from "./config/schema"
import { log } from "./shared/logger"
import { deepMerge } from "./shared/deep-merge"
import { getOpenCodeConfigDir } from "./shared/opencode-config-dir"
import { addConfigLoadError } from "./shared/config-errors"
import { parseJsonc, detectConfigFile } from "./shared/jsonc-parser"

export function loadConfigFromPath(
  configPath: string,
  ctx: unknown
): VigiloConfig | null {
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, "utf-8")
      const rawConfig = parseJsonc<Record<string, unknown>>(content)

      const result = VigiloConfigSchema.safeParse(rawConfig)

      if (!result.success) {
        const errorMsg = result.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join(", ")
        log(`Vigilo config validation error in ${configPath}:`, result.error.issues)
        addConfigLoadError({
          path: configPath,
          error: `Validation error: ${errorMsg}`,
        })
        return null
      }

      log(`Vigilo config loaded from ${configPath}`, { auditors: result.data.auditors })
      return result.data
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    log(`Error loading Vigilo config from ${configPath}:`, err)
    addConfigLoadError({ path: configPath, error: errorMsg })
  }
  return null
}

export function mergeConfigs(
  base: VigiloConfig,
  override: VigiloConfig
): VigiloConfig {
  return {
    ...base,
    ...override,
    auditors: deepMerge(base.auditors, override.auditors),
    disabled_auditors: [
      ...new Set([
        ...(base.disabled_auditors ?? []),
        ...(override.disabled_auditors ?? []),
      ]),
    ],
    disabled_skills: [
      ...new Set([
        ...(base.disabled_skills ?? []),
        ...(override.disabled_skills ?? []),
      ]),
    ],
    disabled_hooks: [
      ...new Set([
        ...(base.disabled_hooks ?? []),
        ...(override.disabled_hooks ?? []),
      ]),
    ],
    disabled_commands: [
      ...new Set([
        ...(base.disabled_commands ?? []),
        ...(override.disabled_commands ?? []),
      ]),
    ],
    experimental: deepMerge(base.experimental, override.experimental),
  }
}

export function loadVigiloConfig(
  directory: string,
  ctx: unknown
): VigiloConfig {
  const configDir = getOpenCodeConfigDir({ binary: "opencode" })
  const userBasePath = path.join(configDir, "vigilo")
  const userDetected = detectConfigFile(userBasePath)
  const userConfigPath =
    userDetected.format !== "none"
      ? userDetected.path
      : userBasePath + ".json"

  const projectBasePath = path.join(directory, ".opencode", "vigilo")
  const projectDetected = detectConfigFile(projectBasePath)
  const projectConfigPath =
    projectDetected.format !== "none"
      ? projectDetected.path
      : projectBasePath + ".json"

  let config: VigiloConfig =
    loadConfigFromPath(userConfigPath, ctx) ?? {}

  const projectConfig = loadConfigFromPath(projectConfigPath, ctx)
  if (projectConfig) {
    config = mergeConfigs(config, projectConfig)
  }

  log("Final merged Vigilo config", {
    auditors: config.auditors,
    disabled_auditors: config.disabled_auditors,
    disabled_hooks: config.disabled_hooks,
  })
  return config
}

export type { VigiloConfig }
export type { AuditorOverrideConfig, AuditorOverrides } from "./config/schema"
