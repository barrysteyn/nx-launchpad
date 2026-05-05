# NxLaunchpad

[![NX](https://img.shields.io/badge/NX-143055?style=flat&logo=nx&logoColor=white)](https://nx.dev)
![Terraform](https://img.shields.io/badge/terraform-7B42BC?style=flat&logo=terraform&logoColor=white)
[![Cloudflare Wrangler](https://img.shields.io/badge/Wrangler-F38020?style=flat&logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/workers/wrangler/)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)


A production-ready Nx monorepo launchpad supporting Python (uv), Node.js (TypeScript), and React (Cloudflare Workers) apps — with generators, AWS Lambda infrastructure, and Claude Code skills included.

---

> [!IMPORTANT]
> ### One-Time Setup — Delete This Section When Done
>
> Complete each step below after forking this repo, then **delete this entire callout block** before your first real commit.
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
>
> - [ ] **Add to your root `.env` file** (copy from `.env.example`):
>   ```bash
>   PROJECT_NAME=your-project-name      # namespaces all AWS + Cloudflare resources — choose a short unique name
>   URL=example.com                     # Used as the A domain for the project
>   ENVIRONMENT=local                   # always local in .env — CI/CD sets this to staging/production automatically
>   AWS_PROFILE=your-aws-profile        # local dev only — selects the AWS credentials profile to use
>   AWS_REGION=us-east-1                # AWS region for DynamoDB, SSM, and Lambda
>   CLOUDFLARE_API_TOKEN=your-api-token
>   CLOUDFLARE_ACCOUNT_ID=your-account-id  # Cloudflare dashboard → right-hand sidebar
>   ```
>   `PROJECT_NAME` becomes a permanent prefix for all infra (`${project_name}-${environment}-${app_name}`). Nx targets derive `TF_VAR_project_name` from it automatically.
>
> - [ ] **Add to GitHub Secrets and Variables** (Settings → Secrets and variables → Actions):
>
>   | Name | Type |
>   |---|---|
>   | `AWS_ACCESS_KEY_ID` | Secret |
>   | `AWS_SECRET_ACCESS_KEY` | Secret |
>   | `CLOUDFLARE_API_TOKEN` | Secret |
>   | `CLOUDFLARE_ACCOUNT_ID` | Secret |
>   | `PROJECT_NAME` | Variable |
>   | `URL` | Variable |
>
>   `AWS_REGION` is hardcoded to `us-east-1` in the deploy workflow — no need to add it here.
>
> - [ ] **Deploy config to staging and production** — this runs Terraform to create the shared Cloudflare KV namespaces that every React + Cloudflare Worker app binds to for config:
>   ```bash
>   npx nx run config:deploy-config --configuration=staging
>   npx nx run config:deploy-config --configuration=production
>   ```
>   Complete the `.env` and GitHub Secrets steps above before running these. Each command applies Terraform (creating the KV namespace) and seeds it with your resolved config.
>
> - [ ] **Hardcode the KV namespace IDs** — after the deploys above succeed, run:
>   ```bash
>   npx wrangler kv namespace list
>   ```
>   Note the IDs for `${PROJECT_NAME}-staging-config` and `${PROJECT_NAME}-production-config`, then tell Claude Code:
>   ```
>   Please hardcode the Cloudflare KV namespace IDs into all wrangler.jsonc files and the
>   generator template. The staging ID is <staging-id> and the production ID is <production-id>.
>   ```
>   Claude will update every `wrangler.jsonc` in the monorepo and the generator template in one step.
>
> - [ ] **Enable branch protection on `main`** — in *Settings → Branches → Branch protection rules*, add a rule for `main` and enable **"Require branches to be up to date before merging"**. This ensures CI always runs against the latest `main` before a PR can merge, making the post-merge CI run unnecessary.
>
---

## Getting Started

### Prerequisites

This project supports Python (uv) and Node.js. On a clean checkout, the setup script handles everything automatically — including installing Node modules:

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

**Node modules:**

```bash
npm ci --legacy-peer-deps
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

## Deployments

The deploy workflow (`.github/workflows/deploy.yml`) detects affected projects and deploys only what changed.

### Automatic deploys

| Branch | Environment |
|---|---|
| `main` | staging |
| `production` | production |

### Manual deploys

Trigger from the **Actions** tab in GitHub. You will be prompted for an environment (`staging` or `production`) and an optional app name — leave blank to deploy all affected apps.

### Force-redeploying outside of CI

CI uses `nx affected`, which only deploys projects touched by recent changes. This is the right default — use it always.

There are three situations where you might need to bypass it and deploy manually:

- **After a dependency upgrade** — `affected` does not treat `package.json` changes as a trigger (by design), so a package bump won't auto-redeploy apps.
- **First deploy of a fresh repo** — no previous commit to diff against.
- **Recovering a broken environment** — staging is in a bad state and you want to force everything back to a known good state.

In those cases, deploy specific apps directly:

```bash
npx nx run <app-name>:deploy:staging
npx nx run <app-name>:deploy:production
```

Or redeploy everything at once (use sparingly):

```bash
npx nx run-many -t deploy --configuration=staging
```

---

## Shared Libraries

Reusable libraries live in `libs/` and are available to all apps in the monorepo.

| Library | Description | Docs |
|---|---|---|
| `libs/utils/` | Shared utilities (logger, etc.) for Node.js and Python | [libs/utils/README.md](libs/utils/README.md) |
| `config/` | Resolves YAML config + SSM secrets at deploy time and pushes to DynamoDB / Cloudflare KV | [config/README.md](config/README.md) |
| `libs/config-loader/` | Runtime config loader — reads the pre-resolved blob from DynamoDB (Lambda) or Cloudflare KV | [libs/config-loader/README.md](libs/config-loader/README.md) |
| `libs/auth/` | Auth helpers — browser auth client factory and Hono JWT middleware for workers | [services/auth/README.md](services/auth/README.md) |

---

## Services

Services live in `services/` — shared infrastructure that multiple apps depend on, as opposed to the standalone apps in `apps/`.

### Auth (`services/auth`)

Centralised authentication service built on [better-auth](https://better-auth.com), running as a Cloudflare Worker with a D1 database. It handles sign-up, login, magic links, JWT minting, API keys, and JWKS key discovery — so every other app in the monorepo can verify tokens without talking to this service on every request.

See [services/auth/README.md](services/auth/README.md) for full setup and deployment instructions.

**To wire up auth in a React + Cloudflare Worker app:**

1. Add `VITE_AUTH_URL` to the app's build configurations in `project.json`:

   ```bash
   VITE_AUTH_URL=https://auth.staging.your-domain.com  # staging / preview builds
   VITE_AUTH_URL=https://auth.your-domain.com          # production build
   ```

2. Create an auth client in the app:

   ```typescript
   // src/app/lib/auth-client.ts
   import { createBrowserAuthClient } from '@nx-launchpad/auth-browser';

   export const AUTH_URL = import.meta.env.VITE_AUTH_URL as string | undefined;
   export const authClient = createBrowserAuthClient(AUTH_URL);
   ```

3. Guard pages via `useSession()` in `__root.tsx` and protect API routes with `jwtMiddleware` in the worker.

For local development, point your app at staging auth by adding to `.env.local`:

```bash
VITE_AUTH_URL=https://auth.staging.your-domain.com
```

---

## Generating Apps

This workspace includes generators to scaffold new applications. All generators are available via the `@nx-launchpad/tools` package.

> [!TIP]
> Every generator has a matching Claude Code skill (e.g. `/generate-python-app`) that prompts for all options, runs the generator, verifies the scaffold, and runs all checks — no manual steps required.

---

### Python (uv)

Generates a Python application with uv, pytest, ruff, and optional AWS Lambda + API Gateway infrastructure.

```bash
npx nx generate @nx-launchpad/tools:python-app <app-name>
```

Or type `/generate-python-app` in Claude Code.

| Target | Description |
|---|---|
| `lint` / `format` | Lint and format with ruff |
| `test` | Run pytest |
| `build` | Export `requirements.txt` |
| `serve` | Run the app locally |
| `deploy:staging` / `deploy:production` | Terraform + deploy |

---

### Node.js (TypeScript)

Generates a Node.js/TypeScript app compiled to CommonJS, deployable as an AWS Lambda.

```bash
npx nx generate @nx-launchpad/tools:node-app <app-name>
```

Or type `/generate-node-app` in Claude Code.

| Target | Description |
|---|---|
| `lint` / `format` | Lint and format |
| `typecheck` | Type-check with tsc |
| `test` | Run Vitest |
| `build` | Compile TypeScript to `dist/` |
| `serve` | Build and run locally |
| `deploy:staging` / `deploy:production` | Terraform + deploy |

---

### React + Hono (Cloudflare Workers)

Generates a React + Vite + TanStack Router SPA with a Hono API backend, deployed together as a single Cloudflare Worker. Includes Tailwind CSS v4, Vitest, ESLint, Prettier, and preview / staging / production Cloudflare environments.

The app is split into two runtime environments:

- **`src/app/`** — React SPA running in the browser
- **`src/worker/`** — Hono API running in the Cloudflare Workers (workerd) runtime

During local development (`serve`), both run simultaneously via the `@cloudflare/vite-plugin` — React with full HMR, the Hono worker in the real workerd runtime. No second process needed.

```bash
npx nx generate @nx-launchpad/tools:react-cloudflare-app <app-name>
```

Or type `/generate-react-cloudflare-app` in Claude Code.

| Target | Description |
|---|---|
| `lint` / `format` | Lint and format |
| `typecheck` | Type-check both app and worker |
| `test` | Run Vitest |
| `build` | Vite build → `dist/client/` |
| `serve` | Start React HMR + Hono worker at `http://localhost:5173` |
| `deploy:preview` / `deploy:staging` / `deploy:production` | Deploy to Cloudflare Workers |
