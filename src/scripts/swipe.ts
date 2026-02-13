#!/usr/bin/env node

/* eslint-disable no-console */

/**
 * Swipe on the iPhone screen between two points.
 * Coordinates are in screenshot pixels (with grid overlay).
 *
 * Usage: yarn swipe <startX> <startY> <endX> <endY>
 */

import { MirroringService } from '@services/mirroring/mirroring.service';

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const [rawStartX, rawStartY, rawEndX, rawEndY] = args;

  if (!rawStartX || !rawStartY || !rawEndX || !rawEndY) {
    console.error('Usage: yarn swipe <startX> <startY> <endX> <endY>');
    console.error('  startX, startY — start coordinates in screenshot pixels');
    console.error('  endX, endY     — end coordinates in screenshot pixels');
    process.exit(1);
  }

  const startX = Number(rawStartX);
  const startY = Number(rawStartY);
  const endX = Number(rawEndX);
  const endY = Number(rawEndY);

  if (
    !Number.isFinite(startX) ||
    !Number.isFinite(startY) ||
    !Number.isFinite(endX) ||
    !Number.isFinite(endY)
  ) {
    console.error('Error: all coordinates must be numbers');
    process.exit(1);
  }

  const service = new MirroringService();

  try {
    await service.start();
    console.log(`Swiping from (${startX}, ${startY}) to (${endX}, ${endY})...`);
    await service.swipe({ startX, startY, endX, endY });
    console.log('Done.');
  } finally {
    if (service.started) {
      await service.stop();
    }
  }
};

await main();
