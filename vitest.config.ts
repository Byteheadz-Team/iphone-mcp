import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '~': resolve('src'),
      '@lib': resolve('src/lib'),
      '@services': resolve('src/services'),
      '@mcp': resolve('src/mcp'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/vitest.setup.ts'],
  },
});
