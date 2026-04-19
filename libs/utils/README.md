# libs/utils

Shared utility libraries for use across all apps in this monorepo. Utilities are organised by language runtime — each language has its own folder with its own Nx project.

| Folder | Language | Nx project |
|---|---|---|
| `node/` | TypeScript / Node.js | `utils-node` |

---

## Utilities

### Logger

A structured logger built on [pino](https://getpino.io/). All log output is JSON-structured, making it compatible with any log aggregation backend.

Locally (`APP_ENV=local` or unset) logs are pretty-printed to the console via `pino-pretty`. In all other environments logs are written as JSON to stdout — Lambda ships these to CloudWatch automatically.

#### How it works

On import, the logger is initialised based on `APP_ENV`:

- **`APP_ENV=local` (or unset)** — pretty-printed, colourised output via `pino-pretty`
- **Any other `APP_ENV`** — raw JSON to stdout (CloudWatch / any log aggregator)

The service name attached to all log records is read from the `SERVICE_NAME` environment variable, defaulting to `"app"` if not set.

#### Language implementations

- [Node.js](#nodejs) — available now
- Python — coming soon

---

### Logger — Node.js

**Location:** `libs/utils/node/src/logger.ts`

#### Environment variables

| Variable | Required | Description |
|---|---|---|
| `APP_ENV` | No | Controls log format. `local` (or unset) → pretty print. Anything else → JSON stdout. |
| `SERVICE_NAME` | No | Name attached to all log records. Defaults to `"app"`. |
| `LOG_LEVEL` | No | Minimum log level. Defaults to `"info"`. |

#### Usage

Import the singleton `logger` instance directly:

```typescript
import { logger } from '@nx-launchpad/utils-node';

logger.info('Server started');
logger.warn('Retrying request');
logger.error('Unhandled exception');
logger.debug('Payload received');
```

Structured logging — pass an attributes object as the first argument and the message as the second:

```typescript
logger.info({ userId: '123', action: 'login' }, 'User authenticated');
logger.error({ statusCode: 500, path: '/api/data' }, 'Request failed');
```

#### Child loggers

Use `child()` to create a derived logger that carries a fixed set of attributes on every log record:

```typescript
const log = logger.child({ service: 'PaymentProcessor' });

log.info('Processing payment');           // includes service: PaymentProcessor
log.error({ orderId: 'abc' }, 'Failed');  // includes both service and orderId
```

Child loggers can be nested — each call to `child()` merges bindings on top of the parent's:

```typescript
const requestLog = log.child({ requestId: 'xyz' });
requestLog.info('Handling request'); // includes service + requestId
```

#### Lambda usage — flushing

Pino buffers writes to stdout. In AWS Lambda the execution environment freezes after the handler returns, which can cut off buffered log lines before they are shipped to CloudWatch.

Always call `flushLogger()` in a `finally` block so every invocation flushes before the process freezes:

```typescript
import { logger, flushLogger } from '@nx-launchpad/utils-node';

export const handler = async (event: unknown) => {
  try {
    logger.info('Handler invoked');
    // ... your logic
  } finally {
    await flushLogger();
  }
};
```

#### Adding the logger to a new app

1. Add the path alias to your app's `tsconfig.json`:

```json
{
  "paths": {
    "@nx-launchpad/utils-node": ["../../libs/utils/node/src/index.ts"]
  }
}
```

2. Import and use:

```typescript
import { logger, flushLogger } from '@nx-launchpad/utils-node';
```

3. Set `SERVICE_NAME` in your environment (`.env` for local, Lambda env vars for deployed environments).
