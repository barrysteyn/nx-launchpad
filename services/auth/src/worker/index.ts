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
async function dispatchToAuth(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  request: Request,
) {
  const { client, db } = createDb(c.env);
  try {
    return await createAuth(c.env, db).handler(request);
  } finally {
    c.executionCtx.waitUntil(client.end());
  }
}

const handleAuth = (
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
) => dispatchToAuth(c, c.req.raw);

// better-auth interprets its `jwksPath` config as relative to the auth base
// (`/api/auth`), so the standards-compliant /.well-known/jwks.json path
// needs a URL rewrite before forwarding into better-auth's internal router.
const handleJwksAlias = (
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
) => {
  const url = new URL(c.req.url);
  url.pathname = '/api/auth/.well-known/jwks.json';
  return dispatchToAuth(c, new Request(url, c.req.raw));
};

// JWKS publishers conventionally send Cache-Control so JOSE clients cache
// the key set between verifications. better-auth doesn't set one today.
const ensureJwksCacheHeader = async (
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  next: () => Promise<void>,
) => {
  await next();
  if (!c.res.headers.has('cache-control')) {
    const headers = new Headers(c.res.headers);
    headers.set('cache-control', 'public, max-age=3600');
    c.res = new Response(c.res.body, {
      status: c.res.status,
      statusText: c.res.statusText,
      headers,
    });
  }
};

app.use('/.well-known/jwks.json', ensureJwksCacheHeader);
app.use('/api/auth/.well-known/jwks.json', ensureJwksCacheHeader);

app.on(['GET', 'POST'], '/api/auth/*', handleAuth);
app.get('/.well-known/jwks.json', handleJwksAlias);

export default app;
