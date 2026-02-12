import pkg from '../package.json';

type AppEnv = 'test' | 'local' | 'dev' | 'prod';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const getEnv = (): AppEnv => {
  const env = process.env.APP_ENV ?? process.env.NODE_ENV;
  if (env === 'test' || env === 'local' || env === 'dev' || env === 'prod') {
    return env;
  }
  return 'local';
};

const getLogLevel = (): LogLevel => {
  const level = process.env.LOG_LEVEL;
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

const env = getEnv();

const config = {
  name: pkg.name,
  version: pkg.version,
  app: {
    env,
    isTest: env === 'test',
    isLocal: env === 'local',
    isProd: env === 'prod',
  },
  logging: {
    level: getLogLevel(),
  },
  mirroring: {
    appName: 'iPhone Mirroring',
    launchTimeoutMs: 10_000,
    screenshotScale: 2,
    overlayGridDivisions: 9,
    scrollSpeed: 2,
    swipeSpeed: 2,
  },
} as const;

export default config;
