interface KVNamespace {
  get(key: string): Promise<string | null>;
}

export async function loadCloudflareConfig(kv: KVNamespace): Promise<Record<string, unknown>> {
  const value = await kv.get('config');
  if (value === null) {
    throw new Error("CONFIG_KV key 'config' not found. Seed the KV store before starting the worker.");
  }
  return JSON.parse(value) as Record<string, unknown>;
}
