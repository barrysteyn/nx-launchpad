import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@nx-launchpad/config-loader-node': path.resolve(__dirname, '../../libs/config-loader/node/src/index.ts'),
      '@nx-launchpad/utils-node': path.resolve(__dirname, '../../libs/utils/node/src/index.ts'),
    },
  },
  test: { environment: 'node' },
});
