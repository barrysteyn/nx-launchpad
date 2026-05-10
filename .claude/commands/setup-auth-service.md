Set up the auth service for a fresh fork of this repo. This provisions the required Cloudflare infrastructure, migrates the database, deploys the worker, and configures secrets.

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

Also verify that Terraform is installed:
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

1. In `services/auth/wrangler.jsonc`, set `MULTITENANCY_ENABLED` to `"true"` in both the `staging` and `production` env blocks.
2. In `services/auth/src/worker/auth.generate.ts`, set `MULTITENANCY_ENABLED: 'true'` in the stub env.
3. Regenerate the schema for the chosen mode:
   ```
   npx nx run auth:db-generate
   ```
   This regenerates `src/worker/schema.ts` and `schema/0000_init.sql` with the organisation plugin's tables instead of the admin plugin's tables.

Warn the user: **switching modes after the database has been migrated requires a manual DB migration** — it is not safe to simply flip the flag on an existing populated database.

## Step 4 — Provision infrastructure (D1 database)

```
npx nx run auth:tf-apply:<env>
```

Wait for it to complete. Read the output and extract:
- `d1_database_id`
- `d1_database_name`

Tell the user these values and proceed to the next step.

## Step 5 — Update wrangler.jsonc

Open `services/auth/wrangler.jsonc`. Find the `<env>` block inside `"env"` and fill in the real values from Terraform output:

```jsonc
"<env>": {
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "<d1_database_name from terraform>",
      "database_id": "<d1_database_id from terraform>"
    }
  ]
}
```

Only update the values that are still placeholders. If they already contain real IDs (non-placeholder strings), leave them alone.

## Step 6 — Run database migration

```
npx nx run auth:db-migrate:<env>
```

This applies `schema/0000_init.sql` to the remote D1 database. If it fails, check that `CLOUDFLARE_API_TOKEN` has D1 Edit permissions (see README for the full permissions table).

## Step 7 — Deploy the worker

```
npx nx run auth:deploy:<env>
```

This builds the app, runs Terraform (idempotent), and deploys to Cloudflare. The worker must be deployed before secrets can be set in the next step.

## Step 8 — Set secrets

Secrets are never stored in files. `BETTER_AUTH_SECRETS` lives in AWS SSM (encrypted, source of truth) and is synced into Cloudflare via Wrangler — exactly the same flow that `.github/workflows/sync-auth-secrets.yml` runs in CI. AWS SES credentials are pushed directly to Wrangler. Note: the CI sync workflow (`.github/workflows/sync-auth-secrets.yml`) reads them from SSM at `/${PROJECT_NAME}/${env}/auth/aws-ses-{access-key,secret-key,region}` — if you want CI re-runs to preserve them, mirror them into SSM yourself with `aws ssm put-parameter --type SecureString` after this skill completes. (For BETTER_AUTH_SECRETS the skill handles SSM automatically; SES is currently kept manual.)

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
    --value "$SECRET" \
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

The subshell wrapper groups the `cd` and `wrangler` together on the right side of the pipe, and (more importantly for the standalone commands below) preserves the parent shell's cwd.

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

1. Visit `https://auth.<env-prefix><URL>/api/auth/get-session` — should return `{"session":null,"user":null}` (not an error)
2. Visit `https://auth.<env-prefix><URL>/api/auth/.well-known/jwks.json` — should return a JSON object with a `keys` array

Where `<env-prefix>` is `staging.` for staging and empty for production.

If both pass, the auth service is live. Tell the user setup is complete and point them to `services/auth/README.md` for next steps (wiring up consumer apps via `libs/auth/node`).

## Conventions

- Never commit `.env` files
- Never store secrets in `wrangler.jsonc`
- The `AUTH_ENABLED=true` change in `.env` should be committed (it is not a secret)
- If the user is setting up production after staging, repeat from Step 2 with `production` as the environment
