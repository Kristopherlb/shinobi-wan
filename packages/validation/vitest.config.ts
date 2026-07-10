import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shinobi/contracts': resolve(__dirname, '../contracts/src/index.ts'),
      '@shinobi/ir': resolve(__dirname, '../ir/src/index.ts'),
    },
  },
  test: {
    name: 'validation',
    root: __dirname,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: '../../coverage/packages/validation',
    },
  },
});
