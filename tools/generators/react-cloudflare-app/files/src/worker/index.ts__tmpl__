import { Hono } from 'hono';
import { configMiddleware } from './middleware/config';
import type { Bindings, Variables } from './types';
import health from './api/health';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use('*', configMiddleware);

app.route('/', health);

export default app;
