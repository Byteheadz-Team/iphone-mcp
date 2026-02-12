#!/usr/bin/env node

/* eslint-disable no-console */

/**
 * Preflight check — verifies that the environment is ready to run iphone-mcp.
 * Run with: yarn doctor
 */

import { access, readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MirroringClient } from '@lib/mirroring';
import { execFile } from '@lib/utils';

const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const WARN = '\x1b[33m!\x1b[0m';

let failures = 0;

const pass = (msg: string): void => {
  console.log(`  ${PASS} ${msg}`);
};

const fail = (msg: string, hint?: string): void => {
  console.log(`  ${FAIL} ${msg}`);
  if (hint) console.log(`    → ${hint}`);
  failures++;
};

const warn = (msg: string, hint?: string): void => {
  console.log(`  ${WARN} ${msg}`);
  if (hint) console.log(`    → ${hint}`);
};

const checkMacOS = async (): Promise<void> => {
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
};

const checkNode = (): void => {
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
};

const checkIPhoneMirroringApp = async (): Promise<void> => {
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
};

const checkConnectedDevice = async (): Promise<void> => {
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
};

const checkAccessibilityPermission = async (appName: string): Promise<void> => {
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
};

const checkScreenRecordingPermission = async (
  appName: string,
): Promise<void> => {
  const probe = join(tmpdir(), `screc-probe-${Date.now()}.png`);
  try {
    await execFile('screencapture', ['-x', '-t', 'png', probe]);
    const buf = await readFile(probe);
    if (buf.length > 0) {
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
  } finally {
    await unlink(probe).catch(() => {});
  }
};

const main = async (): Promise<void> => {
  console.log('\niphone-mcp preflight check\n');

  console.log('System:');
  await checkMacOS();
  checkNode();
  console.log();

  console.log('Dependencies:');
  await checkIPhoneMirroringApp();
  console.log();

  console.log('Device:');
  await checkConnectedDevice();
  console.log();

  console.log('Permissions:');
  const appName = await new MirroringClient().getHostAppName();
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
};

await main();
