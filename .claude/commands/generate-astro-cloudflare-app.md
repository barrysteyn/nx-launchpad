Generate a new static Astro site in this Nx monorepo using the workspace generator.

This generator scaffolds a static Astro site with React components and Tailwind CSS, deployed to Cloudflare Workers as pure static assets — no server, no KV, no worker runtime.

## Prerequisite

Before running, check that `URL` is set to a real domain in the root `.env`:

```
URL=mysite.com
```

If it is still `your-domain.com` (the placeholder), warn the user that the generated `wrangler.jsonc` will contain dummy domains (`staging.example.com` / `example.com`) and they must update it manually before deploying.

## Steps

1. **Ask the user for:**
   - App name (must be kebab-case, e.g. `my-astro-site`)
   - Short description of the app

2. **Run the generator:**
   ```
   npx nx generate tools:astro-cloudflare-app <app-name> --description "<description>"
   ```

3. **Verify the generated files:**
   - `apps/<app-name>/astro.config.mjs` — `output: 'static'`, `@astrojs/react`, `@tailwindcss/vite`, `vite.ssr.noExternal: ['@astrojs/react']`
   - `apps/<app-name>/wrangler.jsonc` — assets-only config (no `main`, no `vars`), `preview`/`staging`/`production` environments with routes derived from `URL`
   - `apps/<app-name>/project.json` — Nx targets: `lint`, `format`, `typecheck`, `test`, `build`, `serve`, `deploy`
   - `apps/<app-name>/src/pages/index.astro` and `about.astro`
   - `apps/<app-name>/src/components/NavBar.tsx`, `Hero.tsx`, `FeatureCard.tsx`

4. **Run targets to confirm the scaffold works:**
   ```
   npx nx run <app-name>:lint
   npx nx run <app-name>:format
   npx nx run <app-name>:typecheck
   npx nx run <app-name>:test
   npx nx run <app-name>:build
   ```

5. **Verify and fix the lock file:**
   ```
   npm ci --legacy-peer-deps
   ```
   If this fails with a lock file sync error:
   ```
   npm install --legacy-peer-deps
   ```
   Then re-run `npm ci --legacy-peer-deps` to confirm it passes.

6. **Commit** using two commits:
   - One for the generated app files
   - One for `package-lock.json` if it changed

## Conventions to enforce
- App name must be kebab-case
- Never commit `.env` files
- Never commit `dist/`, `.wrangler/`, or `.astro/`
- `wrangler.jsonc` is the single source of truth for Cloudflare config
- Do NOT add a `main` field to `wrangler.jsonc` — this is a static-only site
- `CLOUDFLARE_API_TOKEN` must be set in the environment (or via `wrangler login`) to deploy
- Domains in `wrangler.jsonc` are derived from `URL` in root `.env` — update them if URL was a placeholder
