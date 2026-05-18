import { cloudflare } from '@cloudflare/vite-plugin';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

const hasAppRoutes = existsSync('./src/app/routes/__root.tsx');

export default defineConfig({
  resolve: {
    alias: {
      'libs/utils-node': resolve(__dirname, '../../libs/utils/node/src/index.ts'),
    },
  },
  plugins: [
    ...(process.env.VITEST ? [] : [cloudflare()]),
    ...(hasAppRoutes
      ? [
          TanStackRouterVite({
            routesDirectory: './src/app/routes',
            generatedRouteTree: './src/app/routeTree.gen.ts',
          }),
          react(),
          tailwindcss(),
        ]
      : []),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/test-setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    globals: true,
  },
});
