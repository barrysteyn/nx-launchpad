# Claude Code Instructions

## Git Commits

Always use [Conventional Commits](https://www.conventionalcommits.org/) format for all commit messages:

```
<type>(<optional scope>): <description>
```

Valid types:
- `feat` — a new feature
- `fix` — a bug fix
- `chore` — maintenance tasks (deps, config, tooling)
- `docs` — documentation changes only
- `refactor` — code change that neither fixes a bug nor adds a feature
- `test` — adding or updating tests
- `ci` — CI/CD pipeline changes
- `build` — changes to the build system or external dependencies
- `perf` — performance improvements
- `style` — formatting, whitespace (no logic change)

Examples:
- `feat(analyzer): add crawl depth configuration`
- `fix(api): handle null response from upstream`
- `chore: update nx and package dependencies`
- `docs: update README with setup instructions`

This is required for the GitHub PR checks to pass.

## Project CI Profile (`project.json` convention)

The CI pipeline (`.github/actions/nx-affected`) reads `metadata.ci.profile` from each project to determine what tooling to install. Every `project.json` must include this key.

```json
{
  "metadata": {
    "ci": {
      "profile": "<profile>"
    }
  }
}
```

Valid profiles:
- `default` — Node/TypeScript only (no extra tooling)
- `python-uv` — sets up Python 3.11 and uv
- `java-maven` — sets up Java 21 (Temurin) and Maven

If `metadata.ci.profile` is absent, the pipeline defaults to `"default"`. Always set it explicitly so the project's requirements are clear.

## Environment Configuration

### APP_ENV

`APP_ENV` is the universal environment variable that controls which config layer is active. Valid values: `local`, `staging`, `production`.

Set it in your root `.env` file:

```bash
APP_ENV=local
```

The config resolver (`libs/config-resolver`) loads `config/default.yaml` first, then deep-merges `config/{APP_ENV}.yaml` on top — environment values win on conflict.

In CI/CD, `APP_ENV` is set by the deploy pipeline to match the target environment.

## Generating Apps

Use the `@nx-launchpad/tools` generators to scaffold new applications. Never create app scaffolding by hand.

### Python (uv)

```bash
npx nx generate @nx-launchpad/tools:python-app <app-name>
```

Or use the `/generate-python-app` skill in Claude Code — it will prompt for all options and run the full generation and verification flow automatically.

The generator handles:
- Python app scaffold (`src/`, `tests/`, `pyproject.toml`, `.python-version`)
- `project.json` with all standard targets (`lint`, `format`, `test`, `build`, `serve`, and all `tf-*` / `deploy` targets if infra was selected)
- Lambda Terraform infra for staging and production (optional)
- API Gateway wired to the Lambda (optional)
- Runs `uv sync` automatically to generate `uv.lock`

After generating, commit `pyproject.toml` and `uv.lock`. Do not commit `requirements.txt` (it is gitignored).

### Node.js (TypeScript)

```bash
npx nx generate @nx-launchpad/tools:node-app <app-name>
```

Or use the `/generate-node-app` skill in Claude Code — it will prompt for all options, run the generator, verify the scaffold, and run lint/format/typecheck/test/build to confirm everything works — no manual steps required.

The generator handles:
- Node.js/TypeScript app scaffold (`src/main.ts`, `tests/main.test.ts`, `tsconfig.json`, `.node-version`)
- `project.json` with all standard targets (`lint`, `format`, `typecheck`, `test`, `build`, `serve`, and all `tf-*` / `deploy` targets if infra was selected)
- Lambda Terraform infra for staging and production (optional)
- API Gateway wired to the Lambda (optional)
- Runs `npm install --legacy-peer-deps` automatically to keep the lock file in sync

You will be prompted for:

| Prompt | Description | Default |
|---|---|---|
| Name | App name in kebab-case | — |
| Description | Short description of the app | — |
| Include infra | Include AWS Terraform infrastructure | yes |
| Include API Gateway | Include API Gateway in front of the Lambda | yes |

### Node.js App Structure

```
apps/<name>/
  src/
    main.ts               ← Lambda handler + main() entry point
  tests/
    main.test.ts
  tsconfig.json           ← CJS target ("module": "commonjs"), types: ["node"]
  vitest.config.ts
  eslint.config.js        ← CJS flat config (no "type": "module")
  package.json            ← workspace member; identity fields only (no "type" field)
  .node-version
  project.json
  infra/                  ← present if infra was selected
    services/
      main.tf             ← Lambda (nodejs22.x, handler: main.handler) + API Gateway
      variables.tf
    environments/
      staging/
      production/
```

Key details:
- **Runtime:** `nodejs22.x` Lambda
- **Handler:** `main.handler` — the compiled `dist/main.js` exports a named `handler` function
- **Build:** `npx tsc` compiles to `dist/`; the Lambda `source_path` points to `dist/`
- **Serve:** builds first (`dependsOn: ["build"]`), then runs `node dist/main.js`
- **No `"type": "module"`** in `package.json` — the app is CommonJS to match the compiled output
- **`@types/node`** is installed at the root workspace and referenced via `"types": ["node"]` in `tsconfig.json`

## Terraform Infra Structure

When infra is generated, it follows this layout:

```
infra/
  environments/
    staging/
      main.tf        ← calls ../../services with environment="staging", memory_size=128
      backend.tf     ← S3 state key (env-specific, do not move)
      providers.tf   ← AWS provider config
      variables.tf   ← aws_region variable
    production/
      main.tf        ← calls ../../services with environment="production", memory_size=256
      backend.tf
      providers.tf
      variables.tf
  services/
    main.tf          ← Lambda + API Gateway modules, parameterised by var.environment / var.memory_size
    variables.tf     ← declares environment, memory_size, timeout
```

- All service definitions (Lambda, API Gateway) live in `services/` — edit there, not in the environment directories.
- `environments/*/backend.tf`, `providers.tf`, and `variables.tf` are per-root-module Terraform boilerplate and must stay duplicated — this is the standard Terraform pattern.
- `title(var.environment)` is used for capitalised descriptions (e.g. `"My App - Staging"`).

### Useful Terraform targets

```bash
npx nx run <app>:tf-init-local       # init both envs without backend (for local validation)
npx nx run <app>:tf-validate         # validate both envs (runs tf-init-local first)
npx nx run <app>:tf-plan:staging     # plan staging
npx nx run <app>:deploy:staging      # init + plan + apply staging
```

## React (Vite + Tailwind) Apps

### Generating

```bash
npx nx generate @nx-launchpad/tools:react-cloudflare-app <app-name>
```

Or use the `/generate-react-cloudflare-app` skill in Claude Code — it will prompt for all options, run the generator, verify the scaffold, and run lint/format/typecheck/test/build to confirm everything works — no manual steps required.

You will be prompted for:

| Prompt | Description | Default |
|---|---|---|
| Description | Short description of the app | — |
| Staging domain | Custom domain for staging (e.g. `staging.example.com`) | blank (skipped) |
| Production domain | Custom domain for production (e.g. `example.com`) | blank (skipped) |

The generator creates the full scaffold and configures `wrangler.jsonc` with `preview`, `staging`, and `production` Cloudflare environments. Custom domains are optional — leave blank and add them to `wrangler.jsonc` later.

### Structure

```
apps/<name>/
  src/
    main.tsx
    app/App.tsx
    router.tsx
    routes/__root.tsx
    routes/index.tsx
    routes/about.tsx
    components/nav/NavBar.tsx
    components/shared/    ← placeholder
    hooks/                ← placeholder
    providers/index.tsx
    services/api.ts
    types/api.ts
    styles/index.css      ← @import tailwindcss via libs/styles/globals.css
    vite-env.d.ts
  tests/
    App.test.tsx
    test-setup.ts
  index.html
  vite.config.ts          ← Tailwind v4 Vite plugin + Vitest config
  wrangler.jsonc          ← CF Workers config; preview/staging/production envs
  tsconfig.json
  tsconfig.app.json
  tsconfig.node.json
  tsconfig.test.json
  eslint.config.js
  package.json            ← workspace member; identity fields only
  .node-version
  project.json
```

### Dependency management

All Node/JS apps are part of the root npm workspace (`apps/*` is listed in root `package.json` `workspaces`). Shared deps (React, Vite, Tailwind, testing libs, Wrangler, etc.) live in the root `package.json` and are available to all apps via workspace hoisting.

An app's `package.json` only needs identity fields by default:

```json
{
  "name": "<app-name>",
  "private": true,
  "version": "0.0.0",
  "type": "module"
}
```

To add a dep shared across all apps, add it to the root:

```bash
npm install <package>           # runtime dep
npm install -D <package>        # dev dep
```

To add a dep specific to one app (or to override a root version), add it to that app's `package.json` only:

```bash
npm install <package> -w apps/<name>
```

### Deployment (Cloudflare Workers)

Deploys use `wrangler` via the `deploy` Nx target:

```bash
npx nx run <name>:deploy:staging
npx nx run <name>:deploy:production
```

`wrangler deploy` requires the `CLOUDFLARE_API_TOKEN` environment variable to be set. In CI, add it as a repository secret. Locally, either export it in your shell or use `wrangler login` for interactive auth.

The `wrangler.jsonc` defines three environments — `preview` (with `preview_urls: true` for version-specific Cloudflare URLs), `staging`, and `production`.

## Python Dependencies

To add a dependency to a Python project, use `uv add` directly — do not create an Nx target for this:

```bash
cd apps/my-python-app
uv add <package>
```

Commit both `pyproject.toml` and `uv.lock`. The `requirements.txt` is generated by the `build` target (`uv export --no-dev --no-hashes --no-emit-project`) and is gitignored — never commit it.
