import { drizzle } from 'drizzle-orm/postgres-js';
import { createAuth } from './auth';
import * as schema from './schema';
import type { Bindings } from './types';
import pkg from '../../package.json';

// Stub env + stub Drizzle instance used only by `npx @better-auth/cli generate`
// for schema generation. The CLI introspects the auth config in memory and never
// opens a real DB connection, so the stubs only need to type-check.
const stubEnv: Bindings = {
  ENVIRONMENT: 'local',
  PROJECT_NAME: 'stub',
  MULTITENANCY_ENABLED: pkg.multitenancyEnabled ? 'true' : 'false',
  BETTER_AUTH_URL: 'http://localhost',
  TRUSTED_ORIGINS: 'http://localhost',
  BETTER_AUTH_SECRETS: '1:stub',
  AWS_SES_ACCESS_KEY: 'stub',
  AWS_SES_SECRET_KEY: 'stub',
  AWS_SES_REGION: 'us-east-1',
  FROM_EMAIL: 'stub@stub.com',
  HYPERDRIVE: {} as Hyperdrive,
};

// Empty drizzle instance — CLI generate only inspects schema shape, never executes.
const stubDb = drizzle.mock({ schema });

export default createAuth(stubEnv, stubDb);
