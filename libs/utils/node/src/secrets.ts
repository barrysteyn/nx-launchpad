import {
  GetParametersByPathCommand,
  GetParametersCommand,
  Parameter,
  SSMClient,
} from '@aws-sdk/client-ssm';
import { TTLCache } from '@isaacs/ttlcache';

import { logger as rootLogger } from './logger';
import { chunkArray } from './utils';

const logger = rootLogger.child({ serviceName: 'Secrets' });

const DEFAULT_REGION =
  process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const DEFAULT_TTL = 5 * 60 * 1000;
const SSM_LIMIT = 10;

type SecretsOptions = {
  /** TTL for the cached value in milliseconds. Defaults to 5 minutes. */
  ttl?: number;
  /** Skip the cache entirely for this request. */
  noCache?: boolean;
  /** Throw if the secret name is missing or the value is not found. */
  required?: boolean;
};

class Secrets {
  private options: { region?: string; requiresEnvVars?: boolean };
  private cache: TTLCache<string, string>;
  client: SSMClient;

  constructor(options?: {
    region?: string;
    credentials?: any;
    requiresEnvVars?: boolean;
  }) {
    this.options = options ?? {};
    this.cache = new TTLCache<string, string>({
      ttl: DEFAULT_TTL,
      checkAgeOnGet: true,
    });
    this.client = new SSMClient({
      region: options?.region ?? DEFAULT_REGION,
      credentials: options?.credentials ?? this.validateEnv(),
    });
  }

  private validateEnv() {
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      return {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN,
      };
    }

    if (this.options.requiresEnvVars) {
      throw new Error(
        'Secrets manager: AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set',
      );
    }

    return undefined;
  }

  async getSecretsByPath(path: string): Promise<Parameter[]> {
    logger.info(`Getting parameters by path: ${path}`);

    const pathCacheKey = `path:${path}`;
    const cached = this.cache.get(pathCacheKey);
    if (cached) {
      logger.info(`Secrets.getSecretsByPath: cache hit`);
      return JSON.parse(cached) as Parameter[];
    }

    const parameters: Parameter[] = [];
    const command = new GetParametersByPathCommand({
      Path: path,
      Recursive: true,
      WithDecryption: true,
      MaxResults: 10,
    });

    try {
      do {
        const response = await this.client.send(command);
        parameters.push(...(response.Parameters ?? []));
        command.input.NextToken = response.NextToken;
      } while (command.input.NextToken);

      parameters.forEach((param) => {
        if (param.Name && param.Value) {
          this.cache.set(param.Name, param.Value);
        }
      });
      this.cache.set(pathCacheKey, JSON.stringify(parameters));

      return parameters;
    } catch (error) {
      throw new Error(`Failed to get parameters by path ${path}: ${error}`);
    }
  }

  async getSecret(
    secretName: string,
    options?: SecretsOptions,
  ): Promise<string | null> {
    if (!secretName) {
      if (options?.required) throw new Error('Secret name is required but is empty');
      return null;
    }

    logger.info(`Getting secret: ${secretName}`);

    if (!options?.noCache) {
      const cached = this.cache.get(secretName);
      if (cached) {
        logger.info({ secretName }, 'Secrets.getSecret: cache hit');
        return cached;
      }
    }

    try {
      const response = await this.client.send(
        new GetParametersCommand({ Names: [secretName], WithDecryption: true }),
      );

      const value = response.Parameters?.[0]?.Value ?? null;

      if (!value && options?.required) {
        throw new Error(`Parameter ${secretName} not found`);
      }

      if (value && !options?.noCache) {
        this.cache.set(secretName, value, { ttl: options?.ttl });
      }

      return value;
    } catch (error) {
      throw new Error(`Failed to get secret ${secretName}: ${error}`);
    }
  }

  async getAllSecrets(
    secretNames: string[],
    options?: SecretsOptions,
  ): Promise<Record<string, string | null>> {
    logger.info(`Getting all secrets: ${secretNames.join(', ')}`);

    const results: Record<string, string | null> = {};
    if (secretNames.length === 0) return results;

    const remaining = [...secretNames];

    if (!options?.noCache) {
      for (const name of secretNames) {
        const cached = this.cache.get(name);
        if (cached) {
          logger.info({ name }, 'Secrets.getAllSecrets: cache hit');
          results[name] = cached;
          remaining.splice(remaining.indexOf(name), 1);
        }
      }
      logger.info(`Secrets.getAllSecrets: ${secretNames.length - remaining.length} from cache, ${remaining.length} to fetch`);
    }

    if (remaining.length === 0) return results;

    try {
      for (const chunk of chunkArray(remaining, SSM_LIMIT)) {
        const response = await this.client.send(
          new GetParametersCommand({ Names: chunk, WithDecryption: true }),
        );

        for (const item of response.Parameters ?? []) {
          const name = item.Name;
          if (!name) continue;

          if (!chunk.includes(name)) {
            logger.warn({ name }, 'Secrets.getAllSecrets: SSM returned unexpected parameter name');
            continue;
          }

          results[name] = item.Value ?? null;
          if (item.Value && !options?.noCache) {
            this.cache.set(name, item.Value, { ttl: options?.ttl });
          }
        }

        for (const invalid of response.InvalidParameters ?? []) {
          logger.warn({ name: invalid }, 'Secrets.getAllSecrets: parameter not found in SSM');
          results[invalid] = null;
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to get secrets: ${error}`);
    }
  }

  async getSecretsMap<S extends Record<string, string>>(
    nameMap: S,
    options?: SecretsOptions,
  ): Promise<{ [K in keyof S]: string | null }> {
    logger.info(`Getting secrets map: ${JSON.stringify(nameMap)}`);

    const results = Object.fromEntries(
      Object.keys(nameMap).map((k) => [k, null]),
    ) as { [K in keyof S]: string | null };

    const lookup = await this.getAllSecrets(Object.values(nameMap), options);

    // Build inverse map: SSM path → comma-joined config keys (handles duplicate paths)
    const keyLookup = Object.entries(nameMap).reduce<Record<string, string>>(
      (acc, [k, v]) => {
        acc[v] = acc[v] ? `${acc[v]},${k}` : k;
        return acc;
      },
      {},
    );

    for (const [ssmPath, value] of Object.entries(lookup)) {
      const configKeys = keyLookup[ssmPath];
      if (!configKeys) continue;
      for (const key of configKeys.split(',')) {
        results[key as keyof S] = value;
      }
    }

    return results;
  }
}

export default Secrets;
