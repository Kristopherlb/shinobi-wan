import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  tsconfig: 'tsconfig.build.json',
  format: ['esm'],
  target: 'es2020',
  outDir: 'dist',
  clean: true,
  dts: true,
  sourcemap: true,
  external: [
    '@shinobi/contracts',
    '@shinobi/ir',
    '@pulumi/pulumi',
    '@pulumi/pulumi/automation',
    '@pulumi/aws',
  ],
});
