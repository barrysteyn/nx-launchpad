# libs/utils

Shared utility libraries for use across all apps in this monorepo. Utilities are organised by language runtime — each language has its own folder with its own Nx project.

| Folder | Language | Nx project |
|---|---|---|
| `node/` | TypeScript / Node.js | `utils-node` |

---

## Utilities

### Logger

A structured logger built on [OpenTelemetry](https://opentelemetry.io/) (OTEL). All log output follows the OTEL Logs data model, making it backend-agnostic — swap the export destination without changing any application code.

The logger ships to [BetterStack](https://betterstack.com/) in non-local environments. Locally it writes to the console.

#### How it works

On import, the logger initialises an OTEL `LoggerProvider` with a `SimpleLogRecordProcessor`. The processor is chosen based on the presence of the `BETTERSTACK_TOKEN` environment variable:

- **`BETTERSTACK_TOKEN` set** — logs are exported via OTLP/HTTP to BetterStack's ingestion endpoint (`https://in-otel.logs.betterstack.com`)
- **`BETTERSTACK_TOKEN` not set** — logs are written to the console (local development)

`SimpleLogRecordProcessor` is used intentionally over `BatchLogRecordProcessor` because it flushes synchronously — important in Lambda environments where the process may freeze before a batch is flushed. For the same reason, a `flushLogger()` helper is exported and should be called at the end of each Lambda invocation.

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
| `BETTERSTACK_TOKEN` | No | BetterStack ingestion token. If absent, logs go to console. |
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

Attribute values must be `string`, `number`, or `boolean`.

#### Child loggers

Use `child()` to create a derived logger that carries a fixed set of attributes on every log record. This is the recommended pattern for adding service or module context:

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

In AWS Lambda, always call `flushLogger()` before your handler returns. Without this, buffered log records may be lost when the Lambda execution environment freezes.

```typescript
import { logger, flushLogger } from '@nx-launchpad/utils-node';

export const handler = async (event: unknown) => {
  logger.info('Handler invoked');

  try {
    // ... your logic
  } finally {
    await flushLogger();
  }
};
```

#### Adding the logger to a new app

1. Add the path alias import to your app's `tsconfig.json` (the alias is defined in `tsconfig.base.json`):

```json
{
  "extends": "../../../tsconfig.base.json"
}
```

2. Import and use:

```typescript
import { logger } from '@nx-launchpad/utils-node';
```

3. Set `BETTERSTACK_TOKEN` and `SERVICE_NAME` in your environment (`.env` for local, GitHub secrets / Lambda env vars for deployed environments).
