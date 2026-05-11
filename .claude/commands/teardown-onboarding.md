Tear down all staging cloud resources provisioned by /onboard. Used by the test repo loop to reset state between onboarding runs. External cloud state only — does not touch dev tooling, GitHub Secrets, the S3 bucket, or git config.

## What this skill does NOT do

- Does **not** uninstall Homebrew, Volta, Node, uv, Maven, Java, or VSCode extensions.
- Does **not** clear GitHub Secrets, Variables, branch protection, or the Cocogitto bot.
- Does **not** delete the S3 bucket holding Terraform state.
- Does **not** modify `~/.gitconfig` or repo-local git settings.

The mutation surface is staging cloud resources only: Cloudflare Workers / KV / D1, and the AWS DynamoDB table that holds resolved config blobs.

Follow these steps in order.

## Step 1 — Confirm

Read `PROJECT_NAME` from the root `.env` file:

```bash
grep '^PROJECT_NAME=' .env | cut -d= -f2
```

Ask the user:

> "This will destroy ALL staging cloud resources for `PROJECT_NAME=<value>`. Cloudflare Workers, KV namespaces, D1 databases, and AWS DynamoDB tables will be deleted. Continue? [y/N]"

Halt if the user does not answer yes.

## Step 2 — Per-service teardown

For each subdirectory under `services/` that is **not** listed in the root `.nxignore`:

1. Check if `.claude/commands/teardown-<svc>.md` exists.
2. If yes: invoke `/teardown-<svc>` inline. Wait for it to complete before continuing.
3. If no: print a warning and skip:

   > "No teardown skill for service `<svc>`. Tear it down manually if needed."

Service-specific teardown is the responsibility of the service's own skill — this orchestrator just sequences the calls.

## Step 3 — Tear down deployed Cloudflare Workers (apps + services)

Enumerate worker names by reading the `env.staging.name` field of every `wrangler.jsonc` in the repo. This catches all naming conventions (including those that don't follow the `${project_name}-${env}-${app}` prefix) and avoids relying on Cloudflare API enumeration matching a hard-coded prefix.

```bash
# Source CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID from .env (export both)
set -a; . .env; set +a

# wrangler.jsonc files allow JSONC comments + trailing commas; strip them before jq
WORKERS=$(
  for f in apps/*/wrangler.jsonc services/*/wrangler.jsonc; do
    [ -f "$f" ] || continue
    # Remove // line comments and /* */ block comments; tolerate trailing commas
    sed -E 's|//[^"]*$||; s|/\*[^*]*\*+([^/*][^*]*\*+)*/||g' "$f" \
      | tr '\n' ' ' \
      | sed -E 's/,(\s*[}\]])/\1/g' \
      | jq -r '.env.staging.name // empty' 2>/dev/null
  done | sort -u
)

if [ -z "$WORKERS" ]; then
  echo "No worker names found in apps/*/wrangler.jsonc or services/*/wrangler.jsonc — skipping."
else
  echo "Staging workers to delete:"
  echo "$WORKERS"
fi
```

For each worker name in the list, delete it via wrangler. The worker may not actually exist in Cloudflare (if a prior teardown already removed it, or it was never deployed) — in that case wrangler returns `code: 10007` and we just log and continue.

```bash
for w in $WORKERS; do
  echo "Deleting worker: $w"
  npx wrangler delete --name "$w" 2>&1 | tail -5 || true
done
```

If wrangler can't authenticate, the user's `CLOUDFLARE_API_TOKEN` may be missing `Workers Scripts:Edit`. Halt and tell them to update the token's permissions.

If `apps/` or `services/` contains projects with no `env.staging.name` (e.g. AWS Lambda apps that don't use wrangler at all), they're simply skipped — that's fine, those are torn down by their own `tf-destroy` targets, not by this skill.

## Step 4 — Tear down config infrastructure

Run terraform destroy directly against the staging environment of the `config` project. (There is no `nx run config:tf-destroy:staging` target — config destroy is one-off enough that we run terraform manually.)

The state-file `key` is hard-coded in `config/infra/environments/staging/backend.tf`, so the init command only needs the shared `backend.hcl` — the same pattern `deploy-config:staging` uses.

```bash
PROJECT_NAME=$(grep '^PROJECT_NAME=' .env | cut -d= -f2)
set -a; . .env; set +a

cd config/infra/environments/staging
terraform init -backend-config=../../../../libs/infra/backend.hcl -reconfigure

TF_VAR_environment=staging \
TF_VAR_project_name="$PROJECT_NAME" \
TF_VAR_cloudflare_account_id="$CLOUDFLARE_ACCOUNT_ID" \
TF_VAR_cloudflare_api_token="$CLOUDFLARE_API_TOKEN" \
terraform destroy -auto-approve

cd -
```

This destroys the Cloudflare KV namespace and the AWS DynamoDB table that `/onboard`'s Step 3 created. The S3 bucket holding Terraform state is left intact so subsequent `/onboard` runs can reuse it.

If `terraform init` fails because the backend config is wrong, check `libs/infra/backend.hcl` against the bucket name and rerun.

## Step 5 — Final message

Print:

> "Staging resources wiped. To get back to a clean repo state for the next test run:
>
>     git fetch upstream
>     git reset --hard upstream/main
>     git push --force origin main
>
> Then re-run /onboard."
