# Auth Service

Centralised authentication service for all apps in this monorepo. Built on [better-auth](https://better-auth.com), running as a Cloudflare Worker with a D1 database.

## What it does

- **Email + password** auth — email verification is optional (enabled when AWS SES secrets are configured)
- **Magic link** login via email (requires AWS SES secrets)
- **JWT tokens** (EdDSA, 1 hour TTL) — apps verify tokens without hitting this service on every request
- **API keys** — for machine-to-machine auth
- **JWKS endpoint** at `/.well-known/jwks.json` — public key discovery for token verification
- **Cross-subdomain cookies** — a session established on `auth.$URL` is automatically valid across all `*.$URL` apps

Emails (verification, magic link, password reset) are sent via AWS SES when configured. Without SES secrets, email features are silently disabled — useful for staging environments where you don't need email flows.

## How auth works

When a user visits a protected app without a session, the app redirects them to the login page:

```
https://auth.staging.$URL/login?redirect_uri=https://staging.$URL/
```

After signing in, better-auth sets a session cookie scoped to `.$URL` and redirects the browser directly back to `redirect_uri`. The app's `useSession()` hook reads the cookie on load — no token in the URL, no intermediate redirect page.

For API calls that require authentication, apps request a short-lived JWT from this service (`authClient.token()`) and send it as a `Bearer` token. The receiving worker verifies the JWT locally using the public JWKS — no round-trip to this service on every request.

## Architecture

```
Browser / App
    │
    ├── /api/auth/*            → better-auth handler (sessions, sign-in, sign-up, etc.)
    ├── /.well-known/jwks.json → public JWKS for JWT verification by other workers
    └── /*                     → React SPA (login, signup, verify-email, reset-password)

Infrastructure
    └── D1 database  → user accounts, sessions, API keys, JWKS key pairs
```

JWKS key pairs are stored in D1, encrypted at rest by better-auth using your `BETTER_AUTH_SECRETS`. Only the public key is ever exposed via the JWKS endpoint.

---

## First-time setup

> [!TIP]
> Use the `/setup-auth-service` Claude command — it walks through every step interactively and fills in the wrangler.jsonc database IDs for you.

<details>
<summary>Manual setup steps</summary>

### Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.10
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (installed via `npm`)
- A Cloudflare account with D1 enabled
- AWS credentials (for Terraform S3 state backend)

### Step 1 — Set environment variables

The following must be present in your root `.env` file:

```bash
PROJECT_NAME=your-project-name
URL=your-domain.com       # e.g. nimrox.ai — drives all staging/production URLs
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

This runs Terraform (idempotent — no changes if infra is already up), then deploys the Worker.

> [!NOTE]
> The Worker must exist in Cloudflare before secrets can be set in the next step.

### Step 6 — Set secrets

Secrets are never stored in `wrangler.jsonc`. They are set directly in Cloudflare via the Wrangler CLI and injected into the Worker at runtime.

#### better-auth secrets (required)

`BETTER_AUTH_SECRETS` is a versioned, comma-separated list of signing secrets — this design supports rotation from day one without ever needing a second variable.

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

The `FROM_EMAIL` address is a plain `var` in `wrangler.jsonc` — it does not need to be a secret, but the domain must be verified in SES.

#### Verify secrets

```bash
npx wrangler secret list -e staging
```

`BETTER_AUTH_SECRETS` is required. The three SES secrets are optional.

</details>

---

## Local development

The auth service itself does not run locally. Session cookies are set with the `Secure` flag scoped to `.$URL` — they are not sent over HTTP, so local auth flows do not work.

For developing consumer apps locally, point them at the staging auth service by setting `VITE_AUTH_URL` in the app's `.env.local`:

```bash
VITE_AUTH_URL=https://auth.staging.nimrox.ai
```

The staging auth service already has `http://localhost:5173` in its `TRUSTED_ORIGINS`, so CORS and cookie redirects work when running an app locally against staging auth.

---

## Nx targets

| Target | Description |
|---|---|
| `serve` | Start local dev server |
| `build:staging` / `build:production` | Build for deployment |
| `test` | Run unit tests |
| `lint` / `format` | Lint and format checks |
| `typecheck` | TypeScript check (app + worker) |
| `db-generate` | Regenerate `src/worker/schema.ts` and `schema/0000_init.sql` from the better-auth config |
| `db-migrate:staging` / `:production` | Apply `schema/0000_init.sql` to D1 |
| `tf-apply:staging` / `:production` | Provision Cloudflare infra (D1) |
| `tf-plan:staging` / `:production` | Preview infra changes |
| `tf-destroy:staging` / `:production` | Destroy Cloudflare infra |
| `deploy:staging` / `:production` | Terraform + wrangler deploy |

---

## Using auth in other apps

### Browser (React SPA)

Create an auth client in your app using the shared library:

```typescript
// src/app/lib/auth-client.ts
import { createBrowserAuthClient } from '@nx-launchpad/auth-browser';

export const AUTH_URL = import.meta.env.VITE_AUTH_URL as string | undefined;
export const authClient = createBrowserAuthClient(AUTH_URL);
```

Use `useSession()` to read the current user and guard routes:

```typescript
const { data: session, isPending } = authClient.useSession();
```

Sign out:

```typescript
await authClient.signOut();
```

> [!NOTE]
> `useSession()` is cross-tab aware — signing out in one tab updates all other open tabs within a second via BroadcastChannel.

### Worker (Hono API)

Protect all API routes by default using the global JWT middleware from `@nx-launchpad/auth-node`:

```typescript
import { jwtMiddleware } from '@nx-launchpad/auth-node';

const PUBLIC_API_ROUTES = new Set(['/api/health']);

app.use('/api/*', (c, next) => {
  if (PUBLIC_API_ROUTES.has(c.req.path)) return next();
  return jwtMiddleware(c.env.AUTH_URL)(c, next);
});

app.get('/api/me', (c) => {
  const user = c.get('user'); // { id, email, emailVerified, name }
  return c.json(user);
});
```

The middleware verifies the JWT against the auth service's public JWKS, caches the key set, and sets `c.var.user` for downstream handlers. Any route not in `PUBLIC_API_ROUTES` returns `401` if the request has no valid Bearer token.

The `AUTH_URL` worker binding must be set in `wrangler.jsonc` pointing to the auth service (e.g. `https://auth.staging.$URL`).

### Public vs protected routes

Both the browser and worker layers use a **protected by default, opt out explicitly** pattern:

| Layer | Protected by default | Opt out |
|---|---|---|
| React pages | `__root.tsx` redirect via `useSession()` | Add `staticData: { isPublic: true }` to the route |
| API endpoints | Global `jwtMiddleware` on `/api/*` | Add the path to `PUBLIC_API_ROUTES` |

---

## Secret rotation

To rotate secrets without invalidating existing sessions:

1. Generate a new secret: `openssl rand -base64 256 | tr -d '\n'; echo`
2. Update `BETTER_AUTH_SECRETS` with the new version prepended:
   ```bash
   npx wrangler secret put BETTER_AUTH_SECRETS -e staging
   # Enter: 2:newSecret,1:oldSecret
   ```
3. After all sessions signed with version 1 have expired (1 hour), remove the old entry:
   ```bash
   # Enter: 2:newSecret
   ```
