# example-react-webapp

A reference React app deployed as a Cloudflare Worker. It demonstrates the full stack pattern used in this monorepo: a React SPA served alongside a Hono API, with config loaded from Cloudflare KV on every request.

## Stack

- **React + TanStack Router** — file-based routing; add a file to `src/app/routes/` and it becomes a route automatically
- **Hono** — lightweight API framework running in the Cloudflare Workers runtime
- **Config middleware** — loads the resolved app config from Cloudflare KV on every request; available in route handlers via `c.var.config`
- **Tailwind CSS v4** — utility-first styling

## Project structure

```
src/
  app/        ← React SPA (runs in the browser)
    routes/   ← file-based routes; one file = one route
  worker/     ← Hono API (runs in Cloudflare Workers)
    api/      ← route handlers (e.g. GET /api/health)
    middleware/  ← config loader middleware
```

## Local development

Seed the local KV store and start the dev server:

```bash
npx nx run example-react-webapp:serve
```

The KV store is seeded automatically before Vite starts. The React SPA and the Hono API both run at `http://localhost:5173` — no second process needed.

If you change config values, re-seed manually:

```bash
npx nx run example-react-webapp:seed-local-kv
```

## Deployment

`/onboard` (or its Step 4 alone) hardcodes the staging and production KV namespace IDs into `wrangler.jsonc` automatically. If you generated this app outside the `/onboard` flow, run that skill (or manually write the IDs from `npx wrangler kv namespace list` into the `env.staging.kv_namespaces` and `env.production.kv_namespaces` blocks) before deploying.

```bash
npx nx run example-react-webapp:deploy:staging
npx nx run example-react-webapp:deploy:production
```
