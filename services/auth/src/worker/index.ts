import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { createAuth } from './auth';
import { createDb } from './db';
import { getOriginMatcher } from './origin-matcher';
import type { Bindings, Variables } from './types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use('*', (c, next) => {
  const matchOrigin = getOriginMatcher(c.env.TRUSTED_ORIGINS);
  return cors({
    origin: (origin) => (matchOrigin(origin) ? origin : null),
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
  })(c, next);
});

// Per-request handler: build a fresh postgres.js client + auth instance.
// Workers I/O isolation forbids reusing I/O objects across requests, so the
// db client (and the auth instance that holds it) must be rebuilt every time.
// `ctx.waitUntil(client.end())` lets postgres.js close cleanly after the
// response is returned, so Hyperdrive can recycle the upstream connection.
const handleAuth = async (
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
) => {
  const { client, db } = createDb(c.env);
  try {
    return await createAuth(c.env, db).handler(c.req.raw);
  } finally {
    c.executionCtx.waitUntil(client.end());
  }
};

app.on(['GET', 'POST'], '/api/auth/*', handleAuth);
app.on(['GET', 'POST'], '/.well-known/jwks.json', handleAuth);

export default app;
