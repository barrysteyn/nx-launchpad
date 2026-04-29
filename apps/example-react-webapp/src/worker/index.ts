import { Hono } from 'hono';
import { configMiddleware } from './middleware/config';

type Bindings = {
  ENVIRONMENT: string;
  PROJECT_NAME: string;
  CONFIG_KV: KVNamespace;
};

type Variables = {
  config: Record<string, unknown>;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use('*', configMiddleware);

app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    environment: c.env.ENVIRONMENT,
  });
});

export default app;
