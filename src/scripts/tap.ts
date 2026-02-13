#!/usr/bin/env node

/* eslint-disable no-console */

/**
 * Tap on the iPhone screen at the given coordinates.
 * Coordinates are in screenshot pixels (with grid overlay).
 *
 * Usage: yarn tap <x> <y>
 */

import { MirroringService } from '@services/mirroring/mirroring.service';

const main = async (): Promise<void> => {
  const [rawX, rawY] = process.argv.slice(2);

  if (!rawX || !rawY) {
    console.error('Usage: yarn tap <x> <y>');
    console.error('  x, y — coordinates in screenshot pixels');
    process.exit(1);
  }

  const x = Number(rawX);
  const y = Number(rawY);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    console.error('Error: x and y must be numbers');
    process.exit(1);
  }

  const service = new MirroringService();

  try {
    await service.start();
    console.log(`Tapping at (${x}, ${y})...`);
    await service.tap({ x, y });
    console.log('Done.');
  } finally {
    if (service.started) {
      await service.stop();
    }
  }
};

await main();
