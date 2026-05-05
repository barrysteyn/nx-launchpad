import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getAuth } from './auth';
import type { Bindings, Variables } from './types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

let _origins: Set<string> | null = null;

app.use('*', (c, next) => {
  if (!_origins) {
    _origins = new Set(
      (c.env.TRUSTED_ORIGINS ?? '').split(',').filter(Boolean),
    );
  }
  return cors({
    origin: (origin) => (_origins!.has(origin) ? origin : null),
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
  })(c, next);
});

app.on(['GET', 'POST'], '/api/auth/*', (c) =>
  getAuth(c.env).handler(c.req.raw),
);

app.on(['GET', 'POST'], '/.well-known/jwks.json', (c) =>
  getAuth(c.env).handler(c.req.raw),
);

export default app;
