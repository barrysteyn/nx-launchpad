import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/worker/schema.ts',
  out: './schema',
  dialect: 'sqlite',
});
