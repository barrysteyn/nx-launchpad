import { getAuth } from './auth';
import type { Bindings } from './types';

// Stub env used only by `npx @better-auth/cli generate` for schema generation.
// Never imported by the worker at runtime.
const stubEnv: Bindings = {
  ENVIRONMENT: 'local',
  PROJECT_NAME: 'stub',
  BETTER_AUTH_URL: 'http://localhost',
  TRUSTED_ORIGINS: 'http://localhost',
  BETTER_AUTH_SECRETS: '1:stub',
  AWS_SES_ACCESS_KEY: 'stub',
  AWS_SES_SECRET_KEY: 'stub',
  AWS_SES_REGION: 'us-east-1',
  FROM_EMAIL: 'stub@stub.com',
  DB: {} as D1Database,
};

export default getAuth(stubEnv);
