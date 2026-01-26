import { createRequire } from "node:module";
import { getPlatformPackage, getBinaryPath } from "./bin/platform.js";

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
  
  try {
    const pkg = getPlatformPackage({ platform, arch, libcFamily });
    const binPath = getBinaryPath(pkg, platform);
    
    require.resolve(binPath);
    console.log(`✓ vigilo binary installed for ${platform}-${arch}`);
  } catch (error) {
    console.warn(`⚠ vigilo: ${error.message}`);
    console.warn(`  The CLI may not work on this platform.`);
  }
}

main();
