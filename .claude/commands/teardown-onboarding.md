Tear down all staging cloud resources provisioned by /onboard. Used by the test repo loop to reset state between onboarding runs. External cloud state only — does not touch dev tooling, GitHub Secrets, the S3 bucket, or git config.

## What this skill does NOT do

- Does **not** uninstall Homebrew, Volta, Node, uv, Maven, Java, or VSCode extensions.
- Does **not** clear GitHub Secrets, Variables, branch protection, or the Cocogitto bot.
- Does **not** delete the S3 bucket holding Terraform state.
- Does **not** modify `~/.gitconfig` or repo-local git settings.

The mutation surface is staging cloud resources only: Cloudflare Workers / KV / D1, AWS DynamoDB tables and Lambdas.

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

## Step 3 — Tear down deployed Cloudflare Workers (apps)

List Cloudflare Workers in the account whose name begins with `${PROJECT_NAME}-staging-`:

```bash
PROJECT_NAME=$(grep '^PROJECT_NAME=' .env | cut -d= -f2)
npx wrangler deployments list --json 2>/dev/null \
  | jq -r --arg p "${PROJECT_NAME}-staging-" '.[]?.script_name | select(startswith($p))' \
  | sort -u
```

For each worker name printed, delete it:

```bash
npx wrangler delete --name <worker-name>
```

If `wrangler deployments list` doesn't expose the names cleanly, fall back to asking the user:

> "I couldn't auto-detect deployed workers. Please run `npx wrangler deployments list` and tell me which workers (matching `${PROJECT_NAME}-staging-*`) to delete."

Then run `npx wrangler delete --name <name>` for each name they confirm.

## Step 4 — Tear down config infrastructure

Run:

```bash
npx nx run config:tf-destroy:staging
```

This destroys the Cloudflare KV namespace and the AWS DynamoDB table created by `/onboard`'s Step 3. The S3 bucket for Terraform state is left intact.

If `tf-destroy:staging` is not yet defined as a target on the `config` project, fall back to:

```bash
cd config/infra/environments/staging
TF_VAR_environment=staging \
TF_VAR_project_name="$PROJECT_NAME" \
TF_VAR_cloudflare_account_id="$CLOUDFLARE_ACCOUNT_ID" \
TF_VAR_cloudflare_api_token="$CLOUDFLARE_API_TOKEN" \
terraform destroy -auto-approve
cd -
```

## Step 5 — Final message

Print:

> "Staging resources wiped. To get back to a clean repo state for the next test run:
>
>     git fetch upstream
>     git reset --hard upstream/main
>     git push --force origin main
>
> Then re-run /onboard."
