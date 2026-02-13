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

const parseIntFromEnvVar = (envVar: string, fallback: number): number => {
  const raw = process.env[envVar];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 1 || !Number.isInteger(parsed)) {
    // stderr directly — createLogger depends on config, so we can't use it here
    console.error(`[config] Invalid value for ${envVar}="${raw}", using default ${fallback}`);
    return fallback;
  }
  return parsed;
};

const config = {
  name: pkg.name,
  version: pkg.version,
  logging: {
    level: getLogLevel(),
  },
  mirroring: {
    appName: pkg.name,
    launchTimeoutMs: parseIntFromEnvVar('IPHONE_MCP_LAUNCH_TIMEOUT_MS', 10_000),
    screenshotScale: parseIntFromEnvVar('IPHONE_MCP_SCREENSHOT_SCALE', 2),
    overlayGridDivisions: parseIntFromEnvVar('IPHONE_MCP_GRID_DIVISIONS', 9),
    scrollSpeed: 1,
    swipeSpeed: 2,
  },
} as const;

export default config;
