Generate a new React Cloudflare Workers application in this Nx monorepo using the workspace generator.

This generator scaffolds a React + Vite + TanStack Router SPA that is deployed to Cloudflare Workers as a static asset site.

## Prerequisite

Before running, check that `URL` is set to a real domain in the root `.env`:

```
URL=mysite.com
```

If it is still `your-domain.com` (the placeholder), warn the user that the generated `wrangler.jsonc` will contain dummy domains and they must update it manually before deploying.

## Steps

1. **Ask the user for:**
   - App name (must be kebab-case, e.g. `my-react-app`)
   - Short description of the app

2. **Run the generator:**
   ```
   npx nx generate @nx-launchpad/tools:react-cloudflare-app <app-name> --description "<description>"
   ```

3. **Verify the generated files:**
   - `apps/<app-name>/src/worker/index.ts` — Hono worker entry point
   - `apps/<app-name>/src/app/main.tsx` — React SPA entry
   - `apps/<app-name>/wrangler.jsonc` — Cloudflare Workers config with `preview`, `staging`, and `production` environments; staging route `staging.<URL>`, production route `<URL>`
   - `apps/<app-name>/project.json` — Nx targets: `lint`, `format`, `typecheck`, `test`, `build`, `serve`, `seed-local-kv`, `deploy`

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
- Never commit `.env` files — `.env.staging` and `.env.production` are gitignored
- Never commit `dist/` or `.wrangler/`
- `wrangler.jsonc` is the single source of truth for Cloudflare config — do not create a `wrangler.toml` alongside it
- The `deploy:preview` target extracts a version-specific Cloudflare URL automatically — do not hardcode worker names
- `CLOUDFLARE_API_TOKEN` must be set in the environment (or via `wrangler login`) to deploy
