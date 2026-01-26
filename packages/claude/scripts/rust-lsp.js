#!/usr/bin/env node
// Cross-platform launcher for Rust Analyzer (rust-analyzer)
const { spawn, execSync } = require('child_process');
const isWindows = process.platform === 'win32';

// Check if rust-analyzer is installed
function isInstalled() {
  try {
    execSync('rust-analyzer --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Install rust-analyzer via rustup
function install() {
  console.error('[vigilo] Installing rust-analyzer via rustup...');
  try {
    execSync('rustup component add rust-analyzer', {
      stdio: ['ignore', 'pipe', 'inherit']
    });
    console.error('[vigilo] rust-analyzer installed successfully.');
    return true;
  } catch (err) {
    console.error('[vigilo] Failed to install rust-analyzer.');
    console.error('[vigilo] Please install rustup first: https://rustup.rs/');
    return false;
  }
}

// Main
if (!isInstalled()) {
  if (!install()) {
    process.exit(1);
  }
}

// Start LSP server
const child = spawn('rust-analyzer', [], {
  stdio: ['inherit', 'inherit', 'inherit'],
  shell: isWindows
});

child.on('error', (err) => {
  console.error('[vigilo] Failed to start rust-analyzer:', err);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
