import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import type { Bindings } from './types';

// Per-request factory. Cloudflare Workers' I/O isolation rule forbids reusing
// an I/O object (TCP socket, stream, etc.) created in one request from another
// request — even within the same isolate. So the postgres.js client (which
// holds a TCP connection through Hyperdrive) MUST NOT be cached at module scope.
//
// Hyperdrive itself provides cross-request connection reuse on Cloudflare's
// edge, so the only "cost" of recreating the client per request is constructing
// a config object (microseconds). The real DB connection lives in Hyperdrive's
// pool, not in this client.
//
// Callers should pass `executionCtx.waitUntil(client.end())` at the end of the
// request so postgres.js cleanly closes the connection (and Hyperdrive can
// recycle the underlying upstream).
export const createDb = (env: Bindings) => {
  const client = postgres(env.HYPERDRIVE.connectionString, {
    // prepare: false — Hyperdrive's statement cache conflicts with postgres.js's
    // prepared-statement protocol.
    prepare: false,
    // fetch_types: false — skip the type-introspection query postgres.js runs on
    // each new connection (per Cloudflare's postgres.js+Hyperdrive recipe).
    fetch_types: false,
    // Single connection per Worker request (Workers limit concurrent outbound
    // subrequests to 6 anyway; auth queries are short and sequential).
    max: 1,
    onnotice: () => {},
  });
  const db = drizzle(client, { schema });
  return { client, db };
};
