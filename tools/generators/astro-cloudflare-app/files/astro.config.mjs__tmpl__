import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      // @astrojs/react uses virtual modules (astro:react:opts) that must be resolved
      // at Vite build time. In an npm workspace the package lives in the root
      // node_modules, so vitefu's framework-package crawler never sees it in the
      // app's own package.json. Explicitly marking it noExternal forces Vite to
      // bundle it into the SSR output and resolve the virtual module during the build.
      noExternal: ['@astrojs/react'],
    },
  },
});
