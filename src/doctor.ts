#!/usr/bin/env node

/* eslint-disable no-console */

/**
 * Preflight check — verifies that the environment is ready to run iphone-mcp.
 * Run with: yarn doctor
 */

import { access } from 'node:fs/promises';

import { execFile } from '@lib/utils';

const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const WARN = '\x1b[33m!\x1b[0m';

async function getHostAppName(): Promise<string> {
  try {
    // Walk up the process tree to find the outermost .app (terminal/IDE)
    let pid = process.ppid;
    let lastApp = '';
    for (let i = 0; i < 10; i++) {
      // Use wide column to avoid truncation of long paths
      const { stdout } = await execFile('ps', [
        '-p',
        String(pid),
        '-o',
        'comm=',
        '-ww',
      ]);
      const comm = stdout.trim();
      if (!comm) break;

      // Extract the .app name from the path (e.g. "/Applications/Visual Studio Code.app/Contents/MacOS/Electron")
      const appMatch = /\/([^/]+)\.app\b/.exec(comm);
      if (appMatch) {
        lastApp = appMatch[1];
      }

      // Get the parent pid separately to avoid column width issues
      const { stdout: ppidOut } = await execFile('ps', [
        '-p',
        String(pid),
        '-o',
        'ppid=',
      ]);
      const ppid = Number(ppidOut.trim());
      if (ppid <= 1) break;
      pid = ppid;
    }
    return lastApp || 'your terminal app';
  } catch {
    return 'your terminal app';
  }
}

let failures = 0;

function pass(msg: string): void {
  console.log(`  ${PASS} ${msg}`);
}

function fail(msg: string, hint?: string): void {
  console.log(`  ${FAIL} ${msg}`);
  if (hint) console.log(`    → ${hint}`);
  failures++;
}

function warn(msg: string, hint?: string): void {
  console.log(`  ${WARN} ${msg}`);
  if (hint) console.log(`    → ${hint}`);
}

async function checkMacOS(): Promise<void> {
  try {
    const { stdout } = await execFile('sw_vers', ['-productVersion']);
    const version = stdout.trim();
    const major = Number(version.split('.')[0]);
    if (major >= 15) {
      pass(`macOS ${version} (Sequoia or later)`);
    } else {
      fail(
        `macOS ${version} — requires macOS 15 (Sequoia) or later`,
        'iPhone Mirroring is only available on macOS Sequoia 15+',
      );
    }
  } catch {
    fail('Could not detect macOS version', 'This tool only works on macOS');
  }
}

function checkNode(): void {
  const version = process.version;
  const major = Number(version.slice(1).split('.')[0]);
  if (major >= 24) {
    pass(`Node.js ${version}`);
  } else {
    fail(
      `Node.js ${version} — requires v24+`,
      'Install Node.js 24+ from https://nodejs.org',
    );
  }
}

async function checkIPhoneMirroringApp(): Promise<void> {
  const appPath = '/System/Applications/iPhone Mirroring.app';
  try {
    await access(appPath);
    pass('iPhone Mirroring app found');
  } catch {
    fail(
      'iPhone Mirroring app not found',
      'Requires macOS Sequoia 15+. The app should be at /System/Applications/iPhone Mirroring.app',
    );
  }
}

async function checkUsbmuxd(): Promise<void> {
  const socketPath = '/var/run/usbmuxd';
  try {
    await access(socketPath);
    pass('usbmuxd socket exists');
  } catch {
    fail(
      'usbmuxd socket not found at /var/run/usbmuxd',
      'usbmuxd is a macOS system daemon — it should exist automatically',
    );
  }
}

async function checkConnectedDevice(): Promise<void> {
  try {
    const { stdout } = await execFile('system_profiler', ['SPUSBDataType']);
    if (stdout.includes('iPhone')) {
      pass('iPhone detected via USB');
    } else {
      warn(
        'No iPhone detected via USB',
        'Connect your iPhone with a USB cable and tap "Trust This Computer"',
      );
    }
  } catch {
    warn('Could not query USB devices');
  }
}

async function checkAccessibilityPermission(appName: string): Promise<void> {
  const script = `
ObjC.import('Cocoa');
$.AXIsProcessTrusted();
`;
  try {
    const { stdout } = await execFile('osascript', [
      '-l',
      'JavaScript',
      '-e',
      script,
    ]);
    if (stdout.trim() === 'true') {
      pass('Accessibility permission granted');
    } else {
      warn(
        'Accessibility permission not granted',
        `Go to System Settings > Privacy & Security > Accessibility and add ${appName}`,
      );
    }
  } catch {
    warn(
      'Could not check accessibility permission',
      `Tap/swipe/type require Accessibility access — add ${appName} in System Settings`,
    );
  }
}

async function checkScreenRecordingPermission(appName: string): Promise<void> {
  try {
    const { stdout } = await execFile('osascript', [
      '-l',
      'JavaScript',
      '-e',
      'ObjC.import("CoreGraphics"); $.CGPreflightScreenCaptureAccess()',
    ]);
    if (stdout.trim() === 'true') {
      pass('Screen Recording permission granted');
    } else {
      warn(
        'Screen Recording permission not granted',
        `Go to System Settings > Privacy & Security > Screen Recording and add ${appName}`,
      );
    }
  } catch {
    warn(
      'Could not check Screen Recording permission',
      `Screenshots require Screen Recording access — add ${appName} in System Settings`,
    );
  }
}

async function main(): Promise<void> {
  console.log('\niphone-mcp preflight check\n');

  console.log('System:');
  await checkMacOS();
  checkNode();
  console.log();

  console.log('Dependencies:');
  await checkIPhoneMirroringApp();
  await checkUsbmuxd();
  console.log();

  console.log('Device:');
  await checkConnectedDevice();
  console.log();

  console.log('Permissions:');
  const appName = await getHostAppName();
  await checkAccessibilityPermission(appName);
  await checkScreenRecordingPermission(appName);
  console.log();

  if (failures > 0) {
    console.log(
      `\x1b[31m${failures} check(s) failed.\x1b[0m Fix the issues above before running iphone-mcp.\n`,
    );
    process.exit(1);
  } else {
    console.log('\x1b[32mAll checks passed.\x1b[0m Ready to run iphone-mcp.\n');
  }
}

await main();
