import { defineConfig } from 'tsup';
import { cpSync } from 'node:fs';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'es2020',
  outDir: 'dist',
  clean: true,
  dts: true,
  sourcemap: true,
  onSuccess: async () => {
    // Ship the repo-level JSON Schemas inside the published package so
    // consumers can validate manifests/output without cloning the repo.
    cpSync('../../schemas', 'dist/schemas', { recursive: true });
  },
});
