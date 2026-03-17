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

## Generating Apps

Use the `@nx-launchpad/tools` generators to scaffold new applications. Never create app scaffolding by hand.

### Python (uv)

```bash
npx nx generate @nx-launchpad/tools:python-app <app-name>
```

The generator handles:
- Python app scaffold (`src/`, `tests/`, `pyproject.toml`, `.python-version`)
- `project.json` with all standard targets (`lint`, `format`, `test`, `build`, `serve`, and all `tf-*` / `deploy` targets if infra was selected)
- Lambda Terraform infra for staging and production (optional)
- API Gateway wired to the Lambda (optional)
- Runs `uv sync` automatically to generate `uv.lock`

After generating, commit `pyproject.toml` and `uv.lock`. Do not commit `requirements.txt` (it is gitignored).

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

There is no generator yet — scaffold manually following `apps/example-react-webapp` as the reference.

### Structure

```
apps/<name>/
  src/
    main.tsx
    App.tsx
    App.test.tsx
    test-setup.ts
    index.css          ← @import 'tailwindcss'
  index.html
  vite.config.ts       ← includes Tailwind v4 Vite plugin + Vitest config
  tsconfig.json        ← references tsconfig.app.json + tsconfig.node.json
  tsconfig.app.json
  tsconfig.node.json
  wrangler.toml        ← CF Workers config; staging is the default env
  eslint.config.js
  package.json         ← workspace member; only name/version/type needed by default
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

The `wrangler.toml` defines both environments — staging is the default (no `--env` flag), production uses `--env production`.

## Python Dependencies

To add a dependency to a Python project, use `uv add` directly — do not create an Nx target for this:

```bash
cd apps/my-python-app
uv add <package>
```

Commit both `pyproject.toml` and `uv.lock`. The `requirements.txt` is generated by the `build` target (`uv export --no-dev --no-hashes --no-emit-project`) and is gitignored — never commit it.
