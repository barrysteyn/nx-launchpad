import { Hono } from 'hono';
import { ADMIN_ROLE } from '@nx-launchpad/auth-node';
import type { Bindings, Variables } from '../types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.get('/api/admin', (c) => {
  const user = c.get('user');
  if (user.role !== ADMIN_ROLE) {
    return c.json({ error: 'Forbidden — admin role required' }, 403);
  }
  return c.json({
    message: `Welcome, ${user.email}. You have admin access.`,
    role: user.role,
  });
});

export default app;
