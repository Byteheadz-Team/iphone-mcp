#!/usr/bin/env node

/* eslint-disable no-console */

/**
 * Scroll on the iPhone screen at the given coordinates.
 * Coordinates are in screenshot pixels (with grid overlay).
 *
 * Usage: yarn scroll <x> <y> [direction] [distance]
 *   direction — up, down, left, right (default: down)
 *   distance  — scroll-wheel pixels (default: 150)
 */

import {
  MirroringService,
  type ScrollDirection,
} from '@services/mirroring/mirroring.service';

const VALID_DIRECTIONS = new Set(['up', 'down', 'left', 'right']);

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: yarn scroll <x> <y> [direction] [distance]');
    console.error('  x, y      — coordinates in screenshot pixels');
    console.error(
      '  direction — up, down, left, right (default: down)',
    );
    console.error(
      '  distance  — scroll-wheel pixels (default: 150, ~0.9 pages)',
    );
    process.exit(1);
  }

  const x = Number(args[0]);
  const y = Number(args[1]);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    console.error('Error: x and y must be numbers');
    process.exit(1);
  }

  let direction: ScrollDirection | undefined;
  let distance: number | undefined;

  if (args.length >= 3) {
    const dirArg = args[2];
    if (VALID_DIRECTIONS.has(dirArg)) {
      direction = dirArg as ScrollDirection;
    } else {
      const parsed = Number(dirArg);
      if (Number.isFinite(parsed) && parsed > 0) {
        distance = parsed;
      } else {
        console.error(
          `Error: invalid direction or distance "${dirArg}". ` +
            'Direction must be up/down/left/right, distance must be a positive number.',
        );
        process.exit(1);
      }
    }
  }

  if (args.length >= 4) {
    const parsed = Number(args[3]);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      console.error('Error: distance must be a positive number');
      process.exit(1);
    }
    distance = parsed;
  }

  const service = new MirroringService();

  try {
    await service.start();
    console.log(
      `Scrolling ${direction ?? 'down'} by ${String(distance ?? 150)}px at (${x}, ${y})...`,
    );
    await service.scroll({ x, y, direction, distance });
    console.log('Done.');
  } finally {
    if (service.started) {
      await service.stop();
    }
  }
};

await main();
