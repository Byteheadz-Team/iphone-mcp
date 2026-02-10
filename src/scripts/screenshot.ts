#!/usr/bin/env node

/* eslint-disable no-console */

/**
 * Capture the iPhone Mirroring window with a coordinate grid overlay
 * and save it to the current directory. Launches iPhone Mirroring if not already open.
 *
 * Run with: yarn screenshot
 */

import { writeFile } from 'node:fs/promises';

import { MirroringService } from '@services/mirroring/mirroring.service';

async function main(): Promise<void> {
  const service = new MirroringService();

  try {
    console.log('Starting mirroring service...');
    await service.start();

    console.log('Capturing screenshot...');
    const buffer = await service.takeScreenshot();

    const filename = `iphone-screenshot-${Date.now()}.png`;
    await writeFile(filename, buffer);

    console.log(`Saved to ${filename}`);
  } finally {
    if (service.started) {
      await service.stop();
    }
  }
}

await main();
