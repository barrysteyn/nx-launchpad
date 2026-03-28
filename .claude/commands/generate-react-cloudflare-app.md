Generate a new React Cloudflare Workers application in this Nx monorepo using the workspace generator.

This generator scaffolds a React + Vite + TanStack Router SPA that is deployed to Cloudflare Workers as a static asset site.

Follow these steps:

1. **Ask the user for the following before running anything:**
   - App name (must be kebab-case, e.g. `my-react-app`)
   - Short description of the app
   - Staging custom domain (e.g. `staging.example.com`) — optional, leave blank to skip
   - Production custom domain (e.g. `example.com`) — optional, leave blank to skip

2. **Run the generator** with the collected answers:
   ```
   npx nx generate @nx-launchpad/tools:react-cloudflare-app <app-name>
   ```

3. **Verify the generated files:**
   - `apps/<app-name>/src/main.tsx` — entry point rendering `<App />`
   - `apps/<app-name>/src/router.tsx` — TanStack Router with root, index, and about routes
   - `apps/<app-name>/wrangler.jsonc` — Cloudflare Workers config with `preview`, `staging`, and `production` environments
   - `apps/<app-name>/project.json` — Nx targets: `lint`, `format`, `typecheck`, `test`, `build`, `serve`, `deploy`
   - If domains were provided: `wrangler.jsonc` contains `route` blocks for staging and/or production

4. **Run the generated project's targets to confirm the scaffold works:**
   ```
   npx nx run <app-name>:lint
   npx nx run <app-name>:format
   npx nx run <app-name>:typecheck
   npx nx run <app-name>:test
   npx nx run <app-name>:build
   ```

5. **Verify and fix the lock file** — the new `package.json` added by the generator changes the workspace manifest. Run:
   ```
   npm ci --legacy-peer-deps
   ```
   If this fails with a lock file sync error, regenerate it:
   ```
   npm install --legacy-peer-deps
   ```
   Then re-run `npm ci --legacy-peer-deps` to confirm it passes.

6. **Commit the result** using two commits:
   - One for the generated app files
   - One for `package-lock.json` if it changed

**Conventions to enforce:**
- App name must be kebab-case
- Never commit `.env` files — `.env.staging` and `.env.production` are gitignored
- Never commit `dist/` or `.wrangler/`
- `wrangler.jsonc` is the single source of truth for Cloudflare config — do not create a `wrangler.toml` alongside it
- The `deploy:preview` target extracts a version-specific Cloudflare URL automatically — do not hardcode worker names
- `CLOUDFLARE_API_TOKEN` must be set in the environment (or via `wrangler login`) to deploy
