export type Bindings = {
  ENVIRONMENT: string;
  PROJECT_NAME: string;
  CONFIG_KV: KVNamespace;
};

export type Variables = {
  config: Record<string, unknown>;
};
