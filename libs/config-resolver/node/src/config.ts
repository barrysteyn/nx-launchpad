import deepmerge from 'deepmerge';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import YAML from 'yaml';
import type { AwsCredentialIdentity } from '@smithy/types';

import { Secrets, isJsonObjectOrArray, logger as rootLogger } from '@nx-launchpad/utils-node';

const logger = rootLogger.child({ serviceName: 'loadConfig' });

const cache: Record<string, Record<string, unknown>> = {};
const inflight: Partial<Record<string, Promise<Record<string, unknown>>>> = {};

const ensureScreamingSnake = (key: string) => {
  if (!/^[A-Z0-9_]+$/.test(key)) {
    throw new Error(`Invalid config key (must be SCREAMING_SNAKE_CASE): ${key}`);
  }
};

const collectSecrets = (obj: unknown, secretMap: Record<string, string>) => {
  if (!isJsonObjectOrArray(obj) || Array.isArray(obj)) return;
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    ensureScreamingSnake(key);
    if (isJsonObjectOrArray(val)) {
      collectSecrets(val, secretMap);
    } else if (typeof val === 'string' && val.startsWith('ssm:')) {
      secretMap[key] = val.replace(/^ssm:/, '');
    }
  }
};

const resolveSecrets = (
  obj: unknown,
  resolved: Record<string, string | null>,
) => {
  if (!isJsonObjectOrArray(obj) || Array.isArray(obj)) return;
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (isJsonObjectOrArray(value)) {
      resolveSecrets(value, resolved);
    } else if (typeof value === 'string' && value.startsWith('ssm:')) {
      if (resolved[key] == null) {
        throw new Error(`Secret for key ${key} not found in SSM at path ${value}`);
      }
      (obj as Record<string, unknown>)[key] = resolved[key];
    }
  }
};

export async function loadConfig({
  credentials,
  forceReload = false,
  configDir,
  environment = process.env['APP_ENV'] ?? 'local',
}: {
  credentials?: AwsCredentialIdentity;
  forceReload?: boolean;
  configDir?: string;
  environment?: string;
} = {}): Promise<Record<string, unknown>> {
  const dir = configDir ?? path.resolve(process.cwd(), 'config');
  const cacheKey = environment;

  if (!forceReload && cache[cacheKey]) {
    logger.info('Using cached config');
    return cache[cacheKey];
  }

  const existing = inflight[cacheKey];
  if (existing) {
    logger.info('Awaiting in-flight config load');
    return existing;
  }

  logger.info(`Loading config for environment: ${environment}`);
  logger.info(`Loading config from: ${dir}`);

  const loadPromise = (async (): Promise<Record<string, unknown>> => {
    try {
      const defaultPath = path.join(dir, 'default.yaml');
      const envPath = path.join(dir, `${environment}.yaml`);

      if (!existsSync(defaultPath)) {
        throw new Error(`Config file not found: ${defaultPath}`);
      }

      const base = YAML.parse(readFileSync(defaultPath, 'utf-8')) as Record<string, unknown>;
      const overlay = existsSync(envPath)
        ? (YAML.parse(readFileSync(envPath, 'utf-8')) as Record<string, unknown>)
        : {};

      const config = deepmerge(base, overlay) as Record<string, unknown>;

      const secretMap: Record<string, string> = {};
      collectSecrets(config, secretMap);

      const secrets = new Secrets({ credentials });
      const resolved = await secrets.getSecretsMap(secretMap, { noCache: forceReload });

      resolveSecrets(config, resolved);

      cache[cacheKey] = config;
      return config;
    } catch (err) {
      logger.error(`Error loading config: ${err}`);
      throw err;
    }
  })();

  inflight[cacheKey] = loadPromise;

  // Clean up in-flight entry when done regardless of outcome.
  // On failure the cache is not updated so the old value (if any) is preserved.
  loadPromise.finally(() => {
    delete inflight[cacheKey];
  });

  return loadPromise;
}
