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
missing=()
for cmd in gh aws terraform; do
  command -v "$cmd" >/dev/null 2>&1 || missing+=("$cmd")
done
# wrangler may not be on PATH but npx wrangler always works
npx wrangler --version >/dev/null 2>&1 || missing+=("wrangler")

if [ ${#missing[@]} -gt 0 ]; then
  echo "Missing: ${missing[*]}"
  exit 1
fi
echo "All cloud CLIs available."
```

If any are missing, halt with: "Dev tooling installation incomplete. Open a new terminal (PATH may not be loaded) and re-run `/onboard`."

## Step 2 — Verify cloud prereqs

Before running the checks, remind the user about Cloudflare token permissions (this skill's most common silent-failure mode is an under-permissioned token):

> "Your `CLOUDFLARE_API_TOKEN` needs these permissions, set as a Custom token in the Cloudflare dashboard:
>
> - Account / Workers Scripts / **Edit** (worker deploys)
> - Account / Workers KV Storage / **Edit** (config KV)
> - Account / D1 / **Edit** (auth service, if you opt in)
>
> Optional Zone-level (only if using custom domains): Workers Routes / Edit, DNS / Edit.
>
> If your token is missing any of these, regenerate it at https://dash.cloudflare.com/profile/api-tokens before continuing."

Now run each check below in order. **Halt** on the first failure (with the listed remediation message) unless the row is marked `WARN`.

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

### 2.3 — Terraform state bucket (create-if-missing)

Read `libs/infra/backend.hcl` line 1 to see the configured bucket name:

```bash
BUCKET=$(grep -E '^bucket\s*=' libs/infra/backend.hcl | head -1 | sed -E 's/^[^"]*"([^"]+)".*/\1/')
echo "Configured bucket: $BUCKET"
```

**If the bucket value is still the placeholder** (`terraform-state-nx-launchpad-randomstringhere`):

1. Read `PROJECT_NAME` from `.env` and propose a unique bucket name:

   ```bash
   PROJECT_NAME=$(grep '^PROJECT_NAME=' .env | cut -d= -f2)
   PROPOSED="terraform-state-${PROJECT_NAME}-$(openssl rand -hex 4)"
   echo "Proposed bucket name: $PROPOSED"
   ```

2. Ask the user:

   > "I can create the S3 bucket for Terraform state now. Proposed name: `<PROPOSED>`. Region: `us-east-1`. Versioning will be enabled.
   >
   > Press Enter to accept, type a custom name to override, or `n` to halt and create manually."

3. If they accept (Enter) or provide a custom name, set `BUCKET` to that value and run:

   ```bash
   aws s3api create-bucket --bucket "$BUCKET" --region us-east-1
   aws s3api put-bucket-versioning \
     --bucket "$BUCKET" \
     --versioning-configuration Status=Enabled
   ```

   If `create-bucket` fails with `BucketAlreadyOwnedByYou`, the bucket exists in your account — proceed. If it fails with `BucketAlreadyExists`, the name is taken globally — ask the user for a different name and retry.

4. After the bucket is created (or confirmed-exists), patch `libs/infra/backend.hcl` line 1 to set the bucket name. Use the Edit tool to replace the placeholder `terraform-state-nx-launchpad-randomstringhere` with `$BUCKET`.

5. Show the user the `git diff libs/infra/backend.hcl` and confirm before continuing.

6. If they answered `n` (halt and create manually), print the manual instructions and halt:

   > "Create the bucket yourself:
   >     aws s3api create-bucket --bucket <unique-name> --region us-east-1
   >     aws s3api put-bucket-versioning --bucket <unique-name> --versioning-configuration Status=Enabled
   > Update `libs/infra/backend.hcl` line 1 with the bucket name, then re-run `/onboard`."

**If the bucket value is NOT the placeholder** (a real name is already in backend.hcl): verify it exists:

```bash
aws s3api head-bucket --bucket "$BUCKET"
```

If `head-bucket` exits non-zero, halt with: "S3 bucket `$BUCKET` (from `libs/infra/backend.hcl`) was not found or is not accessible. Verify it exists, your AWS credentials have access, and the region in `backend.hcl` matches the bucket's region."

### 2.4 — GitHub Secrets

```bash
secrets=$(gh secret list --json name --jq '.[].name')
for s in AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID; do
  echo "$secrets" | grep -qx "$s" || { echo "missing: $s"; exit 1; }
done
```

If any are missing, halt with: "Add missing GitHub Actions Secrets at `https://github.com/<owner>/<repo>/settings/secrets/actions`. Required: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID."

### 2.5 — GitHub Variables

```bash
vars=$(gh variable list --json name --jq '.[].name')
for v in PROJECT_NAME URL; do
  echo "$vars" | grep -qx "$v" || { echo "missing: $v"; exit 1; }
done
```

If any are missing, halt with: "Add missing GitHub Actions Variables at `https://github.com/<owner>/<repo>/settings/variables/actions`. Required: PROJECT_NAME, URL."

### 2.6 — Cocogitto bot installed

Programmatic detection of installed GitHub Apps from a user PAT is unreliable. Ask the user directly:

> "Is the Cocogitto bot installed on this repo? It's a GitHub App that enforces Conventional Commits on PRs.
>
> Verify at: https://github.com/<owner>/<repo>/settings/installations
>
> If not installed, install it now from https://github.com/apps/cocogitto-bot — it's free.
>
> Confirm installed? [y/N]"

(Replace `<owner>/<repo>` by parsing `gh repo view --json nameWithOwner --jq .nameWithOwner` — substitute the value into the prompt text before showing it to the user.)

If they answer no or skip, halt with: "Install the Cocogitto bot at https://github.com/apps/cocogitto-bot, then re-run `/onboard`."

### 2.7 — Branch protection on `main` (WARN-ONLY)

```bash
gh api "/repos/{owner}/{repo}/branches/main/protection" >/dev/null 2>&1
```

If exit code non-zero, **do not halt**. Print this warning and continue:

> "**Warning:** Branch protection on `main` is not configured. This is recommended but not required (it needs a paid GitHub plan for private repos). Add it later at the repo's Settings → Branches when available."

### 2.8 — All checks passed

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

Now rewrite the staging KV ID in every relevant file. The placeholder is `<staging-kv-namespace-id>`. Find files that still contain it:

```bash
FILES_TO_UPDATE=$(grep -lE '<staging-kv-namespace-id>' \
  apps/*/wrangler.jsonc services/*/wrangler.jsonc \
  tools/generators/*/files/wrangler.jsonc__tmpl__ 2>/dev/null || true)
```

If `FILES_TO_UPDATE` is empty, the staging KV IDs are already hardcoded. Print "Staging KV IDs already hardcoded — skipping." and continue to Step 5.

If `FILES_TO_UPDATE` lists files, edit each one. For each file, find the staging env block (the one whose key is `"staging"` inside `"env":{...}`) and replace `"id": "<staging-kv-namespace-id>"` with `"id": "<the literal value of STAGING_KV_ID printed earlier>"` — substitute the actual ID, not the shell variable.

Use the Edit tool with `old_string`/`new_string` per file rather than a global sed — the production block (which contains `"id": "<production-kv-namespace-id>"`) must not be touched.

After the edits, run:

```bash
git diff -- apps services tools/generators
```

Show the user the diff. If the diff is empty (nothing to update), skip the confirmation. Otherwise ask:

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

If the deploy fails, halt and surface the error — most failures here are missing values in the root `.env` (URL, PROJECT_NAME) needed at build time, or the new app's `wrangler.jsonc` not having the staging KV ID populated (Step 4 should have written it; if a fresh app was generated *after* Step 4 ran, its `wrangler.jsonc` came from the template which already has the right ID — so this should not happen).

## Step 6 — Services loop

Read the root `.nxignore` for `services/*` entries:

```bash
SVCS=$(grep -E '^services/' .nxignore | sed 's|services/||')
echo "$SVCS"
```

If no services are listed, print "No opt-in services found in .nxignore. Skipping services step." and continue to Step 7.

For each subdirectory listed:

1. Ask the user:

   > "Enable the `<svc>` service now? It will be deployed to staging. [y/N]"

2. If they say no, skip this service.

3. If they say yes:
   - Check whether `.claude/commands/setup-<svc>.md` exists.
   - If it does **not** exist, print a warning and skip:

     > "No setup skill found at `.claude/commands/setup-<svc>.md`. Skipping `<svc>` — set it up manually if needed."

   - If it exists, invoke `/setup-<svc>` inline. The skill is responsible for: applying its Terraform, removing the `services/<svc>` line from `.nxignore`, deploying the worker to staging, and setting any required secrets.

While iterating, track each service's outcome (`enabled`, `skipped`, or `missing-skill`). After the loop, print a one-line summary:

> "Services step done. enabled: <list> | skipped: <list> | missing-skill: <list>"

## Step 7 — Remove the onboarding callout from README

Open `README.md`. Locate the onboarding callout block — it begins with:

```markdown
> [!IMPORTANT]
> ## Onboarding
```

…and ends at the `---` separator that closes that block (the `---` is followed immediately by `## What to add next` or, if `## What to add next` doesn't exist yet, by `## Deployments`).

Delete every line from the opening `> [!IMPORTANT]` through and including that closing `---`. Do not touch `## What to add next` — it stays.

Verification:

```bash
grep -c "^> ## Onboarding" README.md
```

Expected: `0` (the onboarding callout is gone). Note: other `> [!IMPORTANT]` callouts elsewhere in the README (e.g. the Astro generator prereq note) are unrelated and stay.

```bash
grep -n "## What to add next\|## Deployments" README.md
```

Expected: both headings present.

## Step 8 — Commit, push, tail message

### 8.1 — Commit

```bash
git add -A
git commit -m "chore(onboard): apply onboarding configuration

KV namespace IDs hardcoded for staging, README onboarding callout
removed, services .nxignore updated by per-service skills.

Generated by /onboard."
```

If `git commit` reports nothing to commit (all earlier changes were already committed by sub-skills), continue.

### 8.2 — Optional push

Ask the user:

> "Push the `onboarding-and-setup` branch to origin and instruct me to open a PR to main? [Y/n]"

If yes:

```bash
git push -u origin onboarding-and-setup
```

Then print the GitHub PR-create URL using the actual repo name:

```bash
REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
echo "Open a PR: https://github.com/${REPO}/compare/main...onboarding-and-setup"
```

### 8.3 — Tail message

Print:

```
Onboarding complete. You're on branch `onboarding-and-setup`.

Next:
  • Merge the branch to main: open a PR or rebase locally.
  • Staging deploys run automatically on merge to main; production
    deploys run on merge to the `production` branch. The skill never
    touches production.

For everything else (adding services, adding apps, re-running
onboarding, resetting staging for a test run), see the
"What to add next" section in README.md.
```
