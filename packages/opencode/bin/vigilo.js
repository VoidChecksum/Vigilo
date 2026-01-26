#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { getPlatformPackage, getBinaryPath } from "./platform.js";

const require = createRequire(import.meta.url);

function getLibcFamily() {
  if (process.platform !== "linux") {
    return undefined;
  }
  
  try {
    const detectLibc = require("detect-libc");
    return detectLibc.familySync();
  } catch {
    return null;
  }
}

function main() {
  const { platform, arch } = process;
  const libcFamily = getLibcFamily();
  
  let pkg;
  try {
    pkg = getPlatformPackage({ platform, arch, libcFamily });
  } catch (error) {
    console.error(`\nvigilo: ${error.message}\n`);
    process.exit(1);
  }
  
  const binRelPath = getBinaryPath(pkg, platform);
  
  let binPath;
  try {
    binPath = require.resolve(binRelPath);
  } catch {
    console.error(`\nvigilo: Platform binary not installed.`);
    console.error(`\nYour platform: ${platform}-${arch}${libcFamily === "musl" ? "-musl" : ""}`);
    console.error(`Expected package: ${pkg}`);
    console.error(`\nTo fix, run:`);
    console.error(`  npm install ${pkg}\n`);
    process.exit(1);
  }
  
  const result = spawnSync(binPath, process.argv.slice(2), {
    stdio: "inherit",
  });
  
  if (result.error) {
    console.error(`\nvigilo: Failed to execute binary.`);
    console.error(`Error: ${result.error.message}\n`);
    process.exit(2);
  }
  
  if (result.signal) {
    const signalNum = result.signal === "SIGTERM" ? 15 : 
                      result.signal === "SIGKILL" ? 9 :
                      result.signal === "SIGINT" ? 2 : 1;
    process.exit(128 + signalNum);
  }

  process.exit(result.status ?? 1);
}

main();
