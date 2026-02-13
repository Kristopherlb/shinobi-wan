import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'ir',
    root: __dirname,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: '../../coverage/packages/ir',
    },
  },
});
