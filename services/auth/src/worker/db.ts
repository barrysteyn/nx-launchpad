import { drizzle } from 'drizzle-orm/d1';
import type { Bindings } from './types';

export const db = (env: Bindings) => drizzle(env.DB);
