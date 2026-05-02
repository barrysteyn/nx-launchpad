import { Hono } from 'hono';
import { cors } from 'hono/cors';
import health from './api/health';
import { getAuth } from './auth';
import type { Bindings, Variables } from './types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use('*', async (c, next) => {
  const origins = c.env.TRUSTED_ORIGINS?.split(',') ?? [];
  return cors({
    origin: (origin) => (origins.includes(origin) ? origin : null),
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
  })(c, next);
});

app.route('/', health);

app.on(['GET', 'POST'], '/api/auth/*', (c) =>
  getAuth(c.env).handler(c.req.raw),
);

app.on(['GET', 'POST'], '/.well-known/jwks.json', (c) =>
  getAuth(c.env).handler(c.req.raw),
);

export default app;
