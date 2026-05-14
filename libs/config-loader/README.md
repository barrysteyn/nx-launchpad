# libs/config-loader

Loads resolved application configuration at runtime. Config is resolved and deployed separately (by the `config` project) — the loader simply reads the pre-resolved blob from the appropriate store.

Loaders are organised by language runtime — each language has its own folder with its own Nx project.

| Folder | Language | Nx project |
|---|---|---|
| `node/` | TypeScript / Node.js | `config-loader-node` |

---

## How it works

Config is a two-phase system:

**Phase 1 — resolve & deploy (build time):** The `config` project reads `config/files/default.yaml`, deep-merges the environment overlay (`config/files/{ENVIRONMENT}.yaml`), resolves any `ssm:` prefixed values from AWS SSM Parameter Store, and writes the result to DynamoDB and Cloudflare KV.

**Phase 2 — load (runtime):** The loader reads the pre-resolved config blob from the appropriate store:

- `local` — reads from `config/files/local.resolved.json` (generated locally via `npx nx run config:resolve`)
- `staging` / `production` — fetches from DynamoDB table `${PROJECT_NAME}-${environment}-config`

The resolved config is a plain object — no special types or wrappers.

---

## YAML config format

All keys must be `SCREAMING_SNAKE_CASE`. Values can be plain strings, numbers, booleans, or an `ssm:` reference (resolved at deploy time, not runtime):

```yaml
# config/files/default.yaml
DATABASE_URL: postgres://localhost:5432/mydb
LOG_LEVEL: info
API_KEY: ssm:/nx-launchpad/staging/myapp/api-key
```

```yaml
# config/files/production.yaml
DATABASE_URL: ssm:/nx-launchpad/production/myapp/db-url
LOG_LEVEL: warn
```

---

## Generating local resolved config

Before running locally, generate the resolved config file:

```bash
npx nx run config:resolve --args="--environment=local --outFile=config/files/local.resolved.json"
```

This reads `config/files/default.yaml` + `config/files/local.yaml`, resolves any `ssm:` values, and writes `config/files/local.resolved.json`. The loader reads this file when `ENVIRONMENT=local`.

---

## Deploying config to staging / production

```bash
npx nx run config:deploy-config:staging
npx nx run config:deploy-config:production
```

This runs `terraform apply` (to ensure the DynamoDB table and Cloudflare KV namespace exist), then resolves the config and writes it to both stores.

---

## Language implementations

- [Node.js](#config-loader--nodejs) — available now
- Python — coming soon

---

## Config Loader — Node.js

**Location:** `libs/config-loader/node/src/loader.ts`

#### Environment variables

| Variable | Required | Description |
|---|---|---|
| `ENVIRONMENT` | No | Environment to load (`local`, `staging`, `production`). Defaults to `local`. |
| `PROJECT_NAME` | Yes (non-local) | Used to construct the DynamoDB table name: `${PROJECT_NAME}-${environment}-config`. Injected automatically by the Lambda module. |

#### Usage

```typescript
import { loadConfig } from 'config-loader-node';

const config = await loadConfig();

console.log(config['DATABASE_URL']); // resolved value
```

The result is cached — call `loadConfig()` freely throughout your app without worrying about repeated DynamoDB fetches.

#### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `environment` | `string` | `ENVIRONMENT` env var or `'local'` | Which environment's config to load |
| `forceReload` | `boolean` | `false` | Bypass cache and re-fetch from the store |

#### Lambda usage

Call `loadConfig()` outside the handler so the result is cached across warm invocations:

```typescript
import { loadConfig } from 'config-loader-node';
import { flushLogger } from 'utils-node';

const configPromise = loadConfig();

export const handler = async (event: unknown) => {
  const config = await configPromise;

  // use config...

  await flushLogger();
};
```

#### Adding the config loader to a new app

1. Add the path alias to your app's `tsconfig.json`:

```json
{
  "paths": {
    "config-loader-node": ["../../libs/config-loader/node/src/index.ts"]
  }
}
```

2. Import and call:

```typescript
import { loadConfig } from 'config-loader-node';
```

3. For local development, generate the resolved config file first (see above). For deployed environments, `PROJECT_NAME` must be set and the config must have been deployed via `config:deploy-config`.
  