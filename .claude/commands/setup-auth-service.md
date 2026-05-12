Set up the auth service for a fresh fork of this repo. This provisions the required cloud infrastructure (Neon Postgres + Cloudflare Hyperdrive), migrates the database, deploys the worker, and configures secrets.

Read `services/auth/README.md` before starting — it is the source of truth for the setup process.

Follow these steps in order:

## Step 1 — Check prerequisites

Verify the following are present in the root `.env` file:
- `PROJECT_NAME` — must be set (not the placeholder value)
- `URL` — must be set (e.g. `example.com`)
- `CLOUDFLARE_API_TOKEN` — must be set
- `CLOUDFLARE_ACCOUNT_ID` — must be set
- `ENVIRONMENT` — must be set to `staging` or `production`

If any are missing or still placeholder values, tell the user what to fill in and stop. Do not proceed until all are set.

### Collect `NEON_API_KEY` (lazy — only at auth setup time)

Check whether `.env` contains a real `NEON_API_KEY`:

```bash
grep '^NEON_API_KEY=' .env | grep -qv 'your-api-key$' && echo "already set, skipping" || echo "needs paste"
```

If already set, print "NEON_API_KEY already set in .env — skipping" and proceed. Otherwise:

> "Your `NEON_API_KEY` is required to provision the Neon Postgres database for the auth service.
>
> 1. Sign in at https://console.neon.tech (free account is fine; staging fits the Free plan)
> 2. Go to **Account Settings → API Keys** (https://console.neon.tech/app/settings/api-keys)
> 3. Click **Create new API key**, name it `${PROJECT_NAME}-onboarding`, copy the value
>
> Then open `.env` in your editor. Add `NEON_API_KEY=<paste-here>` (or replace the placeholder if one exists). Save and close. Press Enter here when done."

After the user confirms, verify:

```bash
grep '^NEON_API_KEY=' .env | grep -qv 'your-api-key$'
```

If still placeholder, halt and re-prompt. Once real, push to GitHub Actions secrets so CI deploys can use it:

```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
gh secret set NEON_API_KEY -R "$REPO" --body "$(grep '^NEON_API_KEY=' .env | cut -d= -f2-)"
```

### Verify Terraform is installed

```
terraform version
```

If missing, direct the user to https://developer.hashicorp.com/terraform/install and stop.

## Step 2 — Confirm the target environment

Ask the user: "Which environment are you setting up — staging or production?"

Use their answer as `<env>` throughout the remaining steps.

## Step 3 — Choose authorization mode

Ask the user:

> "Do you want **multi-tenancy** (users belong to organisations — roles are per-org) or **single-tenant** (one global role per user, e.g. admin/user)?"

**If single-tenant (default):** no action needed — `MULTITENANCY_ENABLED` is already `"false"` in `wrangler.jsonc` and `auth.generate.ts`.

**If multi-tenant:**

1. In `services/auth/package.json`, set `"multitenancyEnabled": true`.
2. Regenerate the schema for the chosen mode:
   ```
   npx nx run auth:db-generate
   ```
   This regenerates `src/worker/schema.ts` and `schema/0000_init.sql` with the organization plugin's tables instead of the admin plugin's tables.
3. Commit the regenerated files:
   ```
   git add services/auth/package.json services/auth/src/worker/schema.ts services/auth/schema/
   git commit -m "feat(auth): enable multi-tenant mode and regenerate schema"
   ```

Warn the user: **switching modes after the database has been migrated requires a manual DB migration** — it is not safe to simply flip the flag on an existing populated database.

## Step 4 — Provision infrastructure (Neon Postgres + Hyperdrive)

```
npx nx run auth:tf-apply:<env>
```

Wait for it to complete. Read the output and extract:
- `hyperdrive_id`
- `neon_project_id`

Tell the user these values and proceed to the next step.

## Step 5 — Update wrangler.jsonc with the Hyperdrive id

Open `services/auth/wrangler.jsonc`. Find the `<env>` block inside `"env"` and replace the placeholder Hyperdrive id with the real value from Terraform output:

```bash
HYPERDRIVE_ID=$(terraform -chdir=services/auth/infra/environments/<env> output -raw hyperdrive_id)
sed -i.bak "s|\"<placeholder-hyperdrive-id>\"|\"$HYPERDRIVE_ID\"|" services/auth/wrangler.jsonc && rm services/auth/wrangler.jsonc.bak
```

If the placeholder isn't present (because someone already substituted it), the `sed` is a no-op. Verify the final file contains the real id — search for `<placeholder-hyperdrive-id>` and confirm zero matches.

## Step 6 — Run database migration

```
npx nx run auth:db-migrate:<env>
```

This pulls the connection URI from Terraform state and runs `drizzle-kit migrate` against the Neon database. If it fails with `permission denied`, check that the Neon role has `CREATE` permission on the database (Neon roles default to project-owner permissions, so this should be automatic).

## Step 7 — Deploy the worker

```
npx nx run auth:deploy:<env>
```

This builds the app, runs Terraform (idempotent), runs `drizzle-kit migrate` (idempotent), and deploys to Cloudflare. The worker must be deployed before secrets can be set in the next step.

## Step 8 — Set secrets

Secrets are never stored in files. `BETTER_AUTH_SECRETS` lives in AWS SSM (encrypted, source of truth) and is synced into Cloudflare via Wrangler — exactly the same flow that `.github/workflows/sync-auth-secrets.yml` runs in CI. AWS SES credentials are pushed directly to Wrangler here; their source of truth is GitHub Actions Secrets (`AWS_SES_ACCESS_KEY`, `AWS_SES_SECRET_KEY`, `AWS_SES_REGION`), which the CI sync workflow reads from. Set them in your repo's GitHub Secrets so CI re-syncs preserve them.

### BETTER_AUTH_SECRETS (required)

Read `PROJECT_NAME` from `.env` and form the SSM path:

```bash
PROJECT_NAME=$(grep '^PROJECT_NAME=' .env | cut -d= -f2)
SSM_PATH="/${PROJECT_NAME}/<env>/auth/better-auth-secrets"
```

Check whether the SSM parameter already exists. **If it does, do not regenerate** — that would invalidate every JWT signed with the old secret:

```bash
if aws ssm get-parameter --name "$SSM_PATH" --with-decryption \
     --query "Parameter.Value" --output text >/dev/null 2>&1; then
  echo "BETTER_AUTH_SECRETS already exists in SSM at $SSM_PATH — using existing value."
else
  echo "Generating new BETTER_AUTH_SECRETS and writing to SSM..."
  SECRET=$(openssl rand -base64 256 | tr -d '\n')
  aws ssm put-parameter \
    --name "$SSM_PATH" \
    --value "1:$SECRET" \
    --type SecureString \
    --description "BetterAuth signing secret for <env>"
fi
```

If `aws ssm put-parameter` fails with `AccessDeniedException`, halt and tell the user: their IAM user needs `ssm:PutParameter` and `ssm:GetParameter` permissions on `arn:aws:ssm:*:*:parameter/${PROJECT_NAME}/*`.

Now sync the value from SSM to Cloudflare (mirrors the `Sync BETTER_AUTH_SECRETS` step in `.github/workflows/sync-auth-secrets.yml`):

```bash
aws ssm get-parameter \
  --name "$SSM_PATH" \
  --with-decryption \
  --query "Parameter.Value" \
  --output text \
| (cd services/auth && npx wrangler secret put BETTER_AUTH_SECRETS -e <env>)
```

### AWS SES secrets (optional)

These enable email features (verification emails, magic links, password reset). Without them, those features are silently disabled — signups work without email verification. The IAM user needs `ses:SendEmail` permission.

```
(cd services/auth && npx wrangler secret put AWS_SES_ACCESS_KEY -e <env>)
(cd services/auth && npx wrangler secret put AWS_SES_SECRET_KEY -e <env>)
(cd services/auth && npx wrangler secret put AWS_SES_REGION -e <env>)
```

After setting all secrets, verify:

```
(cd services/auth && npx wrangler secret list -e <env>)
```

`BETTER_AUTH_SECRETS` is required. The three SES secrets are optional.

> **Note for re-runs:** if you re-invoke this skill, the SSM `get-parameter` check above will detect the existing `BETTER_AUTH_SECRETS` and reuse it. Active sessions and JWTs survive. To rotate intentionally, run `aws ssm delete-parameter --name "$SSM_PATH"` first, then re-run the skill.

## Step 9 — Enable the service in Nx

Remove `services/auth` from `.nxignore` at the repo root. Once removed, Nx will include the auth service in `nx affected` runs and CI pipelines.

## Step 10 — Verify

Run these checks to confirm everything is working:

1. Visit `https://auth.<env-prefix><URL>/api/auth/ok` — should return `{"ok":true}`
2. Visit `https://auth.<env-prefix><URL>/api/auth/get-session` — should return the literal `null` (not an error)
3. Visit `https://auth.<env-prefix><URL>/api/auth/.well-known/jwks.json` — should return `{"keys":[...]}` with at least one Ed25519 key

Where `<env-prefix>` is `staging.` for staging and empty for production.

If both pass, the auth service is live. Tell the user setup is complete and point them to `services/auth/README.md` for next steps (wiring up consumer apps via `libs/auth/node`).

## Conventions

- Never commit `.env` files
- Never store secrets in `wrangler.jsonc`
- The `AUTH_ENABLED=true` change in `.env` should be committed (it is not a secret)
- If the user is setting up production after staging, repeat from Step 2 with `production` as the environment
