import deepmerge from 'deepmerge';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import YAML from 'yaml';
import type { AwsCredentialIdentity } from '@smithy/types';

import { Secrets, isJsonObjectOrArray } from 'utils-node';

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

const resolveSecrets = (obj: unknown, resolved: Record<string, string | null>) => {
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

export async function resolveConfig({
  environment,
  filesDir,
  credentials,
}: {
  environment: string;
  filesDir: string;
  credentials?: AwsCredentialIdentity;
}): Promise<Record<string, unknown>> {
  const defaultPath = path.join(filesDir, 'default.yaml');
  const envPath = path.join(filesDir, `${environment}.yaml`);

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
  const resolved = await secrets.getSecretsMap(secretMap, { noCache: true });
  resolveSecrets(config, resolved);

  return config;
}
