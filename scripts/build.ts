import { $, build, BuildConfig } from 'bun';
import dts from 'bun-plugin-dtsx';

const sharedConfig = {
  outdir: 'dist',
  target: 'browser',
  minify: true,
} satisfies Omit<BuildConfig, 'entrypoints'>;
await $`rm -rf ${sharedConfig.outdir}`;
build({
  entrypoints: ['src/main.css'],
  ...sharedConfig,
});
build({
  entrypoints: ['src/index.ts'],
  ...sharedConfig,
  plugins: [dts()],
});
