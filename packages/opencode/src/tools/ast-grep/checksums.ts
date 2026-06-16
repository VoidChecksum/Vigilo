import { createHash } from "node:crypto"

/**
 * Pinned SHA-256 of the ast-grep release ZIPs, keyed by version → `${platform}-${arch}`.
 * The downloader verifies fetched archives against these before extracting/executing, so a
 * tampered or MITM'd download is rejected rather than chmod+run (supply-chain hardening for a
 * security tool). Values computed from the official `ast-grep/ast-grep` GitHub release assets.
 */
export const AST_GREP_CHECKSUMS: Record<string, Record<string, string>> = {
  "0.40.0": {
    "linux-x64": "936e67e9cb4bf7a422401a459ff14f3608d944d7500495553648f7c63a25929b",
    "linux-arm64": "ef80b60c50f99b06ef5afae760c157153f37e77e8d2296da4adbec0a11409a7a",
    "darwin-arm64": "fabfd23fe06ed780ecfa2250adc7615221bfbfa962902b6f3807de67bcef253f",
    "darwin-x64": "dccb1d009b285531f841f850944519a3919a4788b9fbd8a2f7bf3969ff68d836",
    "win32-x64": "3534f3905abf55fbce606b891b5e4f8b1083fe1168455b5d61affff678391107",
  },
  // 0.40.5 is the version the `^0.40.0` dependency range currently resolves to;
  // pin every platform so the verified-download path is the default, not the
  // opt-out path. Computed from the official ast-grep/ast-grep 0.40.5 release ZIPs.
  "0.40.5": {
    "linux-x64": "9715cb5933a4d7fe9e4d8c2be870a9a82840c3f2ec4a57bdff7f15d0912cc676",
    "linux-arm64": "9596c2abfdf450203e5653e185d805133d5499f8c2cbb00b1aab54754ca70e13",
    "darwin-arm64": "55c3a471a483daab49b6413972c3655087f2ce47335ab019067ed1fbf6672107",
    "darwin-x64": "4e1e6ae14aefb36a1a846bb6f1f951ca3f24895896161661c6cb589e0841fbd9",
    "win32-x64": "50a596ef5231883ddae69f1960d27312bb2fe81254d67ef50e1794fc9820e863",
    "win32-arm64": "7613a619621b9afed5b0866232c56a314228eb1b9af407149d4a91b20c61eb05",
    "win32-ia32": "c70899b658a8b7110612cf08152bfaa9a764637d8f7caa5aa7917fa18728f824",
  },
}

export function sha256(buf: Uint8Array): string {
  return createHash("sha256").update(buf).digest("hex")
}

export type ChecksumStatus = "ok" | "mismatch" | "unknown"

export interface ChecksumCheck {
  status: ChecksumStatus
  actual: string
  expected?: string
}

/**
 * Verify a downloaded ast-grep archive. `unknown` = no pin for this version/platform
 * (newer release or rare platform); the downloader treats this as fail-closed unless
 * the operator opts in via VIGILO_ALLOW_UNVERIFIED_AST_GREP=1. `mismatch` is always a
 * hard failure.
 */
export function verifyAstGrepChecksum(version: string, platformKey: string, buf: Uint8Array): ChecksumCheck {
  const actual = sha256(buf)
  const expected = AST_GREP_CHECKSUMS[version]?.[platformKey]
  if (!expected) return { status: "unknown", actual }
  return { status: actual === expected ? "ok" : "mismatch", actual, expected }
}
