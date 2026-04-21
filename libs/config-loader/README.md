# libs/config-resolver

Loads and resolves application configuration from the workspace `config/` YAML files. Handles environment-specific overrides and transparently resolves secrets stored in AWS SSM Parameter Store — app code reads a plain object with no knowledge of where values came from.

Resolvers are organised by language runtime — each language has its own folder with its own Nx project.

| Folder | Language | Nx project |
|---|---|---|
| `node/` | TypeScript / Node.js | `config-resolver-node` |

---

## How it works

1. Loads `config/default.yaml` as the base
2. Deep-merges `config/{APP_ENV}.yaml` on top — environment values win on conflict
3. Walks the merged config and collects any values prefixed with `ssm:` — these are SSM Parameter Store paths
4. Fetches all SSM secrets in batched requests (max 10 per call)
5. Substitutes the `ssm:` placeholders with the resolved values
6. Caches the result per environment — subsequent calls are instant

The resolved config is a plain object — no special types or wrappers.

---

## YAML config format

All keys must be `SCREAMING_SNAKE_CASE`. Values can be plain strings, numbers, booleans, or an `ssm:` reference:

```yaml
# config/default.yaml
DATABASE_URL: postgres://localhost:5432/mydb
LOG_LEVEL: info
API_KEY: ssm:/myapp/api-key          # resolved from SSM at load time
```

```yaml
# config/production.yaml
DATABASE_URL: ssm:/myapp/prod/db-url  # overrides default with SSM value
LOG_LEVEL: warn
```

The `ssm:` prefix is stripped and the remainder is treated as the SSM Parameter Store path. The key name is preserved in the resolved config.

---

## Language implementations

- [Node.js](#config-resolver--nodejs) — available now
- Python — coming soon

---

## Config Resolver — Node.js

**Location:** `libs/config-resolver/node/src/config.ts`

#### Environment variables

| Variable | Required | Description |
|---|---|---|
| `APP_ENV` | No | Environment to load (`local`, `staging`, `production`). Defaults to `local`. |
| `AWS_REGION` | No | AWS region for SSM. Defaults to `us-east-1`. |
| `AWS_ACCESS_KEY_ID` | No* | AWS credentials. Not required if using instance/role credentials. |
| `AWS_SECRET_ACCESS_KEY` | No* | AWS credentials. Not required if using instance/role credentials. |

\* Not required locally if no `ssm:` values are present in the config.

#### Usage

```typescript
import { loadConfig } from '@nx-launchpad/config-resolver-node';

const config = await loadConfig();

console.log(config['DATABASE_URL']); // resolved value
```

The result is cached — call `loadConfig()` freely throughout your app without worrying about repeated SSM fetches.

#### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `environment` | `string` | `APP_ENV` env var or `'local'` | Which environment overlay to load |
| `configDir` | `string` | `{cwd}/config` | Path to the folder containing the YAML files |
| `credentials` | `AwsCredentialIdentity` | env vars / instance role | Explicit AWS credentials (useful for testing) |
| `forceReload` | `boolean` | `false` | Bypass cache and re-fetch everything including SSM secrets |

#### Lambda usage

Call `loadConfig()` outside the handler so the result is cached across warm invocations:

```typescript
import { loadConfig } from '@nx-launchpad/config-resolver-node';
import { flushLogger } from '@nx-launchpad/utils-node';

const configPromise = loadConfig();

export const handler = async (event: unknown) => {
  const config = await configPromise;

  // use config...

  await flushLogger();
};
```

#### Adding the config resolver to a new app

1. Add the path alias to your app's `tsconfig.json`:

```json
{
  "paths": {
    "@nx-launchpad/config-resolver-node": ["../../libs/config-resolver/node/src/config.ts"]
  }
}
```

2. Import and call:

```typescript
import { loadConfig } from '@nx-launchpad/config-resolver-node';
```

3. Ensure `APP_ENV` is set in your environment. For non-local environments with `ssm:` values, AWS credentials must also be available.
