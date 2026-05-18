# libs/utils

Shared utility libraries for use across all apps in this monorepo. Utilities are organised by language runtime — each language has its own folder with its own Nx project.

| Folder | Language | Nx project |
|---|---|---|
| `node/` | TypeScript / Node.js | `libs/utils-node` |

---

## Utilities

- [Logger](#logger) — pino-based structured logging
- [Email](#email--nodejs--cloudflare-workers) — SES v2 send via aws4fetch + mimetext (Workers-compatible)

### Logger

A structured logger built on [pino](https://getpino.io/). All log output is JSON-structured, making it compatible with any log aggregation backend.

Locally (`ENVIRONMENT=local` or unset) logs are pretty-printed to the console via `pino-pretty`. In all other environments logs are written as JSON to stdout — Lambda ships these to CloudWatch automatically.

#### How it works

On import, the logger is initialised based on `ENVIRONMENT`:

- **`ENVIRONMENT=local` (or unset)** — pretty-printed, colourised output via `pino-pretty`
- **Any other `ENVIRONMENT`** — raw JSON to stdout (CloudWatch / any log aggregator)

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
| `ENVIRONMENT` | No | Controls log format. `local` (or unset) → pretty print. Anything else → JSON stdout. |
| `SERVICE_NAME` | No | Name attached to all log records. Defaults to `"app"`. |
| `LOG_LEVEL` | No | Minimum log level. Defaults to `"info"`. |

#### Usage

Import the singleton `logger` instance directly:

```typescript
import { logger } from 'libs/utils-node';

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
import { logger, flushLogger } from 'libs/utils-node';

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
    "libs/utils-node": ["../../libs/utils/node/src/index.ts"]
  }
}
```

2. Import and use:

```typescript
import { logger, flushLogger } from 'libs/utils-node';
```

3. Set `SERVICE_NAME` in your environment (`.env` for local, Lambda env vars for deployed environments).

---

### Email — Node.js / Cloudflare Workers

**Location:** `libs/utils/node/src/email.ts`

Sends transactional email via Amazon SES v2 (JSON API) using [`aws4fetch`](https://github.com/mhart/aws4fetch) for signing and [`mimetext`](https://github.com/muratgozel/MIMEText) for RFC 5322-compliant MIME construction. Both deps are zero-Node-only — they run unmodified in Cloudflare Workers and in standard Node.

#### What it handles for you

- **Header injection safe.** Subject, From, To and any header values go through `mimetext`, which rejects/escapes CRLF.
- **Non-ASCII subjects** are RFC 2047-encoded automatically (`=?UTF-8?B?...?=`).
- **Non-ASCII bodies** are quoted-printable encoded with correct `Content-Transfer-Encoding`.
- **Plain-text + HTML alternative parts** are wired up if you pass `html`.
- **Attachments** are added as base64 `multipart/mixed` parts.
- **`List-Unsubscribe` + one-click `POST`** headers added when you pass `listUnsubscribe`.
- **Size guard** — throws before calling SES if the raw message exceeds ~9.5 MB.

#### Usage

```typescript
import { sendEmail } from 'libs/utils-node';

const { messageId } = await sendEmail({
  from: '"DV Photo Tool" <photos@dvphototool.com>',
  to: 'user@example.com',
  subject: 'Your photos',
  text: 'Hi there — your photos are attached.',
  html: '<p>Hi there — your photos are attached.</p>', // optional
  attachments: [                                        // optional
    {
      filename: 'photo1.jpg',
      contentType: 'image/jpeg',
      content: '<base64 string, no data: prefix>',
    },
  ],
  listUnsubscribe: 'mailto:unsubscribe@dvphototool.com', // optional
  aws: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    region: 'us-east-1', // optional, defaults to us-east-1
  },
});
```

#### Attachments

`Attachment` is a minimal shape — the caller is responsible for sourcing the bytes and base64-encoding them. The library has no opinion about where attachments come from (R2, S3, the filesystem, in-memory).

```typescript
interface Attachment {
  filename: string;
  contentType: string;
  content: string; // base64, no `data:` prefix
}
```

#### What it does NOT do

- **No content scrubbing.** If you need to rewrite words for deliverability or compliance, do it in the caller before passing `text` / `html` / `subject`.
- **No retries.** SES throttling, transient 5xx, network failures — handle at the call site if needed.
- **No SES configuration set / tags.** Add them if you need them.

#### Errors

`sendEmail` throws on:

- non-2xx response from SES (message includes status code and body),
- a 2xx response that doesn't contain a `MessageId`,
- a raw MIME larger than ~9.5 MB.
