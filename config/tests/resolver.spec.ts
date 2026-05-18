import { beforeEach, describe, expect, test, vi } from 'vitest';

const getSecretsMap = vi.hoisted(() => vi.fn());

vi.mock('libs/utils-node', () => ({
  Secrets: vi.fn().mockImplementation(() => ({ getSecretsMap })),
  isJsonObjectOrArray: (val: unknown): boolean => typeof val === 'object' && val !== null,
  logger: {
    child: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
  },
}));

vi.mock('fs', async (importActual) => {
  const actual = await importActual<typeof import('fs')>();
  return { ...actual, existsSync: vi.fn(), readFileSync: vi.fn() };
});

import { existsSync, readFileSync } from 'fs';
import { resolveConfig } from '../src/resolver';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockReadFileSync = vi.mocked(readFileSync) as any;
const mockExistsSync = vi.mocked(existsSync);

const OPTS = { environment: 'staging', filesDir: '/fake' };

const baseConfig = {
  RIZZLER_APP: { APP_NAME: 'baseApp', SECRET: 'ssm:/staging/rizzler/secret', KEY: 'val' },
};
const envConfig = {
  RIZZLER_APP: { APP_NAME: 'envApp', ENV_SPECIFIC: 'envValue' },
};

const readByPath = (obj: unknown, dotted: string): unknown =>
  dotted
    .split('.')
    .reduce(
      (o: unknown, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]),
      obj,
    );

beforeEach(() => {
  vi.clearAllMocks();
  mockExistsSync.mockImplementation((p: unknown) => String(p).endsWith('default.yaml'));
  mockReadFileSync.mockReturnValue('{}');
  getSecretsMap.mockResolvedValue({});
});

describe('Basic Tests', () => {
  test('Conforms to documentation (plain object access)', async () => {
    mockReadFileSync.mockReturnValueOnce(
      'RIZZLER_APP:\n  APP_NAME: baseApp\n  ANOTHER_OBJ:\n    ANOTHER_KEY: anotherVal\n    YETANOTHER_OBJ:\n      YETANOTHER_KEY: yetAnotherVal',
    );

    const config = await resolveConfig(OPTS);
    const app = config['RIZZLER_APP'] as Record<string, unknown>;
    const anotherObj = app['ANOTHER_OBJ'] as Record<string, unknown>;
    const yetAnotherObj = anotherObj['YETANOTHER_OBJ'] as Record<string, unknown>;

    expect(app['APP_NAME']).toEqual('baseApp');
    expect(app['DOES_NOT_EXIST']).toBeUndefined();
    expect(anotherObj['ANOTHER_KEY']).toEqual('anotherVal');
    expect(yetAnotherObj['YETANOTHER_KEY']).toEqual('yetAnotherVal');
  });
});

describe('Loading Shared Config Values', () => {
  const cases = [
    [baseConfig, null, { 'RIZZLER_APP.APP_NAME': 'baseApp', 'RIZZLER_APP.KEY': 'val' }],
    [
      baseConfig,
      envConfig,
      {
        'RIZZLER_APP.APP_NAME': 'envApp',
        'RIZZLER_APP.ENV_SPECIFIC': 'envValue',
        'RIZZLER_APP.KEY': 'val',
      },
    ],
  ] as const;

  test.each(cases)('%# resolves expected values', async (baseCfg, envCfg, expected) => {
    if (envCfg) {
      mockExistsSync.mockReturnValue(true);
    }

    mockReadFileSync.mockReturnValueOnce(
      `RIZZLER_APP:\n  APP_NAME: ${baseCfg.RIZZLER_APP.APP_NAME}\n  KEY: ${baseCfg.RIZZLER_APP.KEY}`,
    );
    if (envCfg) {
      mockReadFileSync.mockReturnValueOnce(
        `RIZZLER_APP:\n  APP_NAME: ${envCfg.RIZZLER_APP.APP_NAME}\n  ENV_SPECIFIC: ${envCfg.RIZZLER_APP.ENV_SPECIFIC}`,
      );
    }

    const config = await resolveConfig(OPTS);

    for (const [dotPath, val] of Object.entries(expected)) {
      expect(readByPath(config, dotPath)).toBe(val);
    }
  });
});

describe('Resolving Shared Config Secrets', () => {
  test('Secret with ssm: prefix is resolved', async () => {
    mockReadFileSync.mockReturnValueOnce(
      'RIZZLER_APP:\n  APP_NAME: baseApp\n  SECRET: ssm:/staging/rizzler/secret\n  KEY: val',
    );
    getSecretsMap.mockResolvedValue({ SECRET: 'resolved-secret' });

    const config = await resolveConfig(OPTS);
    const app = config['RIZZLER_APP'] as Record<string, unknown>;

    expect(app['SECRET']).toEqual('resolved-secret');
    expect(app['KEY']).toEqual('val');
  });
});

describe('Nested object access remains plain JSON', () => {
  test('Nested values accessible via property paths', async () => {
    mockReadFileSync.mockReturnValueOnce(
      'RIZZLER_APP:\n  APP_NAME: baseApp\n  ANOTHER_OBJ:\n    ANOTHER_KEY: anotherVal\n    YETANOTHER_OBJ:\n      YETANOTHER_KEY: yetAnotherVal',
    );

    const config = await resolveConfig(OPTS);
    const app = config['RIZZLER_APP'] as Record<string, unknown>;
    const anotherObj = app['ANOTHER_OBJ'] as Record<string, unknown>;
    const yetAnotherObj = anotherObj['YETANOTHER_OBJ'] as Record<string, unknown>;

    expect(anotherObj).toBeDefined();
    expect(anotherObj['ANOTHER_KEY']).toEqual('anotherVal');
    expect(yetAnotherObj['YETANOTHER_KEY']).toEqual('yetAnotherVal');
  });
});
