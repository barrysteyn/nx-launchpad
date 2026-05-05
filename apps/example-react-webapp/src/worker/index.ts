import { Hono } from 'hono';
import { jwtMiddleware } from '@nx-launchpad/auth-node';
import { configMiddleware } from './middleware/config';
import type { Bindings, Variables } from './types';
import health from './api/health';
import me from './api/me';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use('*', configMiddleware);

const PUBLIC_API_ROUTES = ['/api/health'];

app.use('/api/*', (c, next) => {
  if (PUBLIC_API_ROUTES.includes(c.req.path)) return next();
  return jwtMiddleware(c.env.AUTH_URL)(c, next);
});

app.route('/', health);
app.route('/', me);

export default app;
