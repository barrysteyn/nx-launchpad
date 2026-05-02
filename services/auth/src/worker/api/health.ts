import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';

const health = new Hono<{ Bindings: Bindings; Variables: Variables }>();

health.get('/api/health', (c) =>
  c.json({ status: 'ok', environment: c.env.ENVIRONMENT }),
);

export default health;
