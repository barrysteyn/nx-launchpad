import { cloudflare } from '@cloudflare/vite-plugin';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflare(),
    TanStackRouterVite({
      routesDirectory: './src/app/routes',
      generatedRouteTree: './src/app/routeTree.gen.ts',
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@nx-launchpad/config-loader-node': resolve(
        __dirname,
        '../../libs/config-loader/node/src/cloudflare.ts',
      ),
      '@nx-launchpad/auth-node': resolve(
        __dirname,
        '../../libs/auth/node/src/index.ts',
      ),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/test-setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    globals: true,
  },
});
