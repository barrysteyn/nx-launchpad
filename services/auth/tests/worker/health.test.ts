import { describe, expect, it } from 'vitest';
import app from '../../src/worker/index';
import type { Bindings } from '../../src/worker/types';

const mockEnv: Partial<Bindings> = {
  ENVIRONMENT: 'local',
  PROJECT_NAME: 'test',
  BETTER_AUTH_URL: 'http://localhost',
  TRUSTED_ORIGINS: 'http://localhost:5173',
  BETTER_AUTH_SECRET: 'test-secret-32-chars-long-minimum!',
  BETTER_AUTH_SECRETS: '1:test-secret-32-chars-long-minimum!',
  UPSTASH_REDIS_URL: 'http://localhost',
  UPSTASH_REDIS_TOKEN: 'token',
  AWS_SES_ACCESS_KEY: 'key',
  AWS_SES_SECRET_KEY: 'secret',
  AWS_SES_REGION: 'us-east-1',
  FROM_EMAIL: 'test@test.com',
  DB: {} as D1Database,
  JWKS_KV: {} as KVNamespace,
};

describe('GET /api/health', () => {
  it('returns 200 with status ok and environment', async () => {
    const req = new Request('http://localhost/api/health');
    const res = await app.fetch(req, mockEnv, {
      waitUntil: () => {},
      passThroughOnException: () => {},
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok', environment: 'local' });
  });
});
