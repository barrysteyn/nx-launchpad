import type { AuthPayload } from '@nx-launchpad/auth-node';

export type Bindings = {
  ENVIRONMENT: string;
  PROJECT_NAME: string;
  CONFIG_KV: KVNamespace;
  AUTH_URL: string;
};

export type Variables = {
  config: Record<string, unknown>;
  user: AuthPayload;
};
