# Terraform backend config. Passed to every `terraform init` in this workspace
# via `-backend-config=libs/infra/backend.hcl`.
#
# The bucket below ships as `<placeholder-bucket>`; `/onboard` Step 2.5 replaces
# it with the fork's real bucket name. This file is protected from upstream
# overwrites by a `merge=ours` rule in .gitattributes — do not accept upstream
# changes to this file on merge.
region       = "us-east-1"
use_lockfile = true
encrypt      = true
bucket       = "<placeholder-bucket>"
