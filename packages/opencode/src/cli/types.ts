export type BooleanArg = "no" | "yes"
export type AuditModel = "sonnet" | "opus"

export interface InstallArgs {
  tui: boolean
  foundry?: BooleanArg
  model?: AuditModel
  skipAuth?: boolean
}

export interface InstallConfig {
  hasFoundry: boolean
  auditModel: string
}

export interface ConfigMergeResult {
  success: boolean
  configPath: string
  error?: string
}

export interface DetectedConfig {
  isInstalled: boolean
  hasFoundry: boolean
  auditModel: string
}

export interface DoctorOptions {
  verbose?: boolean
  json?: boolean
  category?: string
}

export interface CheckResult {
  id: string
  name: string
  status: "pass" | "fail" | "warn" | "skip"
  message: string
  details?: string[]
}
