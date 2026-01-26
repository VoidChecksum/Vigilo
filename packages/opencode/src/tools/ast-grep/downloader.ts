import { existsSync, mkdirSync, chmodSync, unlinkSync, createWriteStream, statSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"
import { createRequire } from "node:module"
import { pipeline } from "node:stream/promises"
import { createGunzip } from "node:zlib"
import { Readable } from "node:stream"

const REPO = "ast-grep/ast-grep"
const DEFAULT_VERSION = "0.40.0"

function getAstGrepVersion(): string {
  try {
    const require_ = createRequire(import.meta.url)
    const pkg = require_("@ast-grep/cli/package.json")
    return pkg.version
  } catch {
    return DEFAULT_VERSION
  }
}

interface PlatformInfo {
  arch: string
  os: string
}

const PLATFORM_MAP: Record<string, PlatformInfo> = {
  "darwin-arm64": { arch: "aarch64", os: "apple-darwin" },
  "darwin-x64": { arch: "x86_64", os: "apple-darwin" },
  "linux-arm64": { arch: "aarch64", os: "unknown-linux-gnu" },
  "linux-x64": { arch: "x86_64", os: "unknown-linux-gnu" },
  "win32-x64": { arch: "x86_64", os: "pc-windows-msvc" },
  "win32-arm64": { arch: "aarch64", os: "pc-windows-msvc" },
  "win32-ia32": { arch: "i686", os: "pc-windows-msvc" },
}

export function getCacheDir(): string {
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || process.env.APPDATA
    const base = localAppData || join(homedir(), "AppData", "Local")
    return join(base, "vigilo", "bin")
  }

  const xdgCache = process.env.XDG_CACHE_HOME
  const base = xdgCache || join(homedir(), ".cache")
  return join(base, "vigilo", "bin")
}

export function getBinaryName(): string {
  return process.platform === "win32" ? "sg.exe" : "sg"
}

export function getCachedBinaryPath(): string | null {
  const binaryPath = join(getCacheDir(), getBinaryName())
  return existsSync(binaryPath) ? binaryPath : null
}

async function extractZip(zipPath: string, destDir: string): Promise<void> {
  const AdmZip = await import("adm-zip").then(m => m.default)
  const zip = new AdmZip(zipPath)
  zip.extractAllTo(destDir, true)
}

export async function downloadAstGrep(version: string = DEFAULT_VERSION): Promise<string | null> {
  const platformKey = `${process.platform}-${process.arch}`
  const platformInfo = PLATFORM_MAP[platformKey]

  if (!platformInfo) {
    console.error(`[vigilo] Unsupported platform for ast-grep: ${platformKey}`)
    return null
  }

  const cacheDir = getCacheDir()
  const binaryName = getBinaryName()
  const binaryPath = join(cacheDir, binaryName)

  if (existsSync(binaryPath)) {
    return binaryPath
  }

  const { arch, os } = platformInfo
  const assetName = `app-${arch}-${os}.zip`
  const downloadUrl = `https://github.com/${REPO}/releases/download/${version}/${assetName}`

  console.log(`[vigilo] Downloading ast-grep binary...`)

  try {
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true })
    }

    const response = await fetch(downloadUrl, { redirect: "follow" })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const archivePath = join(cacheDir, assetName)
    const arrayBuffer = await response.arrayBuffer()
    const { writeFileSync } = await import("node:fs")
    writeFileSync(archivePath, Buffer.from(arrayBuffer))

    await extractZip(archivePath, cacheDir)

    if (existsSync(archivePath)) {
      unlinkSync(archivePath)
    }

    if (process.platform !== "win32" && existsSync(binaryPath)) {
      chmodSync(binaryPath, 0o755)
    }

    console.log(`[vigilo] ast-grep binary ready.`)

    return binaryPath
  } catch (err) {
    console.error(
      `[vigilo] Failed to download ast-grep: ${err instanceof Error ? err.message : err}`
    )
    return null
  }
}

export async function ensureAstGrepBinary(): Promise<string | null> {
  const cachedPath = getCachedBinaryPath()
  if (cachedPath) {
    return cachedPath
  }

  const version = getAstGrepVersion()
  return downloadAstGrep(version)
}
