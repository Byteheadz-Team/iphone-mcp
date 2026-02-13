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

const parseIntFromEnvVar = ({
  envVar,
  fallback,
  min,
  max,
}: {
  envVar: string;
  fallback: number;
  min?: number;
  max?: number;
}): number => {
  const raw = process.env[envVar];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (
    Number.isNaN(parsed) ||
    !Number.isInteger(parsed) ||
    (min !== undefined && parsed < min) ||
    (max !== undefined && parsed > max)
  ) {
    // stderr directly — createLogger depends on config, so we can't use it here
    console.error(
      `[config] Invalid value for ${envVar}="${raw}", using default ${fallback}`,
    );
    return fallback;
  }
  return parsed;
};

const parseBoolFromEnvVar = ({
  envVar,
  fallback,
}: {
  envVar: string;
  fallback: boolean;
}): boolean => {
  const raw = process.env[envVar];
  if (raw === undefined) return fallback;
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  console.error(
    `[config] Invalid value for ${envVar}="${raw}", using default ${String(fallback)}`,
  );
  return fallback;
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
    screenshotScale: parseIntFromEnvVar({
      envVar: 'IPHONE_MCP_SCREENSHOT_SCALE',
      fallback: 1,
      min: 1,
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
  },
} as const;

export default config;
