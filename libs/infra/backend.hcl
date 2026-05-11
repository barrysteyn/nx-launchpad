# Shared Terraform backend config (committed).
#
# The per-fork S3 bucket name lives in libs/infra/backend.local.hcl (gitignored)
# so a `git reset --hard upstream/main` doesn't wipe it. Every `terraform init`
# in this workspace must pass BOTH config files:
#
#   terraform init \
#     -backend-config=libs/infra/backend.hcl \
#     -backend-config=libs/infra/backend.local.hcl
#
# `/onboard` Step 2.5 creates backend.local.hcl automatically. If you set things
# up manually, copy libs/infra/backend.local.hcl.example to libs/infra/backend.local.hcl
# and fill in the bucket name.
region       = "us-east-1"
use_lockfile = true
encrypt      = true
