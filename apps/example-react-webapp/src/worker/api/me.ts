import { Hono } from 'hono';
import { jwtMiddleware } from '@nx-launchpad/auth-node';
import type { Bindings, Variables } from '../types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use('/api/me', (c, next) => jwtMiddleware(c.env.AUTH_URL)(c, next));

app.get('/api/me', (c) => {
  return c.json(c.get('user'));
});

export default app;
