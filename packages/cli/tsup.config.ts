import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts', 'src/index.ts'],
  tsconfig: 'tsconfig.build.json',
  format: ['cjs'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  bundle: true,
  dts: { entry: 'src/index.ts' },
  noExternal: [/^@shinobi\//],
  external: ['@pulumi/pulumi', '@pulumi/pulumi/automation', '@pulumi/aws'],
});
