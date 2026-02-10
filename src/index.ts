#!/usr/bin/env node

import { createLogger } from '@lib/utils';

import { AppContainer } from './app-container';

const log = createLogger('main');
const appContainer = new AppContainer();

async function shutdown(): Promise<void> {
  log.info('Shutting down...');
  await appContainer.stop();
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

await appContainer.start();
log.info('iPhone MCP server is running');
