#!/usr/bin/env node

/* eslint-disable no-console */

/**
 * Scroll on the iPhone screen at the given coordinates.
 * Coordinates are in screenshot pixels (with grid overlay).
 * Positive deltaY scrolls down (content moves up).
 *
 * Usage: yarn scroll <x> <y> <deltaY>
 *        yarn scroll <x> <y> <deltaX> <deltaY>
 */

import { MirroringService } from '@services/mirroring/mirroring.service';

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error('Usage: yarn scroll <x> <y> <deltaY>');
    console.error('       yarn scroll <x> <y> <deltaX> <deltaY>');
    console.error('  x, y   — coordinates in screenshot pixels');
    console.error('  deltaY — vertical scroll (positive = down, negative = up)');
    console.error('  deltaX — horizontal scroll (positive = right, negative = left)');
    process.exit(1);
  }

  const x = Number(args[0]);
  const y = Number(args[1]);

  let deltaX: number;
  let deltaY: number;

  if (args.length >= 4) {
    deltaX = Number(args[2]);
    deltaY = Number(args[3]);
  } else {
    deltaX = 0;
    deltaY = Number(args[2]);
  }

  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(deltaX) ||
    !Number.isFinite(deltaY)
  ) {
    console.error('Error: all values must be numbers');
    process.exit(1);
  }

  const service = new MirroringService();

  try {
    await service.start();
    const parts = [];
    if (deltaX !== 0) parts.push(`deltaX=${deltaX}`);
    if (deltaY !== 0) parts.push(`deltaY=${deltaY}`);
    console.log(`Scrolling at (${x}, ${y}) ${parts.join(', ')}...`);
    await service.scroll({ x, y, deltaX, deltaY });
    console.log('Done.');
  } finally {
    if (service.started) {
      await service.stop();
    }
  }
};

await main();
