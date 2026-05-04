# Auth Service

Centralised authentication service for all apps in this monorepo. Built on [better-auth](https://better-auth.com), running as a Cloudflare Worker with a React SPA for login/signup flows.

## What it does

- **Email + password** auth — email verification is optional (enabled when AWS SES secrets are configured)
- **Magic link** login via email (requires AWS SES secrets)
- **JWT tokens** (EdDSA, 1 hour TTL) — apps verify tokens without hitting this service on every request
- **API keys** — for machine-to-machine auth
- **JWKS endpoint** at `/api/auth/.well-known/jwks.json` — public key discovery for token verification
- **Cross-subdomain cookies** — a session established on `auth.example.com` works across `*.example.com`

Emails (verification, magic link, password reset) are sent via AWS SES when configured. Without SES secrets, email features are silently disabled — useful for staging environments where you don't need email flows.

## Architecture

```
Browser / App
    │
    ├── /api/auth/*                      → better-auth handler (Hono worker)
    ├── /api/auth/.well-known/jwks.json  → public JWKS for JWT verification
    └── /*                               → React SPA (login, signup, verify-email, reset-password, callback)

Infrastructure
    └── D1 database  → user accounts, sessions, API keys, JWKS key pairs
```

JWKS key pairs are stored in D1, encrypted at rest by better-auth using your `BETTER_AUTH_SECRETS` (AES-256 GCM). Only the public key is ever exposed via the JWKS endpoint.

The `/callback` route extracts the JWT from the session and redirects to the originating app with `?token=<jwt>`. Apps then use `libs/auth/node` to verify the token on subsequent requests without round-tripping to this service.

---

## Opt-in

The auth service is excluded from Nx by default via `.nxignore`. This means it is not built or deployed in `nx affected` runs until you explicitly enable it.

To enable it, remove `services/auth` from `.nxignore` at the repo root. Use the `/setup-auth-service` Claude command to provision everything from scratch.

---

## First-time setup

Use the `/setup-auth-service` Claude command — it walks through every step interactively and fills in the wrangler.jsonc database IDs for you. The manual steps are documented below for reference.

### Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.10
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (installed via `npm`)
- A Cloudflare account with D1 enabled
- AWS credentials (for Terraform S3 state backend)

### Step 1 — Set environment variables

The following must be present in your root `.env` file (this is the standard local setup for the repo — nothing auth-specific):

```bash
PROJECT_NAME=your-project-name
ENVIRONMENT=staging
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
AWS_PROFILE=your-aws-profile   # used by Terraform for S3 state backend
```

Your Cloudflare API token must have the following permissions:

| Scope | Resource | Permission |
|---|---|---|
| Account | D1 | Edit |
| Account | Cloudflare Workers Scripts | Edit |
| Zone | Workers Routes | Edit |

Create or update your token at **Cloudflare dashboard → My Profile → API Tokens**.

### Step 2 — Provision infrastructure

This creates the D1 database in your Cloudflare account:

```bash
npx nx run auth:tf-apply:staging
```

Note the output values — you'll need them in the next step:

```
d1_database_id   = "xxxxxxxxxxxx"
d1_database_name = "your-project-staging-auth"
```

### Step 3 — Update wrangler.jsonc

Fill in the real IDs from the Terraform output into `wrangler.jsonc`:

```jsonc
"staging": {
  "d1_databases": [{ "binding": "DB", "database_name": "...", "database_id": "<paste d1_database_id>" }]
}
```

### Step 4 — Run the database migration

```bash
npx nx run auth:db-migrate:staging
```

This applies `schema/0000_init.sql` to the remote D1 database. Run this again whenever the schema changes (after running `db-generate`).

### Step 5 — Deploy

```bash
npx nx run auth:deploy:staging
```

This runs Terraform (idempotent — no changes if infra is already up), then deploys the Worker. The Worker must exist in Cloudflare before secrets can be set in the next step.

### Step 6 — Set secrets

Secrets are never stored in `wrangler.jsonc`. They are set directly in Cloudflare via the Wrangler CLI and injected into the Worker at runtime. The Worker must already be deployed (Step 5) before these commands will work.

#### better-auth secrets (required)

`BETTER_AUTH_SECRETS` is required. It is a versioned, comma-separated list of signing secrets — this design supports rotation from day one without ever needing a second variable.

Generate a secret value:

```bash
openssl rand -base64 256 | tr -d '\n'; echo
```

```bash
npx wrangler secret put BETTER_AUTH_SECRETS -e staging
# When prompted, enter: 1:<your-generated-value>
```

The version prefix (`1:`) is required — it enables rotation later without invalidating active sessions. See [Secret rotation](#secret-rotation) below.

#### AWS SES secrets (optional)

Required to send verification emails, magic links, and password reset emails. Without these, email features are silently disabled — signups work without email verification. The IAM user needs the `ses:SendEmail` permission on your verified sending domain.

```bash
npx wrangler secret put AWS_SES_ACCESS_KEY -e staging
npx wrangler secret put AWS_SES_SECRET_KEY -e staging
npx wrangler secret put AWS_SES_REGION -e staging
# Enter the AWS region where SES is configured, e.g. us-east-1
```

The `FROM_EMAIL` address (e.g. `noreply@staging.example.com`) is a plain `var` in `wrangler.jsonc` — it does not need to be a secret, but the domain must be verified in SES.

#### Verify secrets

```bash
npx wrangler secret list -e staging
```

`BETTER_AUTH_SECRETS` is required. The three SES secrets are optional.

---

## Local development

Local dev uses an in-process D1 database (no real Cloudflare resources needed):

```bash
# Apply schema to local D1
npx nx run auth:db-migrate:local

# Start dev server (React SPA + Worker)
npx nx run auth:serve
```

The worker runs at `http://localhost:5173`. The React login UI is served at the same origin. No secrets are needed locally — emails are not sent, and `BETTER_AUTH_SECRETS` defaults to a dev placeholder if not set.

---

## Nx targets

| Target | Description |
|---|---|
| `serve` | Start local dev server |
| `build:staging` / `build:production` | Build for deployment |
| `test` | Run unit tests |
| `lint` / `format` | Lint and format checks |
| `typecheck` | TypeScript check (app + worker) |
| `db-generate` | Regenerate `src/worker/schema.ts` (Drizzle) and `schema/0000_init.sql` (SQL) from the better-auth config |
| `db-migrate:local` / `:staging` / `:production` | Apply `schema/0000_init.sql` to D1 |
| `tf-apply:staging` / `:production` | Provision Cloudflare infra (D1) |
| `tf-plan:staging` / `:production` | Preview infra changes |
| `tf-destroy:staging` / `:production` | Destroy Cloudflare infra |
| `deploy:staging` / `:production` | Terraform + wrangler deploy |

---

## Using auth in other apps

Install the shared library:

```typescript
import { jwtMiddleware, verifyToken } from '@nx-launchpad/auth-node';
```

### Hono middleware

```typescript
import { jwtMiddleware } from '@nx-launchpad/auth-node';

app.use('/api/*', jwtMiddleware('https://auth.staging.falconiq.ai'));

app.get('/api/me', (c) => {
  const user = c.get('user'); // { id, email, emailVerified, name }
  return c.json(user);
});
```

### Manual token verification

```typescript
import { verifyToken } from '@nx-launchpad/auth-node';

const user = await verifyToken(token, 'https://auth.staging.falconiq.ai');
```

Token verification fetches the public JWKS once and caches it — no round-trip to the auth service on subsequent requests.

---

## Secret rotation

To rotate secrets without invalidating existing sessions:

1. Generate a new secret: `openssl rand -base64 256 | tr -d '\n'; echo`
2. Update `BETTER_AUTH_SECRETS` with the new version prepended:
   ```
   npx wrangler secret put BETTER_AUTH_SECRETS -e staging
   # Enter: 2:newSecret,1:oldSecret
   ```
3. After all existing tokens signed with version 1 have expired (1 hour), remove the old entry:
   ```
   # Enter: 2:newSecret
   ```

SSM is the source of truth for secrets. After updating Cloudflare, update the corresponding SSM parameter so the `sync-auth-secrets.yml` workflow stays in sync.
