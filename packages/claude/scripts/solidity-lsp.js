#!/usr/bin/env node
// Cross-platform launcher for Solidity Language Server
const { spawn, execSync } = require('child_process');
const path = require('path');

const PACKAGE_NAME = '@nomicfoundation/solidity-language-server';
const isWindows = process.platform === 'win32';

// Check if package is installed globally
function isPackageInstalled() {
  try {
    if (isWindows) {
      execSync(`npm list -g ${PACKAGE_NAME}`, { stdio: 'ignore' });
    } else {
      execSync(`npm list -g ${PACKAGE_NAME}`, { stdio: 'ignore' });
    }
    return true;
  } catch {
    return false;
  }
}

// Install package globally
function installPackage() {
  console.error(`[vigilo] Installing ${PACKAGE_NAME}...`);
  try {
    // Use pipe to stderr only, keep stdout clean for LSP protocol
    execSync(`npm install -g ${PACKAGE_NAME}`, {
      stdio: ['ignore', 'pipe', 'inherit']  // stdin: ignore, stdout: pipe (capture), stderr: show
    });
    console.error(`[vigilo] ${PACKAGE_NAME} installed successfully.`);
    return true;
  } catch (err) {
    console.error(`[vigilo] Failed to install ${PACKAGE_NAME}:`, err.message);
    return false;
  }
}

// Main
if (!isPackageInstalled()) {
  if (!installPackage()) {
    process.exit(1);
  }
}

// Start LSP server
let child;

if (isWindows) {
  child = spawn('cmd.exe', ['/c', 'npx', PACKAGE_NAME, '--stdio'], {
    stdio: ['inherit', 'inherit', 'inherit']
  });
} else {
  child = spawn('npx', [PACKAGE_NAME, '--stdio'], {
    stdio: ['inherit', 'inherit', 'inherit']
  });
}

child.on('error', (err) => {
  console.error('[vigilo] Failed to start Solidity LSP:', err);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
