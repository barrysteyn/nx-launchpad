import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.get('/api/me', (c) => {
  return c.json(c.get('user'));
});

export default app;
