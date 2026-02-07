type AppEnv = 'test' | 'local' | 'dev' | 'prod';
type LogLevel = 'debug' | 'info' | 'warn' | 'silent';

function getEnv(): AppEnv {
  const env = process.env.APP_ENV ?? process.env.NODE_ENV;
  if (env === 'test' || env === 'local' || env === 'dev' || env === 'prod') {
    return env;
  }
  return 'local';
}

function getLogLevel(): LogLevel {
  const level = process.env.LOG_LEVEL;
  if (
    level === 'debug' ||
    level === 'info' ||
    level === 'warn' ||
    level === 'silent'
  ) {
    return level;
  }
  return 'info';
}

const env = getEnv();

const config = {
  app: {
    env,
    isTest: env === 'test',
    isLocal: env === 'local',
    isProd: env === 'prod',
  },
  logging: {
    level: getLogLevel(),
  },
  usbmux: {
    socketPath: process.env.USBMUX_SOCKET_PATH ?? '/var/run/usbmuxd',
  },
  wda: {
    port: Number(process.env.WDA_PORT ?? 8100),
    defaultTimeout: 30_000,
  },
} as const;

export default config;
