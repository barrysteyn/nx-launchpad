# Auth Service — Claude Notes

## Skills

Always use these skills for setup and teardown — they handle every step:

- `/setup-auth-service` — provision D1, migrate schema, deploy worker, set secrets
- `/teardown-auth-service` — delete worker, destroy D1, reset repo to pre-setup state

## Key files

| File | Purpose |
|---|---|
| `src/worker/auth.ts` | Core better-auth config — plugins, JWT payload, secrets parsing |
| `src/worker/index.ts` | Hono entry point — routes all `/api/auth/*` and `/.well-known/*` to better-auth |
| `src/worker/schema.ts` | Drizzle schema (auto-generated — do not edit manually) |
| `src/worker/db.ts` | Drizzle D1 client factory |
| `src/worker/types.ts` | `Bindings` interface — all Cloudflare Worker env bindings declared here |
| `src/worker/auth.generate.ts` | Stub env for `npx @better-auth/cli generate` — reads `multitenancyEnabled` from `package.json` |
| `package.json` | Single source of truth for `multitenancyEnabled` (boolean) |
| `schema/0000_init.sql` | DB migration applied via `db-migrate` target |
| `wrangler.jsonc` | Cloudflare Worker config — staging and production environments |
| `infra/` | Terraform for D1 database (Cloudflare) |

## Authorization mode

Controlled by `"multitenancyEnabled"` in `package.json` (boolean). This is the **only** place to change the mode.

- `false` (default) → `admin` plugin → JWT: `{ id, email, role }`
- `true` → `organization` plugin → JWT: `{ id, email, orgId }`

After changing the flag, run `npx nx run auth:db-generate` to regenerate the schema, then `db-migrate` to apply it. **Do not flip this on an existing populated database without a manual migration.**

The deploy targets inject `MULTITENANCY_ENABLED` at runtime via `--var MULTITENANCY_ENABLED:$(node -e "...")` — never hardcode it in `wrangler.jsonc`.

## BETTER_AUTH_SECRETS format

The secret is versioned: `<version>:<base64-value>` (e.g. `1:abc...==`). Multiple versions are comma-separated for rotation. The version prefix is required — better-auth uses it for key rotation. Without a valid secrets value the worker throws "You are using the default secret" and returns 500 on every request.

## D1 `prevent_destroy`

`libs/infra/modules/cloudflare/d1/main.tf` has `lifecycle { prevent_destroy = true }`. The teardown skill handles toggling this — don't forget to restore it to `true` after a `tf-destroy`.

## Deployment flow

```
build:staging  →  tf-apply:staging (idempotent)  →  wrangler deploy -e staging
```

The `deploy:staging` target runs all three steps. After a fresh `tf-apply`, update `wrangler.jsonc` with the new `d1_database_id` before deploying.

## Secrets management

Secrets are set via the **Sync Auth Secrets** GitHub Actions workflow (`sync-auth-secrets.yml`), which fetches from AWS SSM Parameter Store. SSM path convention: `/{project_name}/{environment}/auth/{secret-name}`.

Required secret: `BETTER_AUTH_SECRETS`
Optional secrets (enable email features): `AWS_SES_ACCESS_KEY`, `AWS_SES_SECRET_KEY`, `AWS_SES_REGION`

## Schema regeneration

When switching modes or after changing plugins:
```bash
npx nx run auth:db-generate   # regenerates schema.ts and schema/0000_init.sql
npx nx run auth:db-migrate:staging
```

## Common gotchas

- **Empty `BETTER_AUTH_SECRETS`**: wrangler secret set to empty string causes a 500 on every request. Check with `npx wrangler secret list -e staging`.
- **`tsconfig.worker.json`** needs `"resolveJsonModule": true` for the `package.json` import in `auth.generate.ts`.
- **Auth does not run locally** — session cookies require HTTPS scoped to `.$URL`. Point local apps at staging via `VITE_AUTH_URL`.
- **`afterAddMember` hook** casts `.set()` as `Record<string, unknown>` to avoid TypeScript errors when the schema doesn't include `activeOrganizationId` (single-tenant mode). This is safe because the hook only runs when `isMultiTenant` is true.
