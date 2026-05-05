import { Hono } from 'hono';
import { jwtMiddleware } from '@nx-launchpad/auth-node';
import { configMiddleware } from './middleware/config';
import type { Bindings, Variables } from './types';
import health from './api/health';
import me from './api/me';
import admin from './api/admin';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use('*', configMiddleware);

const PUBLIC_API_ROUTES = new Set(['/api/health']);

app.use('/api/*', (c, next) => {
  if (PUBLIC_API_ROUTES.has(c.req.path)) return next();
  return jwtMiddleware(c.env.AUTH_URL)(c, next);
});

app.route('/', health);
app.route('/', me);
app.route('/', admin);

export default app;
