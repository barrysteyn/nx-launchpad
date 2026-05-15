# Testing the onboarding skills

This document is for project maintainers who want to verify `/onboard`, `/dev-onboard`, and `/teardown-onboarding` end-to-end on a real (test) GitHub fork.

The test loop uses a permanent test repo that tracks `nx-launchpad` as `upstream` and is reset between runs via `/teardown-onboarding` + `git reset --hard upstream/main`.

## Phase A — Initial test repo setup (one-time)

Done **once** when the test repo is first created. Subsequent test runs reuse this repo.

```bash
# 1. Create a private test repo on GitHub
gh repo create my-launchpad-test --private --clone
cd my-launchpad-test

# 2. Add nx-launchpad as upstream and pull its main
git remote add upstream <nx-launchpad URL>
git fetch upstream
git reset --hard upstream/main
git push -u origin main

# 3. Configure the test fork
#    - Add Secrets: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
#    - Add Variables: PROJECT_NAME, URL
#    - Subscribe to the Cocogitto bot: https://github.com/apps/cocogitto-bot
#    - (Optional) enable branch protection on main

# 4. Choose a unique test PROJECT_NAME (e.g. "test-launchpad-bs")
#    Set it both in .env and as a GitHub Variable.

# 5. Bootstrap a Terraform state bucket for the test fork
aws s3api create-bucket --bucket terraform-state-<your-test-name>-<random> --region us-east-1
aws s3api put-bucket-versioning --bucket terraform-state-<your-test-name>-<random> \
  --versioning-configuration Status=Enabled

# Update the bucket line in libs/infra/backend.hcl with your new bucket name.
# `/onboard` Step 2.5 does this automatically (replacing the <placeholder-bucket>);
# to do it manually:
#   sed -i.bak -E 's|<placeholder-bucket>|terraform-state-<your-test-name>-<random>|' libs/infra/backend.hcl && rm libs/infra/backend.hcl.bak
```

That's Phase A. Don't repeat any of this between test runs.

## Phase B — Each test run

```bash
# 1. Wipe staging cloud resources from the previous run
/teardown-onboarding

# 2. Reset all file changes back to upstream main
git fetch upstream
git reset --hard upstream/main
git push --force origin main

# 3. Run onboarding fresh
/onboard

# 4. Manually verify
#    - Cloudflare KV namespace exists: npx wrangler kv namespace list
#      → ${PROJECT_NAME}-staging-config should be present
#    - If you opted into the static site:
#        Visit the staging URL printed by /onboard. Page should load.
#    - If you opted into auth:
#        curl https://auth.staging.${URL}/api/auth/get-session
#        → {"session":null,"user":null}
#        curl https://auth.staging.${URL}/api/auth/.well-known/jwks.json
#        → JSON with a "keys" array
#    - GitHub Actions: trigger a manual deploy (Actions tab → Deploy
#      workflow → environment=staging) and verify it completes green.
```

## Common reset gotchas

- After `git reset --hard upstream/main`, the repo's local `.env` survives (it's gitignored), so `PROJECT_NAME` and other values from your previous test run are still there. That's intended — `.env` is part of Phase A configuration.
- `/teardown-onboarding` does **not** delete the S3 bucket. `terraform destroy` removes the state file inside it; the bucket itself survives so the next `/onboard` can reuse it.
- `/teardown-onboarding` does **not** clear GitHub Secrets or branch protection. Those are part of Phase A.
- If a test run fails partway through, run `/teardown-onboarding` to clean up before resetting and retrying. Otherwise stale Cloudflare/AWS resources will conflict with the next `terraform apply`.

## When to bump upstream

Whenever you push a change to `nx-launchpad/main` that touches the onboarding skills, the script, or any of the verify checks, run a Phase B test loop on the test repo before considering the change shipped.
