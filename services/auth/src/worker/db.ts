import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import type { Bindings } from './types';

let _client: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _cacheKey = '';

export const db = (env: Bindings) => {
  // Hyperdrive's connectionString is stable for the lifetime of the binding,
  // so caching keyed on it survives across requests in the same isolate.
  const cacheKey = env.HYPERDRIVE.connectionString;
  if (_db && _cacheKey === cacheKey) return _db;

  // prepare: false — Hyperdrive's statement cache and postgres.js's
  // prepared-statement protocol conflict, yielding intermittent
  // "prepared statement does not exist" errors otherwise.
  _client = postgres(env.HYPERDRIVE.connectionString, { prepare: false });
  _db = drizzle(_client, { schema });
  _cacheKey = cacheKey;
  return _db;
};
