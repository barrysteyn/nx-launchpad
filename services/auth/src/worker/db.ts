import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';
import type { Bindings } from './types';

export const db = (env: Bindings) => drizzle(env.DB, { schema });
