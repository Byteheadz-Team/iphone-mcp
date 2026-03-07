import {
  parseBoolFromEnvVar,
  parseFloatFromEnvVar,
  parseIntFromEnvVar,
} from '@lib/utils';

import pkg from '../package.json';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const getLogLevel = (): LogLevel => {
  const level = process.env.IPHONE_MCP_LOG_LEVEL;
  if (
    level === 'debug' ||
    level === 'info' ||
    level === 'warn' ||
    level === 'error' ||
    level === 'silent'
  ) {
    return level;
  }
  return 'info';
};

const config = {
  name: pkg.name,
  version: pkg.version,
  logging: {
    level: getLogLevel(),
  },
  mirroring: {
    appName: pkg.name,
    swipeSpeed: 2,
    launchTimeoutMs: parseIntFromEnvVar({
      envVar: 'IPHONE_MCP_LAUNCH_TIMEOUT_MS',
      fallback: 10_000,
      min: 1,
    }),
    screenshotScale: parseFloatFromEnvVar({
      envVar: 'IPHONE_MCP_SCREENSHOT_SCALE',
      fallback: 1,
      min: 0.1,
    }),
    overlayGridDivisions: parseIntFromEnvVar({
      envVar: 'IPHONE_MCP_GRID_DIVISIONS',
      fallback: 9,
      min: 1,
    }),
    maxPxSingleDimension: parseIntFromEnvVar({
      envVar: 'IPHONE_MCP_MAX_PX_SINGLE_DIMENSION',
      fallback: 1568,
      min: 1,
    }),
    compressPngPalette: parseBoolFromEnvVar({
      envVar: 'IPHONE_MCP_PNG_PALETTE',
      fallback: true,
    }),
    pngCompressionLevel: parseIntFromEnvVar({
      envVar: 'IPHONE_MCP_PNG_COMPRESSION_LEVEL',
      fallback: 6,
      min: 0,
      max: 9,
    }),
    motionStepIntervalMs: parseIntFromEnvVar({
      envVar: 'IPHONE_MCP_MOTION_STEP_INTERVAL_MS',
      fallback: 50,
      min: 1,
      max: 10_000,
    }),
  },
} as const;

export default config;
