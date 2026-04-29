import type { MiddlewareHandler } from 'hono';
import { loadCloudflareConfig } from '@nx-launchpad/config-loader-node';

type Bindings = {
  ENVIRONMENT: string;
  PROJECT_NAME: string;
  CONFIG_KV: KVNamespace;
};

type Variables = {
  config: Record<string, unknown>;
};

export const configMiddleware: MiddlewareHandler<{
  Bindings: Bindings;
  Variables: Variables;
}> = async (c, next) => {
  const config = await loadCloudflareConfig(c.env.CONFIG_KV);
  c.set('config', config);
  await next();
};
