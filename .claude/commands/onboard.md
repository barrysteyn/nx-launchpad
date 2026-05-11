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

## Step 2 — Gather credentials and configure prerequisites

This step walks through each credential the workspace needs: gathering it (where to find/create), storing it locally in `.env`, and mirroring non-sensitive values to GitHub Variables and sensitive ones to GitHub Secrets so CI/CD can use them.

**Sensitive values never flow through this chat.** For tokens, secret keys, and account IDs, the skill instructs you to paste them directly into `.env` via your editor. The skill then reads them from `.env` to mirror to GitHub Secrets using `$(grep ...)` command substitution — Claude only sees the command template, never the value.

**Unattended mode:** if `.env` contains `ONBOARD_AUTO=true`, the skill skips paste-and-confirm prompts (since values are already in `.env`), auto-accepts the S3 bucket proposal, auto-confirms the KV diff, and auto-pushes at the end. Read this flag once at the top of Step 2:

```bash
AUTO=$(grep -E '^ONBOARD_AUTO=' .env 2>/dev/null | cut -d= -f2-)
[ "$AUTO" = "true" ] && echo "Unattended mode: ON" || echo "Unattended mode: off"
```

Reference `$AUTO` later in this step (and Step 4, Step 8) to gate the optional prompts.

### 2.1 — `gh auth status`

```bash
gh auth status
```

If exit code is non-zero, halt with: "Run `gh auth login` to authenticate the GitHub CLI, then re-run `/onboard`."

### 2.2 — Set up `.env` (interactive)

Ensure `.env` exists:

```bash
[ -f .env ] || cp .env.example .env
```

Walk through each entry below in order. For each, check if it's set to a non-placeholder value. If so, skip. Otherwise follow the per-row instructions.

#### `ENVIRONMENT=local` (auto-set, no prompt)

If `.env` doesn't already have `ENVIRONMENT=local`, set it:

```bash
if ! grep -q '^ENVIRONMENT=local$' .env; then
  # Replace any existing ENVIRONMENT line, or append if absent
  if grep -q '^ENVIRONMENT=' .env; then
    sed -i.bak 's|^ENVIRONMENT=.*|ENVIRONMENT=local|' .env && rm .env.bak
  else
    echo "ENVIRONMENT=local" >> .env
  fi
fi
```

CI/CD overrides this per environment; locally it stays `local`.

#### `PROJECT_NAME` (ask in chat — non-sensitive)

If `.env` has `PROJECT_NAME=your-project-name` or empty, ask:

> "Choose a `PROJECT_NAME`. This becomes the prefix for every AWS and Cloudflare resource (`${project_name}-${env}-${app}`). Must be kebab-case, lowercase, DNS-safe (e.g. `mycompany-app`)."

After they answer, use the Edit tool to replace the placeholder in `.env`.

#### `URL` (ask in chat — non-sensitive)

If `.env` has `URL=your-domain.com` or empty, ask:

> "Choose a `URL`. This is the root domain for your apps (e.g. `mycompany.com`). For test forks without real DNS, use a placeholder like `example.com` — the skill won't fail, but custom-domain features won't resolve."

Update `.env`.

#### `AWS_REGION` (ask in chat — non-sensitive)

If `.env` has `AWS_REGION=` empty or missing:

> "Which AWS region? (Default: `us-east-1`)"

Update `.env`.

#### AWS auth — choose form (auto-detect if possible)

Auto-detect first by inspecting `.env`:

```bash
HAS_PROFILE=$(grep -qE '^AWS_PROFILE=.+' .env && grep -qvE '^AWS_PROFILE=your-aws-profile$' .env && echo yes || echo no)
HAS_RAW_KEYS=$([ "$(grep -qE '^AWS_ACCESS_KEY_ID=.+' .env && grep -qE '^AWS_SECRET_ACCESS_KEY=.+' .env; echo $?)" = "0" ] && echo yes || echo no)
```

- If **HAS_RAW_KEYS=yes**: choose form (b). Skip the question.
- Else if **HAS_PROFILE=yes**: choose form (a). Skip the question.
- Else: ask the user:

> "How are your AWS credentials configured locally?
> a) `AWS_PROFILE` (a named profile in `~/.aws/credentials`)
> b) Raw `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`"

If they answer **(a)** AWS_PROFILE:
- Ask: "Which profile name?"
- Update `.env` so it has `AWS_PROFILE=<name>` (replace the placeholder line, or append).
- Note for later: CI still needs raw access keys in GitHub Secrets; the skill handles this in Step 2.4.

If they answer **(b)** raw keys:
- Tell them:

  > "Open `.env` in your editor (`code .env`, `nano .env`, etc.). Add these two lines, replacing the values with your actual keys:
  >
  >     AWS_ACCESS_KEY_ID=<your-access-key>
  >     AWS_SECRET_ACCESS_KEY=<your-secret-access-key>
  >
  > Where to get them: AWS Console → IAM → Users → your user → Security credentials → Create access key.
  >
  > Save and close. Press Enter here when done."

- After they confirm, verify both keys are present and non-empty:

  ```bash
  grep -qE '^AWS_ACCESS_KEY_ID=.+' .env && grep -qE '^AWS_SECRET_ACCESS_KEY=.+' .env
  ```

- If either is still missing, halt with: "AWS access keys still missing from `.env`. Paste them and re-run `/onboard`."

If using **(a)** AWS_PROFILE, also delete the placeholder `AWS_PROFILE=your-aws-profile` line and replace with the real profile name. Make sure raw key lines are NOT present in `.env`.

#### `CLOUDFLARE_API_TOKEN` (direct to editor — sensitive)

First check if the value is already set:

```bash
grep '^CLOUDFLARE_API_TOKEN=' .env | grep -qv 'your-api-token$' && echo "already set, skipping" || echo "needs paste"
```

If already set, print "CLOUDFLARE_API_TOKEN already set in .env — skipping" and proceed to the next entry. Otherwise:

Remind the user of required permissions:

> "Your `CLOUDFLARE_API_TOKEN` needs these permissions (Cloudflare dashboard → My Profile → API Tokens → Create Token → Custom token):
>
> - Account / Workers Scripts / **Edit** (worker deploys)
> - Account / Workers KV Storage / **Edit** (config KV)
> - Account / D1 / **Edit** (auth service, if you opt in)
>
> Optional Zone-level (only if using custom domains): Workers Routes / Edit, DNS / Edit.
>
> Create one at https://dash.cloudflare.com/profile/api-tokens — set 'Account Resources' to your account."

Then direct them:

> "Open `.env` in your editor. Replace `CLOUDFLARE_API_TOKEN=your-api-token` with your real token. Save and close. Press Enter here when done."

After they confirm, verify:

```bash
grep '^CLOUDFLARE_API_TOKEN=' .env | grep -qv 'your-api-token$'
```

If still placeholder, halt and ask them to try again.

#### `CLOUDFLARE_ACCOUNT_ID` (direct to editor — sensitive)

First check if already set:

```bash
grep '^CLOUDFLARE_ACCOUNT_ID=' .env | grep -qv 'your-account-id$' && echo "already set, skipping" || echo "needs paste"
```

If already set, print "CLOUDFLARE_ACCOUNT_ID already set in .env — skipping" and proceed. Otherwise:

> "Open `.env` in your editor. Replace `CLOUDFLARE_ACCOUNT_ID=your-account-id` with your Cloudflare Account ID.
>
> Find it at: Cloudflare dashboard → right sidebar → Account ID (click to copy).
>
> Save and close. Press Enter here when done."

Verify like `CLOUDFLARE_API_TOKEN` above.

### 2.3 — Mirror non-sensitive values to GitHub Variables

First, resolve the fork's repo name from the **`origin` remote directly** and reuse it on every `gh` call. Do NOT use `gh repo view` for this — when both `origin` and `upstream` are configured, `gh repo view` may return the upstream's owner/repo (it picks the alphabetically-first matching remote and silently succeeds, not erroring). That would silently mirror your secrets to the upstream repo. Always derive from `git config remote.origin.url`:

```bash
# Derive from the origin remote — unambiguous on multi-remote forks.
REPO=$(git config --get remote.origin.url | sed -E 's|.*[:/]([^/]+/[^/.]+)(\.git)?$|\1|')

# Fallback to gh only if there's no origin remote at all (rare).
if [ -z "$REPO" ]; then
  REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null)
fi

[ -n "$REPO" ] || { echo "Could not determine repo name from origin"; exit 1; }
echo "Targeting GitHub repo: $REPO"
```

`PROJECT_NAME` and `URL` are needed in CI as `vars.PROJECT_NAME` and `vars.URL`. Mirror them automatically:

```bash
for v in PROJECT_NAME URL; do
  value=$(grep "^${v}=" .env | cut -d= -f2-)
  current=$(gh variable list -R "$REPO" --json name,value --jq ".[] | select(.name == \"${v}\") | .value")
  if [ "$current" = "$value" ]; then
    echo "GitHub Variable ${v} already up-to-date"
  else
    gh variable set "${v}" -R "$REPO" --body "$value"
    echo "Set GitHub Variable: ${v}"
  fi
done
```

### 2.4 — Mirror sensitive values to GitHub Secrets

Cloudflare values are already in `.env`. Mirror them to GitHub Secrets — Claude only sees the command template (`$(grep ...)`), never the resolved value:

```bash
gh secret set CLOUDFLARE_API_TOKEN -R "$REPO" --body "$(grep '^CLOUDFLARE_API_TOKEN=' .env | cut -d= -f2-)"
gh secret set CLOUDFLARE_ACCOUNT_ID -R "$REPO" --body "$(grep '^CLOUDFLARE_ACCOUNT_ID=' .env | cut -d= -f2-)"
```

**For AWS access keys, branch on the form chosen in Step 2.2:**

If the user chose **(b) raw keys** (so `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` are in `.env`), mirror automatically:

```bash
gh secret set AWS_ACCESS_KEY_ID -R "$REPO" --body "$(grep '^AWS_ACCESS_KEY_ID=' .env | cut -d= -f2-)"
gh secret set AWS_SECRET_ACCESS_KEY -R "$REPO" --body "$(grep '^AWS_SECRET_ACCESS_KEY=' .env | cut -d= -f2-)"
```

If the user chose **(a) AWS_PROFILE**, the access keys aren't in `.env`. Tell them:

> "You're using `AWS_PROFILE` locally, so CI still needs raw access keys set manually as GitHub Secrets. Run these in your own terminal — each prompts for the value privately (it won't be echoed to terminal or this chat):
>
>     gh secret set AWS_ACCESS_KEY_ID -R <owner>/<repo>
>     gh secret set AWS_SECRET_ACCESS_KEY -R <owner>/<repo>
>
> Substitute `<owner>/<repo>` with the value `$REPO` printed in Step 2.3 (e.g. `your-name/your-fork`). Press Enter here when done."

After they confirm, verify both secrets exist on the fork:

```bash
count=$(gh secret list -R "$REPO" --json name --jq '.[].name' | grep -cE '^(AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY)$')
[ "$count" = "2" ]
```

If the count is not 2, halt with: "AWS access key secrets still missing from GitHub. Set them and re-run `/onboard`."

### 2.5 — Terraform state bucket (find-or-create) and per-fork backend.local.hcl

The bucket name lives in `libs/infra/backend.local.hcl` (gitignored). The committed `libs/infra/backend.hcl` only has shared config (region, versioning, encryption). This separation keeps `git reset --hard upstream/main` from clobbering the bucket name on each iteration.

Determine the bucket to use, in priority order:

1. **If `libs/infra/backend.local.hcl` already exists**, parse the bucket name from it and verify the bucket is reachable:

   ```bash
   if [ -f libs/infra/backend.local.hcl ]; then
     BUCKET=$(grep -E '^bucket\s*=' libs/infra/backend.local.hcl | head -1 | sed -E 's/^[^"]*"([^"]+)".*/\1/')
     echo "Configured bucket (from backend.local.hcl): $BUCKET"
     aws s3api head-bucket --bucket "$BUCKET" || { echo "Bucket $BUCKET is configured in backend.local.hcl but is not reachable. Delete the file and re-run /onboard, or fix manually."; exit 1; }
   fi
   ```

   If `head-bucket` succeeds, skip the rest of Step 2.5 — bucket is already wired up.

2. **If `backend.local.hcl` doesn't exist**, look for an existing fork bucket matching the project prefix:

   ```bash
   PROJECT_NAME=$(grep '^PROJECT_NAME=' .env | cut -d= -f2)
   EXISTING=$(aws s3api list-buckets \
     --query "Buckets[?starts_with(Name, 'terraform-state-${PROJECT_NAME}-')].Name" \
     --output text | head -1)
   ```

   - If `$EXISTING` is non-empty, the user has already created a fork bucket (likely from a prior `/onboard` run before `backend.local.hcl` was reset). Reuse it:

     ```bash
     BUCKET="$EXISTING"
     echo "Found existing fork bucket: $BUCKET (reusing)"
     ```

3. **If neither file nor existing bucket was found**, create a new one:

   ```bash
   PROPOSED="terraform-state-${PROJECT_NAME}-$(openssl rand -hex 4)"
   echo "Proposed bucket name: $PROPOSED"
   ```

   - If `$AUTO` is `true`: use `$PROPOSED` directly. Print `Auto-accepting bucket name: $PROPOSED`.
   - Otherwise, ask:

     > "No backend.local.hcl found and no existing fork bucket detected. I can create one now. Proposed name: `<PROPOSED>`. Region: `us-east-1`. Versioning will be enabled.
     >
     > Press Enter to accept, type a custom name to override, or `n` to halt."

   - If the user answered `n`, halt with manual instructions:

     > "Create the bucket yourself:
     >     aws s3api create-bucket --bucket <unique-name> --region us-east-1
     >     aws s3api put-bucket-versioning --bucket <unique-name> --versioning-configuration Status=Enabled
     > Then write the name into libs/infra/backend.local.hcl and re-run /onboard."

   - Otherwise, set `BUCKET` to the chosen value and create it:

     ```bash
     aws s3api create-bucket --bucket "$BUCKET" --region us-east-1
     aws s3api put-bucket-versioning \
       --bucket "$BUCKET" \
       --versioning-configuration Status=Enabled
     ```

     If `BucketAlreadyOwnedByYou`: proceed. If `BucketAlreadyExists`: ask for a different name (or halt if `$AUTO`).

4. **Write `libs/infra/backend.local.hcl`** with the chosen `$BUCKET` (whether reused or newly created):

   ```bash
   cat > libs/infra/backend.local.hcl <<EOF
   bucket = "${BUCKET}"
   EOF
   echo "Wrote libs/infra/backend.local.hcl"
   ```

   The file is in `.gitignore`, so it stays across `git reset --hard upstream/main` and won't be committed.

### 2.6 — Cocogitto bot installed

If `$AUTO` is `true`, assume the bot is installed (test-loop forks always have it). Print `Auto-assuming Cocogitto bot installed (ONBOARD_AUTO=true)` and continue.

Otherwise, programmatic detection of installed GitHub Apps from a user PAT is unreliable — ask the user directly:

> "Is the Cocogitto bot installed on this repo? It's a GitHub App that enforces Conventional Commits on PRs.
>
> Verify at: https://github.com/<owner>/<repo>/settings/installations
>
> If not installed, install it now from https://github.com/apps/cocogitto-bot — it's free.
>
> Confirm installed? [y/N]"

(Replace `<owner>/<repo>` with `$REPO` from Step 2.3 — substitute the value into the prompt text before showing it to the user.)

If they answer no or skip, halt with: "Install the Cocogitto bot at https://github.com/apps/cocogitto-bot, then re-run `/onboard`."

### 2.7 — Branch protection on `main` (WARN-ONLY)

```bash
gh api "/repos/${REPO}/branches/main/protection" >/dev/null 2>&1
```

If exit code non-zero, **do not halt**. Print this warning and continue:

> "**Warning:** Branch protection on `main` is not configured. This is recommended but not required (it needs a paid GitHub plan for private repos). Add it later at the repo's Settings → Branches when available."

### 2.8 — All checks passed

Print:

> "All cloud prerequisites verified. Proceeding to deploy staging config."

## Step 3 — Deploy staging config

Run:

Deploy to **both** staging and production. We provision the production KV namespace + DynamoDB table here (infra-only — no real workload code is deployed) so that Step 4 can hardcode both real IDs into every generator template at once. Without the production deploy, a freshly generated app's `wrangler.jsonc` would still have `<production-kv-namespace-id>` and its production deploy would fail.

```bash
npx nx run config:deploy-config:staging
npx nx run config:deploy-config:production
```

Each invocation:
1. Runs Terraform to create the Cloudflare KV namespace (`${PROJECT_NAME}-<env>-config`) and AWS DynamoDB table (`${PROJECT_NAME}-<env>-config`).
2. Resolves `config/files/{default,<env>}.yaml` and merges with SSM-referenced values.
3. Pushes the resolved blob to both stores.

Confirm success: each command should exit 0 and the trailing log lines should mention writing to KV and DynamoDB.

If either fails, common causes:
- `CLOUDFLARE_API_TOKEN` missing the `Workers KV Storage:Edit` permission.
- `aws s3api head-bucket` for the Terraform state bucket failed silently and Terraform can't acquire state lock.
- `PROJECT_NAME` contains characters disallowed by Cloudflare (must be DNS-safe lowercase kebab-case).

Halt and surface the error to the user — do not auto-retry.

## Step 4 — Extract & hardcode KV namespace IDs (staging + production)

Read `PROJECT_NAME` from `.env`:

```bash
PROJECT_NAME=$(grep '^PROJECT_NAME=' .env | cut -d= -f2)
```

List KV namespaces and grab both env IDs:

```bash
KV_LIST=$(npx wrangler kv namespace list 2>/dev/null)
STAGING_KV_ID=$(echo "$KV_LIST" | jq -r --arg t "${PROJECT_NAME}-staging-config" '.[] | select(.title == $t) | .id')
PRODUCTION_KV_ID=$(echo "$KV_LIST" | jq -r --arg t "${PROJECT_NAME}-production-config" '.[] | select(.title == $t) | .id')

if [ -z "$STAGING_KV_ID" ] || [ -z "$PRODUCTION_KV_ID" ]; then
  echo "ERROR: missing KV namespace — staging=$STAGING_KV_ID production=$PRODUCTION_KV_ID"
  exit 1
fi

echo "Staging    KV ID: $STAGING_KV_ID"
echo "Production KV ID: $PRODUCTION_KV_ID"
```

If either is empty, halt: both namespaces should have been created in Step 3.

Now rewrite both KV IDs in every relevant file. The placeholders are `<staging-kv-namespace-id>` and `<production-kv-namespace-id>`. The skill must also detect **stale hardcoded IDs** from a prior `/onboard` run (after a teardown, the namespace gets a new ID — the placeholder is gone but the previously-hardcoded value is now invalid).

For each env (`staging` then `production`), build the target file list. A file is relevant if it either:
- contains the placeholder for that env, OR
- contains an `"id": "..."` inside the env's block whose value differs from the freshly resolved ID.

For each env:

```bash
ENV=staging         # then production
TARGET_ID="$STAGING_KV_ID"   # then $PRODUCTION_KV_ID
PLACEHOLDER="<${ENV}-kv-namespace-id>"

FILES=$(grep -lE "${PLACEHOLDER}" \
  apps/*/wrangler.jsonc services/*/wrangler.jsonc \
  tools/generators/*/files/wrangler.jsonc__tmpl__ 2>/dev/null || true)

# Also catch stale hardcoded IDs by checking the env block's KV id field.
# (Implementer: for each wrangler.jsonc, parse the env.<env>.kv_namespaces[].id —
#  if it's a 32-hex string AND not equal to $TARGET_ID, add the file to the list.)
```

For each file in the union list, use the Edit tool to replace the KV `id` inside that env's block with `$TARGET_ID`. Do NOT use a global `sed` — multiple env blocks exist with different IDs, and the production block must not be touched when fixing staging (and vice versa). Read the file first, find the `"<env>"` block by name (in JSONC the order is preserved), then replace its `"id"` value.

After all edits, run:

```bash
git diff -- apps services tools/generators
```

Show the user the diff. If the diff is empty (nothing to update — both env IDs already correct everywhere), skip the confirmation. Otherwise:

- If `$AUTO` is `true`: print `Auto-accepting KV-ID diff` and continue without prompting.
- Otherwise ask:

  > "I'm about to commit these KV-ID changes (still on the `onboarding-and-setup` branch). Diff looks correct? [Y/n]"

  If they say no, revert with `git checkout -- apps services tools/generators` and halt for them to investigate.

Either way, do **not** commit yet — the commit happens in Step 8 with everything else.

## Step 5 — Static site (optional)

If `$AUTO` is `true`, skip this step automatically — generators are one-off, explicit operations and shouldn't run on every test-loop iteration. Print `Auto-skipping static site generation (ONBOARD_AUTO=true)` and continue to Step 6.

Otherwise, ask the user:

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

Read the root `.nxignore` for `services/*` entries. These are services that exist on disk but are **opt-in** — listed in `.nxignore` so Nx ignores them until the user enables them by removing the line.

```bash
SVCS=$(grep -E '^services/' .nxignore | sed 's|services/||')
echo "$SVCS"
```

If no services are listed, print "No opt-in services found in .nxignore. Skipping services step." and continue to Step 7.

**AUTO mode behavior:** if `$AUTO` is `true`, skip enabling any service listed in `.nxignore`. The whole point of `.nxignore` is that these services are opt-in — the user has to explicitly decide to turn them on, and the test loop should never make that decision for them. Print `Auto-skipping all opt-in services (ONBOARD_AUTO=true)` and continue to Step 7. Services NOT in `.nxignore` (i.e. already enabled or never gated) are untouched either way.

Otherwise (interactive mode), for each subdirectory listed:

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

### 8.1 — Remove teardown skills on real-fork runs

The `/teardown-onboarding` and `/teardown-auth-service` skills exist for the iteration loop on the test fork. On a real fork they're a footgun — a user could invoke them in their command palette and destroy their production-adjacent staging state by mistake.

Gate them on the unattended-mode flag in `.env`:

```bash
AUTO=$(grep -E '^ONBOARD_AUTO=' .env 2>/dev/null | cut -d= -f2-)
if [ "$AUTO" != "true" ]; then
  echo "Real-fork onboard: removing teardown skills from .claude/commands/"
  rm -f .claude/commands/teardown-onboarding.md .claude/commands/teardown-auth-service.md
else
  echo "Test-fork onboard (ONBOARD_AUTO=true): keeping teardown skills"
fi
```

The removals get committed in the same step as the rest of the onboarding changes, so a single commit takes a fresh fork to a clean, teardown-free state.

### 8.2 — Commit

```bash
git add -A
git commit -m "chore(onboard): apply onboarding configuration

KV namespace IDs hardcoded for staging + production, README
onboarding callout removed, services .nxignore updated by
per-service skills. Teardown skills removed on real-fork runs.

Generated by /onboard."
```

If `git commit` reports nothing to commit (all earlier changes were already committed by sub-skills), continue.

### 8.3 — Optional push

`$AUTO` was already evaluated in Step 8.1; reuse it here.

If `$AUTO` is `true`, skip the prompt and push automatically. Otherwise ask the user:

> "Push the `onboarding-and-setup` branch to origin and instruct me to open a PR to main? [Y/n]"

If yes (or `$AUTO=true`):

```bash
git push -u origin onboarding-and-setup
```

**If the push fails with `[rejected]` / `non-fast-forward`** — this happens on re-runs where remote `onboarding-and-setup` has diverged from local (each `/onboard` cycle rewrites the branch). Handle by mode:

- **`$AUTO` is `true`**: force-push with lease (preserves the safety check that no-one else pushed since you fetched):

  ```bash
  git push --force-with-lease origin onboarding-and-setup
  ```

- **Interactive mode**: ask the user:

  > "Push was rejected (remote `onboarding-and-setup` has diverged — typical on re-runs). Force-push with lease? [y/N]"

  If yes, run the `--force-with-lease` command above. If no, halt: the user needs to reconcile manually.

Then print the GitHub PR-create URL using `$REPO` (resolved earlier in Step 2.3 — if the shell session was reset between steps, re-derive it the same way):

```bash
echo "Open a PR: https://github.com/${REPO}/compare/main...onboarding-and-setup"
```

### 8.4 — Tail message

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
