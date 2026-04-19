import {
  GetParametersByPathCommand,
  GetParametersCommand,
  Parameter,
  SSMClient,
} from '@aws-sdk/client-ssm';
import TTLCache from '@isaacs/ttlcache';

import { logger as rootLogger } from './logger.js';
import { chunkArray } from './Utils.ts';

const logger = rootLogger.child({
  serviceName: 'Secrets',
});

const DEFAULT_REGION =
  process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const defaultTtl = 5 * 60 * 1000; // 5 minutes
const SSM_LIMIT = 10; // SSM limits to 10 parameters per request

const SecretsCache = new TTLCache<string, string | null>({
  // max: 1000, // limit the cache to 1000 items
  ttl: defaultTtl, // 5 minute cache timeout for all values
  checkAgeOnGet: true,
});

type SecretsOptions = {
  /** The TTL for the secret in the cache. Defaults to 5 minutes. */
  ttl?: number;
  /** If true, do not cache the secret. */
  noCache?: boolean;
  /** If true, throw an error if the secret name is empty/null/undefined or is not found when retrieved. */
  required?: boolean;
};

class Secrets {
  private options: { region?: string; requiresEnvVars?: boolean };
  client: SSMClient;

  constructor(options?: {
    region?: string;
    credentials?: any;
    requiresEnvVars?: boolean;
  }) {
    this.options = options ?? {};
    this.client = new SSMClient({
      region: options?.region ?? DEFAULT_REGION,
      credentials: options?.credentials ?? this.validateEnv(),
    });
  }

  private validateEnv() {
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      return {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        sessionToken: process.env.AWS_SESSION_TOKEN, // this may not be set
      };
    }

    if (this.options.requiresEnvVars) {
      throw new Error(
        'Secrets manager: AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set',
      );
    }

    // Otherwise (Workers), return undefined and require explicit credentials
    return undefined;
  }

  /**
   * Gets all parameters under a given path from SSM Parameter Store
   */
  async getSecretsByPath(path: string): Promise<Parameter[]> {
    logger.info(`Getting parameters by path: ${path}`);

    try {
      // Check if we have the full path result cached
      const pathCacheKey = `path:${path}`;
      const cachedPath = SecretsCache.get(pathCacheKey);
      if (cachedPath) {
        logger.info(`Secrets.getParametersByPath: cache hit for path`);
        return JSON.parse(cachedPath);
      }

      const parameters: Parameter[] = [];
      const command = new GetParametersByPathCommand({
        Path: path,
        Recursive: true,
        WithDecryption: true,
        MaxResults: 10,
      });

      do {
        const response = await this.client.send(command);
        parameters.push(...(response.Parameters || []));
        command.input.NextToken = response.NextToken;
      } while (command.input.NextToken);

      // Cache individual parameters
      parameters.forEach((param) => {
        if (param.Name && param.Value) {
          SecretsCache.set(param.Name, param.Value);
        }
      });

      // Cache the full path result
      SecretsCache.set(pathCacheKey, JSON.stringify(parameters));

      return parameters;
    } catch (error) {
      logger.error(`error getting parameters by path: ${path}`);
      logger.error(error);
      return [];
    }
  }

  async getSecret(
    secretName: string,
    options?: SecretsOptions,
  ): Promise<string | null> {
    logger.info(`Getting secret: ${secretName}`);

    if (!secretName && options?.required) {
      throw new Error(`Secret name is required but is empty/null/undefined`);
    }

    try {
      const cached = SecretsCache.get(secretName);
      if (cached && !options?.noCache) {
        logger.info({ secretName }, `Secrets.getSecret: cache hit`);
        return cached;
      }

      const command = new GetParametersCommand({
        Names: [secretName],
        WithDecryption: true,
      });

      const response = await this.client.send(command);

      if (!response.Parameters?.[0]?.Value && options?.required) {
        throw new Error(`Parameter ${secretName} not found`);
      }

      const value = response.Parameters?.[0]?.Value ?? null;
      if (value && !options?.noCache) {
        SecretsCache.set(secretName, value, { ttl: options?.ttl ?? undefined });
      }

      return value;
    } catch (error) {
      logger.error(`error getting secret: ${secretName}`);
      logger.error(error);
      return null;
    }
  }

  async getAllSecrets(secretNames: string[], options?: SecretsOptions) {
    logger.info(`Getting all secrets: ${secretNames}`);

    const results: Record<string, string | null> = {};
    if (secretNames.length === 0) {
      logger.info(`Secrets.getAllSecrets: no secrets to lookup`);
      return results;
    }

    const cachedSecretNames: string[] = [];
    if (!options?.noCache) {
      for (const name of [...secretNames]) {
        const cached = SecretsCache.get(name);
        if (cached) {
          logger.info({ name }, `Secrets.getAllSecrets: cache hit`);
          results[name] = cached;
          secretNames.splice(secretNames.indexOf(name), 1);
          cachedSecretNames.push(name);
        } else {
          logger.info({ name }, `Secrets.getAllSecrets: cache miss`);
        }
      }
      logger.info(
        { cachedSecretNames },
        `Secrets.getAllSecrets: cachedSecretNames`,
      );
    } else {
      logger.info(
        { cachedSecretNames },
        `Secrets.getAllSecrets: no cache lookup`,
      );
    }

    if (secretNames.length === 0) {
      logger.info(`Secrets.getAllSecrets: no remaining secrets to lookup`);
      return results;
    } else {
      logger.info({ secretNames }, `Secrets.getAllSecrets: looking up secrets`);
    }

    const chunks = chunkArray(secretNames, SSM_LIMIT);

    try {
      for (const chunk of chunks) {
        const command = new GetParametersCommand({
          Names: chunk,
          WithDecryption: true,
        });

        const response = await this.client.send(command);
        if (!response.Parameters?.length) {
          continue;
        }

        for (const item of response.Parameters) {
          // item.Name should be in the secretNames array, but just in case.
          if (chunk.includes(item.Name!)) {
            results[item.Name!] = item.Value || null;
            if (item.Value && !options?.noCache) {
              SecretsCache.set(item.Name!, item.Value || null, {
                ttl: options?.ttl ?? undefined,
              });
            }
          } else {
            logger.warn(
              { name: item.Name },
              `Secrets.getAllSecrets: lookup error: name returned by SSM but is not in chunk`,
            );
            results[item.Name!] = null;
          }
        }

        // Also mark any invalid parameters (like missing ones)
        if (response.InvalidParameters) {
          for (const invalid of response.InvalidParameters) {
            logger.warn(
              { name: invalid },
              `Secrets.getAllSecrets: parameter not found`,
            );
            results[invalid] = null;
          }
        }
      }

      return results;
    } catch (error) {
      logger.error(`error getting secrets: ${secretNames}`);
      logger.error(error);
      return null;
    }
  }

  async getSecretsMap<S extends Record<string, string>>(
    nameMap: S,
    options?: SecretsOptions,
  ): Promise<{ [K in keyof S]: string | null }> {
    logger.info({ nameMap }, `Getting secrets map:`);

    const keys = Object.values(nameMap);
    const results: { [K in keyof S]: string | null } = { ...nameMap };
    Object.keys(results).forEach((k) => (results[k as keyof S] = null));

    const lookup = await this.getAllSecrets(keys, options);
    if (lookup) {
      // Get an inverse map of the keys
      const keyLookup = Object.entries(nameMap).reduce<Record<string, string>>(
        (acc, [k, v]) => {
          if (acc[v]) {
            // This covers the case where a secret name is used more than once. e.g.
            // { SECRET1: '/path/to/secret1', SECRET2: '/path/to/secret2', SECRET3: '/path/to/secret1' }
            // We'll need to return all the values in a comma-separated list.
            acc[v] = [acc[v], k].join(',');
          } else {
            acc[v] = k;
          }
          return acc;
        },
        {},
      );

      Object.entries(lookup).forEach(([k, v]) => {
        // there's a typescript trick to avoid the ! but whatever...
        const items = keyLookup[k]!.split(',');
        items.forEach((item) => {
          results[item as keyof S] = v;
        });
      });
    }

    return results;
  }
}

// Default instance for convenience. If you need a different region,
// create your own instance.
export default Secrets;
