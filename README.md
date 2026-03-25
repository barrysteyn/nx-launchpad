# NxLaunchpad

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

# Getting Started
For supplementary reading regarding UV, see [uv is the best thing to happen to the Python ecosystem in a decade](https://emily.space/posts/251023-uv).

## DO THIS FIRST AFTER FORKING THIS REPO
### GitHub Plugins
Install [Cocogitto-bot](https://github.com/cocogitto/cocogitto-bot). This will ensure conventional commits

### Terraform State (One-time AWS Bootstrap)

Before running any Terraform commands, an S3 bucket for remote state must be manually created in AWS. This is a one-time step per AWS account.

```bash
aws s3api create-bucket --bucket your-bucket-name --region us-east-1
aws s3api put-bucket-versioning --bucket your-bucket-name \
  --versioning-configuration Status=Enabled
```

Versioning is required — it allows state recovery if something goes wrong.

Once created, update `libs/infra/backend.hcl` with the bucket name. This file is the single source of truth for remote state configuration across the entire monorepo.

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

## Python Dependencies

To add a dependency to a Python project, run `uv add` from the project root (where `pyproject.toml` lives):

```bash
cd apps/my-python-app
uv add <package>
```

This updates `pyproject.toml` and `uv.lock`. Both files must be committed. The `requirements.txt` is generated automatically by the `build` target and is intentionally gitignored.

## Environment Variables

Nx loads `.env` files automatically for every task. Create a root-level `.env` for workspace-wide defaults and a `{projectRoot}/.env` for project-specific overrides. Use `.env.local` for personal values that should never be committed.

| File | Committed | Purpose |
|---|---|---|
| `.env.example` | Yes | Template — copy to `.env` and fill in values |
| `.env` | No | Local defaults, shared across all projects |
| `.env.local` | No | Personal overrides (highest priority) |
| `{projectRoot}/.env` | No | Project-specific overrides |

See the [Nx docs](https://nx.dev/docs/guides/tips-n-tricks/define-environment-variables) for the full loading order.


# Generating Apps

This workspace includes generators to scaffold new applications with sensible defaults. All generators are available via the `@nx-launchpad/tools` package.

## Python (uv)

Generates a Python application with uv, pytest, ruff, and optional AWS Lambda infrastructure (Terraform + API Gateway).

### Via command line

```bash
npx nx generate @nx-launchpad/tools:python-app <app-name>
```

### Via Claude Code

Type `/generate-python-app` in Claude Code. Claude will prompt you for all options, run the generator, verify the scaffold, and run lint/format/test/build to confirm everything works — no manual steps required.

You will be prompted for:

| Prompt | Description | Default |
|---|---|---|
| Description | Short description of the app | — |
| Python version | Python version to use | `3.12.3` |
| Include infrastructure? | Whether to scaffold Terraform infra | `yes` |
| Infrastructure type | `lambda` or `ecs` | `lambda` |
| Include API Gateway? | Add HTTP API Gateway in front of Lambda | `yes` |

The generator creates:

```
apps/<app-name>/
  src/<app_name>/
    __init__.py
    main.py          # includes handler() for Lambda and main() for CLI
  tests/
    __init__.py
    test_main.py
  pyproject.toml
  .python-version
  uv.lock            # generated automatically by uv sync
  infra/             # only if infrastructure was selected
    environments/
      staging/
        main.tf      # Lambda (+ API Gateway if selected)
        backend.tf
        providers.tf
        variables.tf
      production/
        (same)
```

After generation, the following Nx targets are available:

| Target | Command | Description |
|---|---|---|
| `lint` | `npx nx run <app>:lint` | Lint with ruff |
| `format` | `npx nx run <app>:format` | Check formatting with ruff |
| `test` | `npx nx run <app>:test` | Run pytest |
| `build` | `npx nx run <app>:build` | Export `requirements.txt` |
| `serve` | `npx nx run <app>:serve` | Run the app locally |
| `tf-init` | `npx nx run <app>:tf-init --configuration=staging` | Initialise Terraform backend |
| `tf-plan` | `npx nx run <app>:tf-plan --configuration=staging` | Plan Terraform changes |
| `tf-apply` | `npx nx run <app>:tf-apply --configuration=staging` | Apply Terraform changes |
| `deploy` | `npx nx run <app>:deploy --configuration=staging` | Init + plan + apply in one step |