import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { getPlatformPackage, getBinaryPath } from "./bin/platform.js";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

function getOpenCodeConfigDir() {
  const home = homedir();
  if (process.platform === "win32") {
    return join(process.env.APPDATA || join(home, "AppData", "Roaming"), "opencode");
  }
  return join(process.env.XDG_CONFIG_HOME || join(home, ".config"), "opencode");
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function installSkills() {
  const packageSkillsDir = join(__dirname, "skills");
  const targetSkillsDir = join(getOpenCodeConfigDir(), "skills");
  
  try {
    const entries = await fs.readdir(packageSkillsDir, { withFileTypes: true });
    const skillDirs = entries.filter(e => e.isDirectory() && !e.name.startsWith("."));
    
    if (skillDirs.length === 0) {
      return;
    }
    
    await fs.mkdir(targetSkillsDir, { recursive: true });
    
    let installed = 0;
    let skipped = 0;
    
    for (const skillDir of skillDirs) {
      const srcSkillDir = join(packageSkillsDir, skillDir.name);
      const destSkillDir = join(targetSkillsDir, skillDir.name);
      
      // Check if skill already exists
      try {
        await fs.access(destSkillDir);
        // Skill exists, skip to avoid overwriting user modifications
        skipped++;
        continue;
      } catch {
        // Skill doesn't exist, install it
      }
      
      await copyDir(srcSkillDir, destSkillDir);
      installed++;
    }
    
    if (installed > 0) {
      console.log(`✓ vigilo skills installed: ${installed} new`);
    }
    if (skipped > 0) {
      console.log(`  ${skipped} skills skipped (already exist)`);
    }
  } catch (error) {
    // Skills directory doesn't exist in package, skip silently
    if (error.code !== "ENOENT") {
      console.warn(`⚠ vigilo: Failed to install skills: ${error.message}`);
    }
  }
}

async function installBinary() {
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

async function main() {
  await Promise.all([
    installBinary(),
    installSkills(),
  ]);
}

main().catch(console.error);
