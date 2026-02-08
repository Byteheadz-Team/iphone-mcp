#!/usr/bin/env node

import { AppContainer } from './container';
import { createLogger } from './log';

const log = createLogger('main');
const container = new AppContainer();

async function shutdown(): Promise<void> {
  log.info('Shutting down...');
  await container.stop();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error);
  void shutdown();
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection:', reason);
  void shutdown();
});

await container.start();
log.info('iPhone MCP server is running');
