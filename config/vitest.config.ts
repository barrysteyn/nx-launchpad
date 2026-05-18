import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node' },
  resolve: {
    alias: {
      'libs/utils-node': path.resolve(__dirname, '../libs/utils/node/src/index.ts'),
    },
  },
});
