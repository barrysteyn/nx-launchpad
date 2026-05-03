import type { Bindings } from './types';

const JWKS_KV_KEY = 'jwks_keys';

export const jwksKvAdapter = (env: Bindings) => ({
  getJwks: async () => {
    const value = await env.JWKS_KV.get(JWKS_KV_KEY);
    if (!value) return [];
    return JSON.parse(value) as object[];
  },
  createJwk: async (_ctx: unknown, webKey: object) => {
    const existing = await env.JWKS_KV.get(JWKS_KV_KEY);
    const keys = existing ? (JSON.parse(existing) as object[]) : [];
    keys.push(webKey);
    await env.JWKS_KV.put(JWKS_KV_KEY, JSON.stringify(keys));
    return webKey;
  },
});
