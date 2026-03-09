# NxLaunchpad

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

# Getting Started
For supplementary reading regarding UV, see [uv is the best thing to happen to the Python ecosystem in a decade](https://emily.space/posts/251023-uv).

## Prerequisites

This project supports Java (Maven), Python (uv) and Node.js.

**On a clean checkout, run the setup script — it handles everything automatically:**
```bash
bash scripts/setup.sh
```
Then open a new terminal to ensure all PATH changes take effect.

<details>
<summary>Manual setup steps</summary>

Install NVM (node version manager) if not installed.
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```
Set use `24.12.0` and alias it to default.
```bash
nvm install 24.12.0
nvm alias default 24.12.0
```

Install uv (manages Python versions and virtual environments):
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```
uv will automatically install and use the correct Python version per project.

Install Maven:
```bash
brew install maven
```

Install Java 21 (Temurin):
```bash
brew install --cask temurin@21
```

**==> 🚀🚀🚀 All the rest of the instructions assume you are in the NX root folder. <==**

Install node modules:
```bash
npm ci
```

Install needed VSCode extensions:
```bash
cd .vscode && cat extensions.json | jq -r '.recommendations[]' | xargs -n 1 code --install-extension && cd ..
```

Set git config:
```bash
git config --global pull.rebase true
git config user.name "Your Name"
git config user.email "your.name@project.com"
```

</details>

## Terraform State (One-time AWS Bootstrap)

Before running any Terraform commands, an S3 bucket for remote state must be manually created in AWS. This is a one-time step per AWS account.

```bash
aws s3api create-bucket --bucket your-bucket-name --region us-east-1
aws s3api put-bucket-versioning --bucket your-bucket-name \
  --versioning-configuration Status=Enabled
```

Versioning is required — it allows state recovery if something goes wrong.

Once created, update `libs/infra/backend.hcl` with the bucket name. This file is the single source of truth for remote state configuration across the entire monorepo.

## Environment Variables

Nx loads `.env` files automatically for every task. Create a root-level `.env` for workspace-wide defaults and a `{projectRoot}/.env` for project-specific overrides. Use `.env.local` for personal values that should never be committed.

| File | Committed | Purpose |
|---|---|---|
| `.env.example` | Yes | Template — copy to `.env` and fill in values |
| `.env` | No | Local defaults, shared across all projects |
| `.env.local` | No | Personal overrides (highest priority) |
| `{projectRoot}/.env` | No | Project-specific overrides |

See the [Nx docs](https://nx.dev/docs/guides/tips-n-tricks/define-environment-variables) for the full loading order.