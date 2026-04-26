# config

Centralised configuration system for the workspace. It has two responsibilities: defining config values for each environment, and deploying those values to the stores that apps read from at runtime.

## The big picture

Config goes through two phases:

1. **Define** — YAML files declare what each key's value is per environment
2. **Resolve & deploy** — secrets are fetched, everything is merged into one flat JSON blob, and that blob is pushed to DynamoDB (for Lambda apps) and Cloudflare KV (for Workers)

At runtime, apps never touch YAML or SSM — they just read the pre-resolved blob from whichever store is appropriate for their runtime.

---

## File format (`files/`)

Each YAML file defines config keys as `SCREAMING_SNAKE_CASE`. Values can be plain strings, numbers, booleans, or an `ssm:` reference pointing to an AWS SSM Parameter Store path:

```yaml
# files/default.yaml
DATABASE_URL: postgres://localhost:5432/mydb
API_KEY: ssm:/myapp/api-key        # fetched from SSM at deploy time
LOG_LEVEL: info
```

There are four files:

| File | Purpose |
|---|---|
| `default.yaml` | Base values, used by every environment |
| `local.yaml` | Overrides for local development |
| `staging.yaml` | Overrides for staging |
| `production.yaml` | Overrides for production |

The resolver deep-merges `default.yaml` with the environment overlay — the overlay wins on conflict. Keys that appear only in `default.yaml` are inherited by all environments.

---

## Resolver (`src/resolver.ts`)

The resolver is the core logic. Given an environment name and the path to the `files/` directory, it:

1. Reads `default.yaml`
2. Deep-merges the environment overlay on top (if it exists)
3. Walks the merged object and collects every value that starts with `ssm:` — the suffix is the SSM Parameter Store path
4. Fetches all collected SSM secrets in batched requests
5. Substitutes the `ssm:` placeholders with their resolved values
6. Returns a plain JSON object

Keys must be `SCREAMING_SNAKE_CASE` — the resolver throws if it encounters a key that doesn't conform. Values can be nested objects (also with `SCREAMING_SNAKE_CASE` keys), and `ssm:` resolution works at any depth.

---

## Deploy script (`src/deploy.ts`)

The deploy script pushes config to the running infrastructure. It:

1. Calls the resolver to get the fully-resolved config blob for the target environment
2. Serialises it to JSON
3. Writes it to **two** stores in parallel:
   - **DynamoDB** — table named `${PROJECT_NAME}-config-${environment}` — read by Lambda apps via `libs/config-loader`
   - **Cloudflare KV** — namespace named `${PROJECT_NAME}-config-${environment}` — read by Cloudflare Workers

This runs as part of `npx nx run config:deploy-config:staging/production`, which first runs `terraform apply` to ensure the stores exist, then calls this script.

---

## Local resolved file (`src/resolveToFile.ts`)

For local development there is no DynamoDB or KV — instead, generate a pre-resolved JSON file:

```bash
npx nx run config:resolve --args="--environment=local --outFile=files/local.resolved.json"
```

This calls the resolver with `local` as the environment and writes the result to a JSON file. `libs/config-loader` reads this file when `APP_ENV=local`.

---

## Infrastructure (`infra/`)

Terraform provisions the stores that config is deployed into:

- **DynamoDB table** — `${project_name}-config-${environment}` — a simple key-value table with a single item (`pk: "config"`) holding the entire resolved config as a JSON string in the `data` attribute
- **Cloudflare KV namespace** — `${project_name}-config-${environment}` — same JSON blob stored under the key `config`

Both staging and production have their own Terraform root modules in `infra/environments/`. The actual resource definitions live in `infra/services/` and are shared between environments.

---

## Nx targets

| Target | What it does |
|---|---|
| `config:resolve` | Resolve config for a given env and write to a local file |
| `config:deploy-config:staging` | `terraform apply` + resolve + push to DynamoDB & KV (staging) |
| `config:deploy-config:production` | Same for production |
| `config:test` | Run the Vitest test suite (YAML validity + resolver unit tests) |
| `config:build` | Bundle `deploy.ts` and `resolveToFile.ts` via esbuild |
