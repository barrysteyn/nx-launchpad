Tear down the auth service for a given environment. This deletes the Cloudflare Worker, destroys the Neon Postgres project and Cloudflare Hyperdrive config, and resets the repo back to a state where `/setup-auth-service` can be run again from scratch.

> [!WARNING]
> This is **irreversible**. All user accounts, sessions, and API keys in the target database will be permanently deleted.

## Step 1 — Confirm environment and intent

Ask the user: "Which environment are you tearing down — staging or production?"

Use their answer as `<env>` throughout the remaining steps.

Then ask: "Are you sure? This will permanently delete all data in the `<env>` auth database and remove the deployed worker."

Do not proceed unless the user explicitly confirms.

## Step 2 — Delete the Cloudflare Worker

```
(cd services/auth && npx wrangler delete -e <env>)
```

When prompted to confirm deletion, enter `y`. This removes the Worker from Cloudflare but leaves the infrastructure (Neon project + Hyperdrive) intact.

## Step 3 — Destroy Terraform infrastructure

The Neon project module has `prevent_destroy = true` as a safety guard. You must temporarily disable it before running `tf-destroy`, then restore it afterwards.

**3a.** In `libs/infra/modules/neon/postgres/main.tf`, change the `lifecycle` block on `neon_project.this` from `prevent_destroy = true` to `prevent_destroy = false`:

```hcl
resource "neon_project" "this" {
  # ... other args ...
  lifecycle {
    prevent_destroy = false
  }
}
```

**3b.** Run the destroy:

```
npx nx run auth:tf-destroy:<env>
```

This destroys the Neon project (and everything inside it — branches, databases, roles) and the Cloudflare Hyperdrive config in one shot.

**3c.** Restore `prevent_destroy` to `true` in `libs/infra/modules/neon/postgres/main.tf`:

```hcl
resource "neon_project" "this" {
  # ... other args ...
  lifecycle {
    prevent_destroy = true
  }
}
```

## Step 4 — Reset wrangler.jsonc

Open `services/auth/wrangler.jsonc` and reset the `<env>` block's `hyperdrive` entry back to its placeholder value:

```jsonc
"<env>": {
  "hyperdrive": [
    {
      "binding": "HYPERDRIVE",
      "id": "<placeholder-hyperdrive-id>"
    }
  ]
}
```

## Step 5 — Add auth back to .nxignore

Add `services/auth` to `.nxignore` so Nx stops including it in affected runs:

```
services/auth
```

## Step 6 — Confirm teardown is complete

Tell the user the teardown is complete and that they can re-provision from scratch by running `/setup-auth-service`.
