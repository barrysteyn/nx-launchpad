# Auth Service

Centralised authentication service for all apps in this monorepo. Built on [better-auth](https://better-auth.com), running as a Cloudflare Worker with a D1 database.

## What it does

- **Email + password** auth with optional email verification (requires AWS SES)
- **Magic link** login via email (requires AWS SES)
- **JWT tokens** (EdDSA, 1 hour TTL) — verified by consumer apps without a round-trip to this service
- **API keys** for machine-to-machine auth
- **JWKS endpoint** at `/.well-known/jwks.json` for public key discovery
- **Cross-subdomain cookies** — a session on `auth.$URL` is valid across all `*.$URL` apps

## How auth works

1. Unauthenticated user visits a protected app → redirected to `https://auth.staging.$URL/login?redirect_uri=...`
2. After sign-in, better-auth sets a session cookie scoped to `.$URL` and redirects back
3. For API calls, apps call `authClient.token()` to get a short-lived JWT, sent as `Bearer` token
4. Consumer workers verify JWTs locally via JWKS — no round-trip to this service

---

## Setup and teardown

Use the Claude Code skills — they handle every step interactively:

- `/setup-auth-service` — provision D1, migrate schema, deploy worker, set secrets
- `/teardown-auth-service` — delete worker, destroy D1, reset repo to pre-setup state

---

## Authorization modes

The service supports two mutually exclusive modes, chosen at setup time and baked into the DB schema. Switching modes on an existing database requires a manual migration.

| Mode | `multitenancyEnabled` in `package.json` | Plugin | JWT payload |
|---|---|---|---|
| Single-tenant (default) | `false` | `admin` | `{ id, email, role }` |
| Multi-tenant | `true` | `organization` | `{ id, email, orgId }` |

### Single-tenant mode

Uses better-auth's [admin plugin](https://better-auth.com/docs/plugins/admin). Every user has a `role` field (`admin` or `user`).

**Bootstrap first admin** (write directly to D1):
```bash
npx wrangler d1 execute DB --remote -e staging \
  --command "UPDATE user SET role = 'admin' WHERE email = 'your@email.com'"
```

**Promote/demote via client** (requires an existing admin session):
```typescript
await authClient.admin.setRole({ userId: 'user_abc123', role: 'admin' });
```

**Enforce in a worker:**
```typescript
app.get('/api/admin', (c) => {
  if (c.get('user').role !== 'admin') return c.json({ error: 'Forbidden' }, 403);
});
```

### Multi-tenant mode

Uses better-auth's [organization plugin](https://better-auth.com/docs/plugins/organization). Users belong to organisations; roles are per-org (`owner`, `admin`, `member`).

**How org activation works:** when a user creates or joins an organisation, a server-side `afterAddMember` hook automatically sets `activeOrganizationId` on all their sessions. The active org is included in every subsequent JWT — no client-side `setActive()` call needed.

**JWT payload in multi-tenant mode:**
```json
{ "id": "user_abc123", "email": "alice@example.com", "orgId": "org_xyz" }
```

**Enforce tenancy in a worker:**
```typescript
app.get('/api/data', (c) => {
  const { orgId } = c.get('user');
  if (!orgId) return c.json({ error: 'No active organisation' }, 403);
  // scope DB queries to orgId
});
```

**Switching modes on an existing database:**
1. Change `multitenancyEnabled` in `services/auth/package.json`
2. Run `npx nx run auth:db-generate` to produce a new migration
3. Apply the migration manually via `db-migrate`
4. Redeploy

---

## Using auth in consumer apps

### Browser (React SPA)

```typescript
// src/app/lib/auth-client.ts
import { createBrowserAuthClient } from '@nx-launchpad/auth-browser';
export const authClient = createBrowserAuthClient(import.meta.env.VITE_AUTH_URL);
```

```typescript
const { data: session } = authClient.useSession();
await authClient.signOut();
```

`useSession()` is cross-tab aware — signing out in one tab updates all others within a second.

### Worker (Hono API)

```typescript
import { jwtMiddleware } from '@nx-launchpad/auth-node';

const PUBLIC_API_ROUTES = new Set(['/api/health']);

app.use('/api/*', (c, next) => {
  if (PUBLIC_API_ROUTES.has(c.req.path)) return next();
  return jwtMiddleware(c.env.AUTH_URL)(c, next);
});
```

After the middleware, `c.get('user')` contains `{ id, email, emailVerified, name, role? }` (single-tenant) or `{ id, email, emailVerified, name, orgId? }` (multi-tenant).

The `AUTH_URL` binding in `wrangler.jsonc` must point to the auth service (e.g. `https://auth.staging.$URL`).

### Protected by default

| Layer | Protected by default | Opt out |
|---|---|---|
| React pages | `__root.tsx` redirect via `useSession()` | `staticData: { isPublic: true }` on the route |
| API endpoints | Global `jwtMiddleware` on `/api/*` | Add path to `PUBLIC_API_ROUTES` |

---

## Local development

The auth service does not run locally — session cookies require HTTPS scoped to `.$URL`. Point local apps at staging instead:

```bash
# apps/<name>/.env.local
VITE_AUTH_URL=https://auth.staging.$URL
```

The staging auth service has `http://localhost:5173` in `TRUSTED_ORIGINS`.

---

## Secret rotation

`BETTER_AUTH_SECRETS` is a versioned comma-separated list: `<version>:<secret>`. To rotate:

1. Generate a new secret: `openssl rand -base64 256 | tr -d '\n'; echo`
2. Prepend the new version:
   ```bash
   npx wrangler secret put BETTER_AUTH_SECRETS -e staging
   # Enter: 2:newSecret,1:oldSecret
   ```
3. After all sessions signed with v1 expire (1 hour), drop the old entry.

---

## Nx targets

| Target | Description |
|---|---|
| `build:staging` / `:production` | Build for deployment |
| `deploy:staging` / `:production` | Terraform + wrangler deploy |
| `db-generate` | Regenerate schema from better-auth config |
| `db-migrate:staging` / `:production` | Apply `schema/0000_init.sql` to D1 |
| `tf-apply:staging` / `:production` | Provision Cloudflare infra (D1) |
| `tf-destroy:staging` / `:production` | Destroy Cloudflare infra |
| `test` / `lint` / `format` / `typecheck` | Standard quality targets |
