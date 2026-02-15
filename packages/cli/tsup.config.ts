import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  format: ['cjs'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  bundle: true,
  dts: false,
  noExternal: [/^@shinobi\//],
  external: ['@pulumi/pulumi', '@pulumi/pulumi/automation', '@pulumi/aws'],
});
