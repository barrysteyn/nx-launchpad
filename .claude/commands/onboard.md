End-to-end onboarding for a fresh fork of this repo. Walks through dev-tooling install, cloud prereq verification, staging-only config deploy, KV namespace ID hardcoding, optional static-site generation, optional service enablement, and README cleanup. Re-runnable; staging only — production deploys go through CI/CD.

> **Platform:** macOS only. The script invoked in Step 1 assumes Homebrew.
> **Scope:** staging only. Production deploys happen automatically when commits land on `main` (staging) and the `production` branch (production).

Follow these steps in order. Halt loudly on a failed prereq — never silently skip.

## Step 0 — Pre-flight: branch

If we are not already on a branch named `onboarding-and-setup`, create or switch to it:

```bash
current=$(git rev-parse --abbrev-ref HEAD)
if [ "$current" != "onboarding-and-setup" ]; then
  if git show-ref --verify --quiet refs/heads/onboarding-and-setup; then
    git checkout onboarding-and-setup
  else
    git checkout -b onboarding-and-setup
  fi
fi
```

Confirm with `git rev-parse --abbrev-ref HEAD` — should print `onboarding-and-setup`.

## Step 1 — Dev environment setup

Invoke `/dev-onboard` inline now and wait for it to complete. After it returns, confirm the cloud CLIs are on PATH:

```bash
command -v gh && command -v aws && command -v terraform && command -v wrangler 2>/dev/null || npx wrangler --version
```

If any are missing, halt with: "Dev tooling installation incomplete. Open a new terminal (PATH may not be loaded) and re-run `/onboard`."

## Step 2 — Verify cloud prereqs

Run each check below in order. **Halt** on the first failure (with the listed remediation message) unless the row is marked `WARN`.

### 2.1 — `.env` keys

Read `.env`. For each row below, check the predicate. On failure, print the listed message and halt.

| Row | Predicate | Failure message |
|---|---|---|
| ENVIRONMENT | `grep -q '^ENVIRONMENT=local$' .env` | "`.env` must set `ENVIRONMENT=local`. Production/staging are set by CI/CD automatically." |
| PROJECT_NAME | `grep '^PROJECT_NAME=' .env` exists and value is not `your-project-name` | "Set `PROJECT_NAME` in `.env` to a unique kebab-case name (currently placeholder)." |
| URL | `grep '^URL=' .env` exists and value is not `your-domain.com` | "Set `URL` in `.env` to your domain (currently placeholder)." |
| AWS auth | `grep -q '^AWS_PROFILE=' .env` OR (`grep -q '^AWS_ACCESS_KEY_ID=' .env` AND `grep -q '^AWS_SECRET_ACCESS_KEY=' .env`) | "Set either `AWS_PROFILE` or both `AWS_ACCESS_KEY_ID`+`AWS_SECRET_ACCESS_KEY` in `.env`." |
| AWS_REGION | `grep '^AWS_REGION=' .env` non-empty | "Set `AWS_REGION` in `.env` (e.g. `us-east-1`)." |
| CLOUDFLARE_API_TOKEN | exists and not `your-api-token` | "Set `CLOUDFLARE_API_TOKEN` in `.env` (currently placeholder)." |
| CLOUDFLARE_ACCOUNT_ID | exists and not `your-account-id` | "Set `CLOUDFLARE_ACCOUNT_ID` in `.env` (currently placeholder)." |

### 2.2 — `gh auth status`

```bash
gh auth status
```

If exit code is non-zero, halt with: "Run `gh auth login` to authenticate the GitHub CLI, then re-run `/onboard`."

### 2.3 — Terraform state bucket configured

Read `libs/infra/backend.hcl` line 1. If the bucket value is `terraform-state-nx-launchpad-randomstringhere`, halt with:

> "`libs/infra/backend.hcl` still has the placeholder bucket name. Create your S3 bucket (`aws s3api create-bucket --bucket <unique-name> --region us-east-1` then `aws s3api put-bucket-versioning --bucket <unique-name> --versioning-configuration Status=Enabled`) and update `libs/infra/backend.hcl` line 1 with the real bucket name."

### 2.4 — S3 bucket exists

Extract the bucket name from `libs/infra/backend.hcl`:

```bash
BUCKET=$(grep -E '^bucket\s*=' libs/infra/backend.hcl | head -1 | sed -E 's/^[^"]*"([^"]+)".*/\1/')
aws s3api head-bucket --bucket "$BUCKET"
```

If `head-bucket` exits non-zero, halt with: "S3 bucket `$BUCKET` (from `libs/infra/backend.hcl`) was not found or is not accessible. Verify it exists and your AWS credentials have access to it."

### 2.5 — GitHub Secrets

```bash
secrets=$(gh secret list --json name --jq '.[].name')
for s in AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID; do
  echo "$secrets" | grep -qx "$s" || { echo "missing: $s"; exit 1; }
done
```

If any are missing, halt with: "Add missing GitHub Actions Secrets at `https://github.com/<owner>/<repo>/settings/secrets/actions`. Required: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID."

### 2.6 — GitHub Variables

```bash
vars=$(gh variable list --json name --jq '.[].name')
for v in PROJECT_NAME URL; do
  echo "$vars" | grep -qx "$v" || { echo "missing: $v"; exit 1; }
done
```

If any are missing, halt with: "Add missing GitHub Actions Variables at `https://github.com/<owner>/<repo>/settings/variables/actions`. Required: PROJECT_NAME, URL."

### 2.7 — Cocogitto bot installed

```bash
gh api "/repos/{owner}/{repo}/installation" 2>/dev/null \
  | jq -r '.app_slug // empty' \
  | grep -qx "cocogitto-bot"
```

If exit code non-zero, halt with: "Install the Cocogitto bot at https://github.com/apps/cocogitto-bot — required for Conventional Commits enforcement on PRs."

### 2.8 — Branch protection on `main` (WARN-ONLY)

```bash
gh api "/repos/{owner}/{repo}/branches/main/protection" >/dev/null 2>&1
```

If exit code non-zero, **do not halt**. Print this warning and continue:

> "**Warning:** Branch protection on `main` is not configured. This is recommended but not required (it needs a paid GitHub plan for private repos). Add it later at the repo's Settings → Branches when available."

### 2.9 — All checks passed

Print:

> "All cloud prerequisites verified. Proceeding to deploy staging config."

## Step 3 — Deploy staging config

Run:

```bash
npx nx run config:deploy-config:staging
```

This:
1. Runs Terraform to create the Cloudflare KV namespace (`${PROJECT_NAME}-staging-config`) and AWS DynamoDB table (`${PROJECT_NAME}-staging-config`).
2. Resolves `config/files/{default,staging}.yaml` and merges with SSM-referenced values.
3. Pushes the resolved blob to both stores.

Confirm success: the command should exit 0 and the trailing log lines should mention writing to KV and DynamoDB.

If it fails, common causes:
- `CLOUDFLARE_API_TOKEN` missing the `Workers KV Storage:Edit` permission.
- `aws s3api head-bucket` for the Terraform state bucket failed silently and Terraform can't acquire state lock.
- `PROJECT_NAME` contains characters disallowed by Cloudflare (must be DNS-safe lowercase kebab-case).

Halt and surface the error to the user — do not auto-retry.

## Step 4 — Extract & hardcode staging KV namespace ID

Read `PROJECT_NAME` from `.env`:

```bash
PROJECT_NAME=$(grep '^PROJECT_NAME=' .env | cut -d= -f2)
```

List KV namespaces and grab the staging one:

```bash
STAGING_KV_ID=$(npx wrangler kv namespace list 2>/dev/null \
  | jq -r --arg t "${PROJECT_NAME}-staging-config" '.[] | select(.title == $t) | .id')

if [ -z "$STAGING_KV_ID" ]; then
  echo "ERROR: KV namespace ${PROJECT_NAME}-staging-config not found"
  exit 1
fi

echo "Staging KV ID: $STAGING_KV_ID"
```

If `STAGING_KV_ID` is empty, halt: the namespace should have been created in Step 3 — investigate before continuing.

Now rewrite the staging KV ID in every relevant file. The placeholder is `<staging-kv-namespace-id>`. Files to update:

```
apps/*/wrangler.jsonc
services/*/wrangler.jsonc
tools/generators/*/files/wrangler.jsonc__tmpl__
```

For each file, find the `staging` env block (the one whose key is `"staging"` inside `"env":{...}`) and replace `"id": "<staging-kv-namespace-id>"` with `"id": "$STAGING_KV_ID"`.

Use the Edit tool with `old_string`/`new_string` per file rather than a global sed — the production block (which contains `"id": "<production-kv-namespace-id>"`) must not be touched.

Verification: after the edits, run:

```bash
git diff -- apps services tools/generators
```

Show the user the diff. Ask:

> "I'm about to commit these KV-ID changes (still on the `onboarding-and-setup` branch). Diff looks correct? [Y/n]"

If they say no, revert with `git checkout -- apps services tools/generators` and halt for them to investigate.

If they say yes, do **not** commit yet — the commit happens in Step 8 with everything else.

## Step 5 — Static site (optional)

Ask the user:

> "Generate an Astro static site for staging now? [y/N]"

If they answer no, skip ahead to Step 6.

If they answer yes:

1. Invoke `/generate-astro-cloudflare-app` inline. It will prompt for the app name and description, run the generator, and verify with lint / typecheck / test / build.
2. After the generator completes, capture the chosen app name (it's the value the user passed when prompted by the generator skill).
3. Deploy the new app to staging:

   ```bash
   npx nx run <app-name>:deploy:staging
   ```

4. After the deploy, print the staging worker URL (visible in the wrangler output) so the user can verify it loads.

If the deploy fails, halt and surface the error — most failures here are missing GitHub Variables (URL, PROJECT_NAME) flowing into the build, or the new app's `wrangler.jsonc` not having the staging KV ID populated (Step 4 should have written it; if a fresh app was generated *after* Step 4 ran, its `wrangler.jsonc` came from the template which already has the right ID — so this should not happen).

## Step 6 — Services loop

Read the root `.nxignore` for `services/*` entries:

```bash
grep -E '^services/' .nxignore
```

For each subdirectory in `services/` that appears in `.nxignore`:

1. Ask the user:

   > "Enable the `<svc>` service now? It will be deployed to staging. [y/N]"

2. If they say no, skip this service.

3. If they say yes:
   - Check whether `.claude/commands/setup-<svc>.md` exists.
   - If it does **not** exist, print a warning and skip:

     > "No setup skill found at `.claude/commands/setup-<svc>.md`. Skipping `<svc>` — set it up manually if needed."

   - If it exists, invoke `/setup-<svc>` inline. The skill is responsible for: applying its Terraform, removing the `services/<svc>` line from `.nxignore`, deploying the worker to staging, and setting any required secrets.

After the loop completes, print:

> "Services step done. Skipped, enabled, or warned-as-missing services: <list>."
