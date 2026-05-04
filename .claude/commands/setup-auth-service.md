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

## Step 3 — Provision infrastructure (D1 database)

```
npx nx run auth:tf-apply:<env>
```

Wait for it to complete. Read the output and extract:
- `d1_database_id`
- `d1_database_name`

Tell the user these values and proceed to the next step.

## Step 4 — Update wrangler.jsonc

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

## Step 5 — Run database migration

```
npx nx run auth:db-migrate:<env>
```

This applies `schema/0000_init.sql` to the remote D1 database. If it fails, check that `CLOUDFLARE_API_TOKEN` has D1 Edit permissions (see README for the full permissions table).

## Step 6 — Deploy the worker

```
npx nx run auth:deploy:<env>
```

This builds the app, runs Terraform (idempotent), and deploys to Cloudflare. The worker must be deployed before secrets can be set in the next step.

## Step 7 — Set secrets

Explain to the user that secrets are never stored in files — they are set directly in Cloudflare via Wrangler and injected at runtime.

### BETTER_AUTH_SECRETS

Generate a secret:
```
openssl rand -base64 256 | tr -d '\n'; echo
```

Then set it (run this and prompt the user to enter `1:<generated-value>`):
```
npx wrangler secret put BETTER_AUTH_SECRETS -e <env>
```

### AWS SES secrets (optional)

These enable email features (verification emails, magic links, password reset). Without them, those features are silently disabled — signups work without email verification. The IAM user needs `ses:SendEmail` permission.

```
npx wrangler secret put AWS_SES_ACCESS_KEY -e <env>
npx wrangler secret put AWS_SES_SECRET_KEY -e <env>
npx wrangler secret put AWS_SES_REGION -e <env>
```

After setting all secrets, verify:
```
npx wrangler secret list -e <env>
```

`BETTER_AUTH_SECRETS` is required. The three SES secrets are optional.

## Step 8 — Enable the service in Nx

Remove `services/auth` from `.nxignore` at the repo root. Once removed, Nx will include the auth service in `nx affected` runs and CI pipelines.

## Step 9 — Verify

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
