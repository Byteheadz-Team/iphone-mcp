import config, { type LogLevel } from '~/config';

export interface Logger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

function noop(): void {
  // intentionally empty
}

export function createLogger(scope: string): Logger {
  const level = LOG_LEVELS[config.logging.level];

  // All log output goes to stderr — stdout is reserved for MCP protocol (stdio transport).
  return {
    debug:
      level <= LOG_LEVELS.debug
        ? (...args: unknown[]) => console.error(`[${scope}]`, ...args)
        : noop,
    info:
      level <= LOG_LEVELS.info
        ? (...args: unknown[]) => console.error(`[${scope}]`, ...args)
        : noop,
    warn:
      level <= LOG_LEVELS.warn
        ? (...args: unknown[]) => console.error(`[${scope}]`, ...args)
        : noop,
    error:
      level <= LOG_LEVELS.error
        ? (...args: unknown[]) => console.error(`[${scope}]`, ...args)
        : noop,
  };
}
