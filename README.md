# NxLaunchpad

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

A production-ready Nx monorepo launchpad supporting Python (uv), Node.js (TypeScript), and React (Cloudflare Workers) apps — with generators, AWS Lambda infrastructure, and Claude Code skills included.

---

> [!IMPORTANT]
> ### One-Time Setup — Delete This Section When Done
>
> Complete each step below after forking this repo, then **delete everything between the `---` lines** before your first real commit.
>
> - [ ] **Install the [Cocogitto bot](https://github.com/cocogitto/cocogitto-bot) GitHub App** — enforces Conventional Commits on all PRs.
>
> - [ ] **Bootstrap Terraform remote state** — create an S3 bucket for Terraform state in your AWS account (one-time per account):
>   ```bash
>   aws s3api create-bucket --bucket your-bucket-name --region us-east-1
>   aws s3api put-bucket-versioning --bucket your-bucket-name \
>     --versioning-configuration Status=Enabled
>   ```
>   Versioning is required — it allows state recovery if something goes wrong.
>   Once created, update `libs/infra/backend.hcl` with your bucket name.

---

## Getting Started

### Prerequisites

This project supports Java (Maven), Python (uv), and Node.js. On a clean checkout, the setup script handles everything automatically:

```bash
bash scripts/setup.sh
```

Then open a new terminal to ensure all PATH changes take effect.

> [!NOTE]
> All commands below assume you are running from the **NX root folder**.

<details>
<summary>Manual setup steps</summary>

**Node.js** — install NVM and use the required version:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install 24.12.0
nvm alias default 24.12.0
```

**Python** — install uv (manages Python versions and virtual environments automatically):

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

**Java / Maven:**

```bash
brew install --cask temurin@21
brew install maven
```

**Node modules:**

```bash
npm ci
```

**VSCode extensions:**

```bash
cd .vscode && cat extensions.json | jq -r '.recommendations[]' | xargs -n 1 code --install-extension && cd ..
```

**Git config:**

```bash
git config --global pull.rebase true
git config user.name "Your Name"
git config user.email "your.name@project.com"
```

</details>

---

## Working with Dependencies

### Python

To add a dependency to a Python project, use `uv add` from the app directory:

```bash
cd apps/my-python-app
uv add <package>
```

This updates both `pyproject.toml` and `uv.lock` — commit both. The `requirements.txt` is generated automatically by the `build` target and is intentionally gitignored.

> For more on uv, see [uv is the best thing to happen to the Python ecosystem in a decade](https://emily.space/posts/251023-uv).

### Node.js

All Node/JS apps share dependencies via the root npm workspace. To add a dependency available to all apps:

```bash
npm install <package>           # runtime dep
npm install -D <package>        # dev dep
```

To add a dependency specific to one app:

```bash
npm install <package> -w apps/<name>
```

---

## Environment Variables

Nx loads `.env` files automatically for every task. Create a root-level `.env` for workspace-wide defaults and a `{projectRoot}/.env` for project-specific overrides.

| File | Committed | Purpose |
|---|---|---|
| `.env.example` | Yes | Template — copy to `.env` and fill in values |
| `.env` | No | Local defaults, shared across all projects |
| `.env.local` | No | Personal overrides (highest priority) |
| `{projectRoot}/.env` | No | Project-specific overrides |

See the [Nx docs](https://nx.dev/docs/guides/tips-n-tricks/define-environment-variables) for the full loading order.

---

## Generating Apps

This workspace includes generators to scaffold new applications with sensible defaults. All generators are available via the `@nx-launchpad/tools` package.

> [!TIP]
> Every generator has a matching Claude Code skill (e.g. `/generate-python-app`) that prompts for all options, runs the generator, verifies the scaffold, and runs all checks — no manual steps required.

---

### Python (uv)

Generates a Python application with uv, pytest, ruff, and optional AWS Lambda infrastructure (Terraform + API Gateway).

**Command line:**

```bash
npx nx generate @nx-launchpad/tools:python-app <app-name>
```

**Claude Code:** type `/generate-python-app`

**Prompts:**

| Prompt | Description | Default |
|---|---|---|
| Description | Short description of the app | — |
| Python version | Python version to use | `3.12.3` |
| Include infrastructure? | Whether to scaffold Terraform infra | `yes` |
| Infrastructure type | `lambda` or `ecs` | `lambda` |
| Include API Gateway? | Add HTTP API Gateway in front of Lambda | `yes` |

**Generated structure:**

```
apps/<app-name>/
  src/<app_name>/
    __init__.py
    main.py          # handler() for Lambda + main() for CLI
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
        (same as staging)
    services/
      main.tf
      variables.tf
```

**Available Nx targets:**

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

---

### Node.js (TypeScript)

Generates a Node.js/TypeScript CLI app compiled to CommonJS, deployable as an AWS Lambda.

**Command line:**

```bash
npx nx generate @nx-launchpad/tools:node-app <app-name>
```

**Claude Code:** type `/generate-node-app`

**Prompts:**

| Prompt | Description | Default |
|---|---|---|
| Description | Short description of the app | — |
| Include infrastructure? | Whether to scaffold Terraform infra | `yes` |
| Include API Gateway? | Add HTTP API Gateway in front of Lambda | `yes` |

**Generated structure:**

```
apps/<app-name>/
  src/
    main.ts          # handler() for Lambda + main() for CLI
  tests/
    main.test.ts
  tsconfig.json      # CJS target, types: ["node"]
  vitest.config.ts
  eslint.config.js
  package.json
  .node-version
  project.json
  infra/             # only if infrastructure was selected
    environments/
      staging/
        main.tf      # Lambda nodejs22.x (+ API Gateway if selected)
        backend.tf
        providers.tf
        variables.tf
      production/
        (same as staging)
    services/
      main.tf
      variables.tf
```

**Available Nx targets:**

| Target | Command | Description |
|---|---|---|
| `lint` | `npx nx run <app>:lint` | Lint with ESLint |
| `format` | `npx nx run <app>:format` | Check formatting with Prettier |
| `typecheck` | `npx nx run <app>:typecheck` | Type-check with tsc |
| `test` | `npx nx run <app>:test` | Run Vitest |
| `build` | `npx nx run <app>:build` | Compile TypeScript to `dist/` |
| `serve` | `npx nx run <app>:serve` | Build and run locally |
| `tf-init` | `npx nx run <app>:tf-init --configuration=staging` | Initialise Terraform backend |
| `tf-plan` | `npx nx run <app>:tf-plan --configuration=staging` | Plan Terraform changes |
| `tf-apply` | `npx nx run <app>:tf-apply --configuration=staging` | Apply Terraform changes |
| `deploy` | `npx nx run <app>:deploy --configuration=staging` | Init + plan + apply in one step |

---

### React (Cloudflare Workers)

Generates a React + Vite + TanStack Router SPA deployed on Cloudflare Workers as a static asset site. Includes Tailwind CSS v4, Vitest, ESLint, Prettier, and full preview/staging/production Cloudflare environments.

**Command line:**

```bash
npx nx generate @nx-launchpad/tools:react-cloudflare-app <app-name>
```

**Claude Code:** type `/generate-react-cloudflare-app`

**Prompts:**

| Prompt | Description | Default |
|---|---|---|
| Description | Short description of the app | — |
| Staging domain | Custom Cloudflare domain for staging (e.g. `staging.example.com`) | blank (skipped) |
| Production domain | Custom Cloudflare domain for production (e.g. `example.com`) | blank (skipped) |

**Generated structure:**

```
apps/<app-name>/
  src/
    main.tsx
    app/App.tsx
    router.tsx
    routes/__root.tsx      # RootLayout with NavBar
    routes/index.tsx       # HomePage
    routes/about.tsx       # AboutPage
    components/nav/NavBar.tsx
    providers/index.tsx
    services/api.ts
    types/api.ts
    styles/index.css       # imports shared Tailwind globals
  tests/
    App.test.tsx
    test-setup.ts
  index.html
  vite.config.ts
  wrangler.jsonc           # preview / staging / production CF environments
  tsconfig.json + tsconfig.app.json + tsconfig.node.json + tsconfig.test.json
  eslint.config.js
  package.json
  .node-version
  project.json
```

**Available Nx targets:**

| Target | Command | Description |
|---|---|---|
| `lint` | `npx nx run <app>:lint` | Lint with ESLint |
| `format` | `npx nx run <app>:format` | Check formatting with Prettier |
| `typecheck` | `npx nx run <app>:typecheck` | Type-check with tsc |
| `test` | `npx nx run <app>:test` | Run Vitest |
| `build` | `npx nx run <app>:build` | Vite build (staging mode by default) |
| `serve` | `npx nx run <app>:serve` | Run Vite dev server locally |
| `deploy` | `npx nx run <app>:deploy --configuration=staging` | Deploy to Cloudflare Workers |
