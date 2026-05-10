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

#### AWS auth — choose form (ask in chat)

Ask:

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

If `.env` still has `CLOUDFLARE_API_TOKEN=your-api-token`, first remind the user of required permissions:

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

If `.env` still has `CLOUDFLARE_ACCOUNT_ID=your-account-id`:

> "Open `.env` in your editor. Replace `CLOUDFLARE_ACCOUNT_ID=your-account-id` with your Cloudflare Account ID.
>
> Find it at: Cloudflare dashboard → right sidebar → Account ID (click to copy).
>
> Save and close. Press Enter here when done."

Verify like `CLOUDFLARE_API_TOKEN` above.

### 2.3 — Mirror non-sensitive values to GitHub Variables

`PROJECT_NAME` and `URL` are needed in CI as `vars.PROJECT_NAME` and `vars.URL`. Mirror them automatically:

```bash
for v in PROJECT_NAME URL; do
  value=$(grep "^${v}=" .env | cut -d= -f2-)
  current=$(gh variable list --json name,value --jq ".[] | select(.name == \"${v}\") | .value")
  if [ "$current" = "$value" ]; then
    echo "GitHub Variable ${v} already up-to-date"
  else
    gh variable set "${v}" --body "$value"
    echo "Set GitHub Variable: ${v}"
  fi
done
```

### 2.4 — Mirror sensitive values to GitHub Secrets

Cloudflare values are already in `.env`. Mirror them to GitHub Secrets — Claude only sees the command template (`$(grep ...)`), never the resolved value:

```bash
gh secret set CLOUDFLARE_API_TOKEN --body "$(grep '^CLOUDFLARE_API_TOKEN=' .env | cut -d= -f2-)"
gh secret set CLOUDFLARE_ACCOUNT_ID --body "$(grep '^CLOUDFLARE_ACCOUNT_ID=' .env | cut -d= -f2-)"
```

**For AWS access keys, branch on the form chosen in Step 2.2:**

If the user chose **(b) raw keys** (so `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` are in `.env`), mirror automatically:

```bash
gh secret set AWS_ACCESS_KEY_ID --body "$(grep '^AWS_ACCESS_KEY_ID=' .env | cut -d= -f2-)"
gh secret set AWS_SECRET_ACCESS_KEY --body "$(grep '^AWS_SECRET_ACCESS_KEY=' .env | cut -d= -f2-)"
```

If the user chose **(a) AWS_PROFILE**, the access keys aren't in `.env`. Tell them:

> "You're using `AWS_PROFILE` locally, so CI still needs raw access keys set manually as GitHub Secrets. Run these in your own terminal — each prompts for the value privately (it won't be echoed to terminal or this chat):
>
>     gh secret set AWS_ACCESS_KEY_ID
>     gh secret set AWS_SECRET_ACCESS_KEY
>
> Press Enter here when done."

After they confirm, verify both secrets exist:

```bash
count=$(gh secret list --json name --jq '.[].name' | grep -cE '^(AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY)$')
[ "$count" = "2" ]
```

If the count is not 2, halt with: "AWS access key secrets still missing from GitHub. Set them and re-run `/onboard`."

### 2.5 — Terraform state bucket (create-if-missing)

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
