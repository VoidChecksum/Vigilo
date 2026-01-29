export function log(message: string, data?: Record<string, unknown>): void {
  if (process.env.DEBUG || process.env.VIGILO_DEBUG) {
    console.log(`[vigilo] ${message}`, data ? JSON.stringify(data, null, 2) : "")
  }
}
