# NxLaunchpad

[![NX](https://img.shields.io/badge/NX-143055?style=flat&logo=nx&logoColor=white)](https://nx.dev)
![Terraform](https://img.shields.io/badge/terraform-7B42BC?style=flat&logo=terraform&logoColor=white)
[![AWS](https://img.shields.io/badge/AWS-FF9900?style=flat&logo=amazonwebservices&logoColor=white)](https://aws.amazon.com/)
[![Cloudflare Wrangler](https://img.shields.io/badge/Wrangler-F38020?style=flat&logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/workers/wrangler/)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)


A production-ready [Nx](https://nx.dev) monorepo launchpad — fork it once, customise it, and ship apps to AWS Lambda or Cloudflare Workers without writing any of the infrastructure or CI plumbing yourself.

**Naming convention (strict):** every cloud resource is named `${project_name}-${environment}-${app_name}`. `PROJECT_NAME` is set once in `.env` and as a GitHub Actions Variable; everything else (Terraform modules, generator templates, the `/onboard` skill) reads from there. See [CLAUDE.md](CLAUDE.md) for the full rules.

---

> [!IMPORTANT]
> ### One-Time Setup — Delete This Section When Done
>
> **Recommended (macOS only):** run `/onboard` in Claude Code from the repo root. The skill installs dev tooling, verifies prerequisites, deploys staging config, optionally generates a static site, and offers to enable services. If you're a contributor joining an already-onboarded fork, run `/dev-onboard` instead — it only sets up the local dev environment (tooling install + git config + husky).
>
> Without Claude Code, complete each step below after forking this repo, then **delete this entire callout block** before your first real commit.
>
> - [ ] **Bootstrap dev tooling**: `bash scripts/setup.sh` (set `INSTALL_JAVA=true` if you need Java)
>
> - [ ] **Install the [Cocogitto bot](https://github.com/cocogitto/cocogitto-bot) GitHub App** — enforces Conventional Commits on all PRs.
>
> - [ ] **Bootstrap Terraform remote state** — create an S3 bucket for Terraform state in your AWS account (one-time per account):
>   ```bash
>   aws s3api create-bucket --bucket your-bucket-name --region us-east-1
>   aws s3api put-bucket-versioning --bucket your-bucket-name \
>     --versioning-configuration Status=Enabled
>   ```
>   Replace the `<placeholder-bucket>` value in `libs/infra/backend.hcl` with your new bucket name. The file is committed but protected from upstream overwrites by a `merge=ours` rule in `.gitattributes` (registered automatically by `scripts/setup.sh`). `/onboard` Step 2.5 handles this automatically.
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
>   Your Cloudflare API token needs Account-scoped permissions: `Workers Scripts: Edit`, `Workers KV Storage: Edit`, and `D1: Edit` (the last only if you opt into auth). Add Zone-scoped `Workers Routes: Edit` and `DNS: Edit` only if using custom domains.
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
> - [ ] **Deploy config to staging and production** — this runs Terraform to create the shared Cloudflare KV namespaces and DynamoDB tables that every app binds to for config:
>   ```bash
>   npx nx run config:deploy-config:staging
>   npx nx run config:deploy-config:production
>   ```
>   Complete the `.env` and GitHub Secrets steps above before running these. Each command applies Terraform (creating the KV namespace + DynamoDB table) and seeds it with your resolved config.
>
> - [ ] **Hardcode the KV namespace IDs** — after the deploys above succeed, run:
>   ```bash
>   npx wrangler kv namespace list
>   ```
>   Note the IDs for `${PROJECT_NAME}-staging-config` and `${PROJECT_NAME}-production-config`, then update the `env.staging.kv_namespaces[0].id` and `env.production.kv_namespaces[0].id` fields in every `wrangler.jsonc` (apps, services, and the generator templates under `tools/generators/*/files/wrangler.jsonc__tmpl__`).
>
> - [ ] **Set up repo-local git config**:
>   ```bash
>   git config pull.rebase true
>   git config push.autoSetupRemote true
>   git config user.name "Your Name"
>   git config user.email "you@example.com"
>   ```
>
> - [ ] **(Optional) Enable branch protection on `main`** — in *Settings → Branches → Branch protection rules*, add a rule for `main` and enable **"Require branches to be up to date before merging"**. Requires a paid GitHub plan for private repos.

---

## Quick Start

**Generate an app:**

```
/generate-astro-cloudflare-app    # static Astro site (Cloudflare Workers static assets)
/generate-react-cloudflare-app    # React + Hono SPA + API on Cloudflare Workers
/generate-node-app                # Node.js/TypeScript AWS Lambda
/generate-python-app              # Python (uv) AWS Lambda
```

Each skill prompts for an app name and (where relevant) a description and custom domains, then runs the underlying generator and verifies the scaffold with lint/typecheck/test/build.

**Enable a service** (lives in `services/`, opt-in via `.nxignore`):

```
/setup-auth-service               # authentication (better-auth on Cloudflare D1)
```

**Add your own logic** to a generated app and commit. CI deploys affected projects automatically — push to `main` for staging, push to `production` for production. See [Deployments.md](Deployments.md) for the full deploy pipeline, manual triggers, and force-redeploy scenarios.

**Re-run onboarding any time:** `/onboard` is idempotent. Use it to enable additional services or to sync `.env` changes to GitHub Secrets and Variables.

---

## Generating Apps

This workspace includes generators to scaffold new applications. All generators are available via the `tools` package.

> [!TIP]
> Every generator has a matching Claude Code skill (e.g. `/generate-python-app`) that prompts for all options, runs the generator, verifies the scaffold, and runs all checks — no manual steps required.

---

### Python (uv)

Generates a Python application with uv, pytest, ruff, and optional AWS Lambda + API Gateway infrastructure.

```bash
npx nx generate tools:python-app <app-name>
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
npx nx generate tools:node-app <app-name>
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
npx nx generate tools:react-cloudflare-app <app-name>
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

---

### Astro Static Site (Cloudflare Workers Static Assets)

Generates a purely static Astro site deployed to Cloudflare via Workers Static Assets. Includes React components (`@astrojs/react`), Tailwind CSS v4, Vitest, ESLint, Prettier, and preview / staging / production Cloudflare environments. No server-side runtime — every page is pre-rendered to static HTML at build time.

> [!IMPORTANT]
> **Prerequisite:** set `URL=your-domain.com` in your root `.env` file before generating. The generator derives `staging.your-domain.com` and `your-domain.com` from this value automatically.

```bash
npx nx generate tools:astro-cloudflare-app <app-name>
```

Or type `/generate-astro-cloudflare-app` in Claude Code.

| Target | Description |
|---|---|
| `lint` / `format` | Lint and format |
| `typecheck` | Type-check with `astro check` + `tsc --noEmit` |
| `test` | Run Vitest |
| `build` | Astro build → `dist/` (static HTML/CSS/JS) |
| `serve` | Start Astro dev server with HMR at `http://localhost:4321` |
| `deploy:preview` | Deploy to a unique `workers.dev` preview URL; prints `PREVIEW_URL` |
| `deploy:staging` | Deploy to `staging.your-domain.com` |
| `deploy:production` | Deploy to `your-domain.com` |

**Local development:**

```bash
npx nx run <app-name>:serve
```

**Deploying** (requires `CLOUDFLARE_API_TOKEN`):

```bash
npx nx run <app-name>:deploy:preview     # prints PREVIEW_URL after deploy
npx nx run <app-name>:deploy:staging
npx nx run <app-name>:deploy:production
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

Services live in `services/` — shared infrastructure that multiple apps depend on, as opposed to the standalone apps in `apps/`. They are **opt-in**: each one is listed in `.nxignore` by default, and the matching `/setup-<svc>` skill removes the entry when you provision it.

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
   import { createBrowserAuthClient } from 'auth-browser';

   export const AUTH_URL = import.meta.env.VITE_AUTH_URL as string | undefined;
   export const authClient = createBrowserAuthClient(AUTH_URL);
   ```

3. Guard pages via `useSession()` in `__root.tsx` and protect API routes with `jwtMiddleware` in the worker.

For local development, point your app at staging auth by adding to `.env.local`:

```bash
VITE_AUTH_URL=https://auth.staging.your-domain.com
```

---

## Deployments

CI/CD via GitHub Actions handles deploys automatically based on the branch and what's affected. See **[DEPLOYMENTS](docs/DEPLOYMENTS.md)** for the full pipeline, manual triggers, and force-redeploy scenarios.
