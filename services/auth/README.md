# Auth Service

Centralised authentication service for all apps in this monorepo. Built on [better-auth](https://better-auth.com), running as a Cloudflare Worker with a React SPA for login/signup flows.

## What it does

- **Email + password** auth with mandatory email verification
- **Magic link** login via email
- **JWT tokens** (EdDSA, 1 hour TTL) — apps verify tokens without hitting this service on every request
- **API keys** — for machine-to-machine auth
- **JWKS endpoint** at `/.well-known/jwks.json` — public key discovery for token verification
- **Cross-subdomain cookies** — a session established on `auth.example.com` works across `*.example.com`

Emails (verification, magic link, password reset) are sent via AWS SES.

## Architecture

```
Browser / App
    │
    ├── /api/auth/*        → better-auth handler (Hono worker)
    ├── /.well-known/jwks.json → public JWKS for JWT verification
    └── /*                 → React SPA (login, signup, verify-email, reset-password, callback)

Infrastructure
    ├── D1 database        → user accounts, sessions, API keys
    └── KV namespace       → JWKS key pairs (rotated by better-auth)
```

The `/callback` route extracts the JWT from the session and redirects to the originating app with `?token=<jwt>`. Apps then use `libs/auth/node` to verify the token on subsequent requests without round-tripping to this service.

---

## First-time setup

### Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.10
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (installed via `npm`)
- A Cloudflare account with D1 and KV enabled
- An AWS account with SES configured and a verified sender domain

### Step 1 — Set environment variables

In your shell (or `.env` file at the repo root):

```bash
export PROJECT_NAME=your-project-name   # must match your other infra
export ENVIRONMENT=staging
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_API_TOKEN=...
```

Your Cloudflare API token must have the following permissions:

| Scope | Resource | Permission |
|---|---|---|
| Account | Workers KV Storage | Edit |
| Account | D1 | Edit |
| Account | Cloudflare Workers Scripts | Edit |
| Zone | Workers Routes | Edit |

Create or update your token at **Cloudflare dashboard → My Profile → API Tokens**.

AWS credentials are only needed for Terraform if you use S3 state backend:

```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=us-east-1
```

### Step 2 — Provision infrastructure

This creates the D1 database and KV namespace in your Cloudflare account:

```bash
npx nx run auth:tf-apply:staging
```

Note the output values — you'll need them in the next step:

```
jwks_kv_namespace_id = "xxxxxxxxxxxx"
d1_database_id       = "xxxxxxxxxxxx"
d1_database_name     = "your-project-staging-auth"
```

### Step 3 — Update wrangler.jsonc

Fill in the real IDs from the Terraform output into `wrangler.jsonc`:

```jsonc
"staging": {
  "kv_namespaces": [{ "binding": "JWKS_KV", "id": "<paste jwks_kv_namespace_id>" }],
  "d1_databases": [{ "binding": "DB", "database_name": "...", "database_id": "<paste d1_database_id>" }]
}
```

### Step 4 — Set secrets

Secrets are never stored in `wrangler.jsonc`. They are set directly in Cloudflare via the Wrangler CLI and injected into the Worker at runtime.

#### better-auth secrets

`BETTER_AUTH_SECRETS` is the only secret required. It is a versioned, comma-separated list of signing secrets — this design supports rotation from day one without ever needing a second variable.

Generate a secret value:

```bash
openssl rand -base64 32
# e.g. outputs: kJ3mP9xQwR2vL8nT5yU1oE6iA4hZ0cF7
```

```bash
npx wrangler secret put BETTER_AUTH_SECRETS -e staging
# When prompted, enter: 1:kJ3mP9xQwR2vL8nT5yU1oE6iA4hZ0cF7
```

The version prefix (`1:`) is required — it enables rotation later without invalidating active sessions. See [Secret rotation](#secret-rotation) below.

#### AWS SES secrets

Used to send verification emails, magic links, and password reset emails. The IAM user or role needs the `ses:SendEmail` permission on your verified sending domain.

```bash
npx wrangler secret put AWS_SES_ACCESS_KEY -e staging
# When prompted, enter your IAM access key ID

npx wrangler secret put AWS_SES_SECRET_KEY -e staging
# When prompted, enter your IAM secret access key

npx wrangler secret put AWS_SES_REGION -e staging
# When prompted, enter the AWS region where SES is configured, e.g. us-east-1
```

The `FROM_EMAIL` address (e.g. `noreply@staging.example.com`) is a plain `var` in `wrangler.jsonc` — it does not need to be a secret, but the domain must be verified in SES.

#### Verify secrets are set

```bash
npx wrangler secret list -e staging
```

You should see all four secrets listed: `BETTER_AUTH_SECRETS`, `AWS_SES_ACCESS_KEY`, `AWS_SES_SECRET_KEY`, `AWS_SES_REGION`.

### Step 5 — Run the database migration

```bash
npx nx run auth:db-migrate:staging
```

This applies `schema/auth-schema.sql` to the remote D1 database. Run this again whenever the schema changes.

### Step 6 — Deploy

```bash
npx nx run auth:deploy-auth:staging
```

This runs Terraform (idempotent — no changes if infra is already up), then deploys the Worker.

---

## Local development

Local dev uses an in-process D1 database (no real Cloudflare resources needed):

```bash
# Apply schema to local D1
npx nx run auth:db-migrate:local

# Start dev server (React SPA + Worker)
npx nx run auth:serve
```

The worker runs at `http://localhost:5173`. The React login UI is served at the same origin. No secrets are needed locally — emails are not sent, and `BETTER_AUTH_SECRET` defaults to a dev placeholder if not set.

---

## Nx targets

| Target | Description |
|---|---|
| `serve` | Start local dev server |
| `build:staging` / `build:production` | Build for deployment |
| `test` | Run unit tests |
| `lint` / `format` | Lint and format checks |
| `typecheck` | TypeScript check (app + worker) |
| `db-generate` | Regenerate `schema/auth-schema.sql` from the better-auth config |
| `db-migrate:local` / `:staging` / `:production` | Apply schema to D1 |
| `tf-apply:staging` / `:production` | Provision Cloudflare infra (D1 + KV) |
| `tf-plan:staging` / `:production` | Preview infra changes |
| `deploy-auth:staging` / `:production` | Terraform + wrangler deploy |

---

## Using auth in other apps

Install the shared library:

```typescript
import { jwtMiddleware, verifyToken } from '@nx-launchpad/auth-node';
```

### Hono middleware

```typescript
import { jwtMiddleware } from '@nx-launchpad/auth-node';

app.use('/api/*', jwtMiddleware('https://auth.staging.nimrox.ai'));

app.get('/api/me', (c) => {
  const user = c.get('user'); // { id, email, emailVerified, name }
  return c.json(user);
});
```

### Manual token verification

```typescript
import { verifyToken } from '@nx-launchpad/auth-node';

const user = await verifyToken(token, 'https://auth.staging.nimrox.ai');
```

Token verification fetches the public JWKS once and caches it — no round-trip to the auth service on subsequent requests.

---

## Secret rotation

To rotate secrets without invalidating existing sessions:

1. Generate a new secret: `openssl rand -base64 32`
2. Update `BETTER_AUTH_SECRETS` with the new version prepended:
   ```
   npx wrangler secret put BETTER_AUTH_SECRETS -e staging
   # Enter: 2:newSecret,1:oldSecret
   ```
3. After all existing tokens signed with version 1 have expired (1 hour), remove the old entry:
   ```
   # Enter: 2:newSecret
   ```
