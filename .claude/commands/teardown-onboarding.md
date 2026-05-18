Tear down all staging cloud resources provisioned by /onboard. Used by the test repo loop to reset state between onboarding runs. External cloud state only — does not touch dev tooling, GitHub Secrets, the S3 bucket, or git config.

## What this skill does NOT do

- Does **not** uninstall Homebrew, Volta, Node, uv, Maven, Java, or VSCode extensions.
- Does **not** clear GitHub Secrets, Variables, branch protection, or the Cocogitto bot.
- Does **not** delete the S3 bucket holding Terraform state.
- Does **not** modify `~/.gitconfig` or repo-local git settings.

The mutation surface is staging cloud resources only: Cloudflare Workers / KV / D1 / Hyperdrive configs, the AWS DynamoDB table that holds resolved config blobs, and Neon Postgres projects.

Follow these steps in order.

## Step 1 — Confirm

Read `PROJECT_NAME` from the root `.env` file:

```bash
grep '^PROJECT_NAME=' .env | cut -d= -f2
```

Ask the user:

> "This will destroy ALL staging cloud resources for `PROJECT_NAME=<value>`. Cloudflare Workers, KV namespaces, D1 databases, Hyperdrive configs, AWS DynamoDB tables, and Neon Postgres projects will be deleted. Continue? [y/N]"

Halt if the user does not answer yes.

## Step 2 — Per-service teardown

For each subdirectory under `services/` that is **not** listed in the root `.nxignore`:

1. Check if `.claude/commands/teardown-<svc>.md` exists.
2. If yes: invoke `/teardown-<svc>` inline. Wait for it to complete before continuing.
3. If no: print a warning and skip:

   > "No teardown skill for service `<svc>`. Tear it down manually if needed."

Service-specific teardown is the responsibility of the service's own skill — this orchestrator just sequences the calls.

## Step 3 — Tear down deployed Cloudflare resources (Workers + Hyperdrive)

Enumerate worker names from two sources and union them. The file-based pass catches everything documented on the branch; the API-based pass catches orphans — workers that were deployed by a previous iteration but whose `wrangler.jsonc` no longer exists on the current branch (e.g. renamed or deleted between cycles).

```bash
# Source CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, PROJECT_NAME from .env
set -a; . .env; set +a

# Pass 1 — read env.staging.name from each wrangler.jsonc on the current branch.
# wrangler.jsonc files allow JSONC comments + trailing commas; strip them before jq.
WORKERS_FROM_FILES=$(
  for f in apps/*/wrangler.jsonc services/*/wrangler.jsonc; do
    [ -f "$f" ] || continue
    sed -E 's|//[^"]*$||; s|/\*[^*]*\*+([^/*][^*]*\*+)*/||g' "$f" \
      | tr '\n' ' ' \
      | sed -E 's/,(\s*[}\]])/\1/g' \
      | jq -r '.env.staging.name // empty' 2>/dev/null
  done | sort -u
)

# Pass 2 — list all Workers in the Cloudflare account and filter by ${PROJECT_NAME}-
# prefix. This catches orphans that pass 1 misses.
WORKERS_FROM_API=$(
  curl -fsS \
    "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    | jq -r --arg p "${PROJECT_NAME}-" '.result[]?.id | select(startswith($p))' \
    | sort -u
)

WORKERS=$(printf '%s\n%s\n' "$WORKERS_FROM_FILES" "$WORKERS_FROM_API" | sort -u | sed '/^$/d')

if [ -z "$WORKERS" ]; then
  echo "No workers found (neither in repo files nor in CF account with prefix ${PROJECT_NAME}-) — skipping."
else
  echo "Workers to delete (union of file-based + CF API enumeration):"
  echo "$WORKERS"
fi
```

If pass 2's `curl` fails with `401`/`403`, the user's `CLOUDFLARE_API_TOKEN` may be missing `Workers Scripts:Read` — in that case pass 1 will still catch the on-branch workers, but you should tell the user to update the token's permissions so future teardowns catch orphans too.

For each worker name in the unioned list, delete it via wrangler. The worker may not actually exist in Cloudflare (if a prior teardown already removed it, or it was never deployed) — in that case wrangler returns `code: 10007` and we just log and continue.

```bash
for w in $WORKERS; do
  echo "Deleting worker: $w"
  npx wrangler delete --name "$w" 2>&1 | tail -5 || true
done
```

If wrangler can't authenticate, the user's `CLOUDFLARE_API_TOKEN` may be missing `Workers Scripts:Edit`. Halt and tell them to update the token's permissions.

If `apps/` or `services/` contains projects with no `env.staging.name` (e.g. AWS Lambda apps that don't use wrangler at all), they're simply skipped in pass 1 — that's fine, those are torn down by their own `tf-destroy` targets, not by this skill. Pass 2's prefix-filter approach also leaves them alone unless they happened to be deployed as Cloudflare workers (unlikely).

### Hyperdrive configs

Enumerate Cloudflare Hyperdrive configs by the same `${PROJECT_NAME}-` prefix and delete any that match. Hyperdrive configs are orphans only if `/teardown-auth-service` didn't run for a prior iteration's auth setup — Step 2's per-service teardown should already have cleaned them up via Terraform.

```bash
HYPERDRIVE_CONFIGS=$(
  curl -fsS \
    "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/hyperdrive/configs" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    | jq -r --arg p "${PROJECT_NAME}-" '.result[]? | select(.name | startswith($p)) | .id' \
    || true
)

if [ -z "$HYPERDRIVE_CONFIGS" ]; then
  echo "No Hyperdrive configs found with prefix ${PROJECT_NAME}- — skipping."
else
  for hid in $HYPERDRIVE_CONFIGS; do
    echo "Deleting Hyperdrive config: $hid"
    curl -fsS -X DELETE \
      "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/hyperdrive/configs/$hid" \
      -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" || true
  done
fi
```

If the enumeration `curl` returns `401`/`403`, the `CLOUDFLARE_API_TOKEN` likely lacks `Account / Hyperdrive : Edit`. Tell the user to update the token's permissions.

## Step 4 — Tear down orphan Neon Postgres projects (conditional)

Neon projects are tracked in `/teardown-auth-service`'s Terraform destroy. This step is a SAFETY NET for projects orphaned by a previous iteration that didn't tear down cleanly. Only runs if `NEON_API_KEY` is set — without it, Neon projects belong to a Neon account the skill can't authenticate against.

```bash
NEON_API_KEY_VAL=$(grep '^NEON_API_KEY=' .env 2>/dev/null | cut -d= -f2-)
if [ -z "$NEON_API_KEY_VAL" ] || [ "$NEON_API_KEY_VAL" = "your-api-key" ]; then
  echo "NEON_API_KEY not set — skipping Neon project cleanup."
  echo "If you set up the auth service, run /teardown-auth-service first."
else
  PROJECT_IDS=$(
    curl -fsS \
      -H "Authorization: Bearer $NEON_API_KEY_VAL" \
      "https://console.neon.tech/api/v2/projects" \
      | jq -r --arg p "${PROJECT_NAME}-staging-" '.projects[]? | select(.name | startswith($p)) | .id' \
      || true
  )

  if [ -z "$PROJECT_IDS" ]; then
    echo "No Neon staging projects found with prefix ${PROJECT_NAME}-staging- — skipping."
  else
    for pid in $PROJECT_IDS; do
      echo "Deleting Neon project: $pid"
      curl -fsS -X DELETE \
        -H "Authorization: Bearer $NEON_API_KEY_VAL" \
        "https://console.neon.tech/api/v2/projects/$pid" || true
    done
  fi
fi
```

The cleanup is best-effort and non-fatal. If `NEON_API_KEY` is missing the skill prints a hint and continues. If the API returns errors, we log them and continue rather than halt — the next iteration's `/teardown-auth-service` or `/onboard` will retry if needed.

## Step 5 — Tear down config infrastructure (both envs)

`/onboard` Step 3 deploys config to **both** staging and production (production is infra-only — KV namespace + DynamoDB table, no real workload). Teardown must reverse both.

Run terraform destroy directly against each environment of the `config` project. (There is no `nx run config:tf-destroy:<env>` target — config destroy is one-off enough that we run terraform manually.)

The state-file `key` is hard-coded in `config/infra/environments/<env>/backend.tf`, so the init command only needs the two backend-config files (shared + per-fork bucket name) — the same pattern `deploy-config:<env>` uses.

### 5a — Temporarily disable `prevent_destroy` on the KV module

`libs/infra/terraform/modules/cloudflare/kv/main.tf` has `lifecycle { prevent_destroy = true }` to protect against accidental KV deletion. Flip it to `false` before the destroy, then restore it afterwards (Step 5c). Without this flip, `terraform destroy` errors out with `Instance cannot be destroyed`.

Use the Edit tool to change:

```hcl
lifecycle {
  prevent_destroy = true
}
```

to:

```hcl
lifecycle {
  prevent_destroy = false
}
```

in `libs/infra/terraform/modules/cloudflare/kv/main.tf`.

### 5b — Destroy (both envs)

Loop over `staging` and `production` in that order. Each call destroys the KV namespace + DynamoDB table for that environment.

```bash
PROJECT_NAME=$(grep '^PROJECT_NAME=' .env | cut -d= -f2)
set -a; . .env; set +a

for ENV in staging production; do
  echo "=== Destroying config infra for $ENV ==="
  (
    cd config/infra/environments/$ENV
    terraform init -backend-config=../../../../libs/infra/terraform/backend.hcl -reconfigure

    TF_VAR_environment=$ENV \
    TF_VAR_project_name="$PROJECT_NAME" \
    TF_VAR_cloudflare_account_id="$CLOUDFLARE_ACCOUNT_ID" \
    TF_VAR_cloudflare_api_token="$CLOUDFLARE_API_TOKEN" \
    terraform destroy -auto-approve
  )
done
```

This destroys both Cloudflare KV namespaces and both AWS DynamoDB tables that `/onboard`'s Step 3 created. The S3 bucket holding Terraform state is left intact so subsequent `/onboard` runs can reuse it.

### 5c — Restore `prevent_destroy`

Always restore the guard so future `terraform apply` calls (e.g. a fresh `/onboard`) re-create the namespace with the safety in place. Use the Edit tool to revert `libs/infra/terraform/modules/cloudflare/kv/main.tf`:

```hcl
lifecycle {
  prevent_destroy = true
}
```

If 5b fails partway through, you should still run 5c — leaving `prevent_destroy = false` in source control is a footgun for the next user.

If `terraform init` fails because the backend config is wrong, check the `bucket = "..."` line in `libs/infra/terraform/backend.hcl` matches a bucket your AWS credentials can reach.

## Step 6 — Reset hardcoded KV namespace IDs back to placeholders

After destroy, the KV namespace IDs that `/onboard` Step 4 wrote into every `wrangler.jsonc` are now stale — they reference namespaces that no longer exist. The next `/onboard` run will create new namespaces with new IDs, but Step 5's stale-ID detection only catches them if the files don't already have a known placeholder. Reset the files now so the next `/onboard` sees a clean placeholder state.

For each `wrangler.jsonc` file:

```bash
for f in apps/*/wrangler.jsonc services/*/wrangler.jsonc tools/generators/*/files/wrangler.jsonc__tmpl__; do
  [ -f "$f" ] || continue

  # Parse the current staging/production IDs out of the file.
  # wrangler.jsonc files allow JSONC comments + trailing commas — strip before jq.
  STRIPPED=$(sed -E 's|//[^"]*$||; s|/\*[^*]*\*+([^/*][^*]*\*+)*/||g' "$f" \
    | tr '\n' ' ' \
    | sed -E 's/,(\s*[}\]])/\1/g')

  STAGING_ID=$(echo "$STRIPPED" | jq -r '.env.staging.kv_namespaces[]?.id // empty' 2>/dev/null)
  PRODUCTION_ID=$(echo "$STRIPPED" | jq -r '.env.production.kv_namespaces[]?.id // empty' 2>/dev/null)

  if [ -n "$STAGING_ID" ] && [ "$STAGING_ID" != "<staging-kv-namespace-id>" ]; then
    # Replace the exact captured ID with the placeholder. Scoped to that literal value, so
    # we won't accidentally touch other IDs (e.g. an unrelated namespace_id elsewhere).
    sed -i.bak "s|\"id\": \"$STAGING_ID\"|\"id\": \"<staging-kv-namespace-id>\"|g" "$f"
    rm -f "$f.bak"
    echo "Reset staging KV ID in: $f"
  fi

  if [ -n "$PRODUCTION_ID" ] && [ "$PRODUCTION_ID" != "<production-kv-namespace-id>" ]; then
    sed -i.bak "s|\"id\": \"$PRODUCTION_ID\"|\"id\": \"<production-kv-namespace-id>\"|g" "$f"
    rm -f "$f.bak"
    echo "Reset production KV ID in: $f"
  fi
done
```

Notes:
- If a file has no `env.staging.kv_namespaces` or no `env.production.kv_namespaces` (e.g. the astro generator template, which is static-assets-only), the jq query returns empty and that env is skipped — no false replacements.
- The sed pattern matches the exact captured ID value, so if two files contain the same real ID (the normal case), both get reset in a single pass without interference.
- After this step, `git diff` should show every formerly-hardcoded wrangler.jsonc reverted to placeholders.

## Step 7 — Final message

Print:

> "Staging resources wiped and KV-ID placeholders restored in wrangler.jsonc files.
>
> Review the diff:
>
>     git diff apps services tools/generators
>
> The wrangler.jsonc files should be back to their placeholder state.
>
> To get back to a fully clean repo state for the next test run:
>
>     git fetch upstream
>     git reset --hard upstream/main
>     git push --force origin main
>
> Then re-run /onboard."
