export interface Logger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

function getLogLevel(): number {
  const level = (process.env.LOG_LEVEL ?? 'info') as LogLevel;
  return LOG_LEVELS[level] ?? LOG_LEVELS.info;
}

function noop(): void {
  // intentionally empty
}

export function createLogger(scope: string): Logger {
  const level = getLogLevel();

  return {
    debug:
      level <= LOG_LEVELS.debug
        ? (...args: unknown[]) => console.debug(`[${scope}]`, ...args)
        : noop,
    info:
      level <= LOG_LEVELS.info
        ? (...args: unknown[]) => console.info(`[${scope}]`, ...args)
        : noop,
    warn:
      level <= LOG_LEVELS.warn
        ? (...args: unknown[]) => console.warn(`[${scope}]`, ...args)
        : noop,
    error:
      level <= LOG_LEVELS.error
        ? (...args: unknown[]) => console.error(`[${scope}]`, ...args)
        : noop,
  };
}
