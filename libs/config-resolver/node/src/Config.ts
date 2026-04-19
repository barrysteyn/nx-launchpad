import deepmerge from 'deepmerge';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import YAML from 'yaml';
import { logger as rootLogger } from './logger.ts';

import Secrets from './secrets.ts';
import { isJsonObjectOrArray } from './Utils.ts';

const logger = rootLogger.child({
  serviceName: 'Load Config',
});

const ensureScreamingSnake = (key: string) => {
  if (!/^[A-Z0-9_]+$/.test(key)) {
    throw new Error(
      `Invalid config variable key name (not conforming to screaming snake case): ${key}`,
    );
  }
};

// ---------------------------
// Cache + super-simple mutex
// ---------------------------

// Cached configs by environment|context
let cachedConfig: Record<string, any> = {};

// Per-key in-flight promise (mutex). Using Partial so `inflight[key]` can be undefined.
const inflight: Partial<Record<string, Promise<any>>> = {};

// ---------- main loader

export async function loadConfig({
  AWSCredentials = undefined,
  forceReload = false,
  configDir = null,
  environment = 'development',
}: {
  AWSCredentials?: any;
  forceReload?: boolean;
  configDir?: string | null;
  environment?: string;
} = {}): Promise<any> {
  configDir = configDir || path.resolve(__dirname, '../../configurations');
  const cacheKey = `${environment}`;

  // Serve from cache if present and not forcing reload
  if (!forceReload && cachedConfig[cacheKey]) {
    logger.info('Using cached config, not reloading');
    return cachedConfig[cacheKey];
  }

  // Coalesce concurrent loads for the same key (mutex)
  const inFlight = inflight[cacheKey];
  if (inFlight) {
    logger.info('Awaiting in-flight config load');
    return inFlight;
  }

  if (
    !AWSCredentials &&
    !process.env.AWS_ACCESS_KEY_ID &&
    !process.env.AWS_SECRET_ACCESS_KEY
  ) {
    throw new Error('No AWS credentials found');
  }

  const secrets = new Secrets({ credentials: AWSCredentials });
  logger.info(`Force reload: ${forceReload}`);
  logger.info(`Loading config for environment: ${environment}`);
  logger.info(`Loading config from: ${configDir}`);

  // Start a single in-flight load for this key
  const loadPromise = (async (): Promise<any> => {
    try {
      const basePath = path.join(configDir, 'config.yaml');
      const envPath = path.join(configDir, `${environment}-config.yaml`);
      const documentsPath = path.join(configDir, 'documents.yaml');

      const baseConfigRaw = YAML.parse(readFileSync(basePath, 'utf-8'));
      const envConfigRaw = existsSync(envPath)
        ? YAML.parse(readFileSync(envPath, 'utf-8'))
        : {};
      const documentsConfigRaw = YAML.parse(
        readFileSync(documentsPath, 'utf-8'),
      );
      const config: any = deepmerge(
        deepmerge(baseConfigRaw, envConfigRaw),
        documentsConfigRaw,
      );

      // Iterate through the config object and find all the SSM secrets
      const secretMap: Record<string, string> = {};
      const getAllSecretsAndEnsureScreamingSnake = (obj: any) => {
        if (!isJsonObjectOrArray(obj)) return;
        for (const [key, val] of Object.entries(obj)) {
          ensureScreamingSnake(key);
          if (isJsonObjectOrArray(val)) {
            getAllSecretsAndEnsureScreamingSnake(val);
          } else if (typeof val === 'string' && val.startsWith('ssm:')) {
            const pathInSSM = val.replace(/^ssm:/, '');
            secretMap[key] = pathInSSM;
          }
        }
      };
      getAllSecretsAndEnsureScreamingSnake(config);

      // Obtain the secrets that were found in the config
      let resolvedSecrets: Record<string, string | null> = {};
      try {
        resolvedSecrets = await secrets.getSecretsMap(secretMap, {
          noCache: forceReload,
        });
      } catch (err) {
        throw new Error(`Error getting secrets from SSM: ${err}`);
      }

      const resolveSecrets = (obj: any) => {
        if (!isJsonObjectOrArray(obj)) return;
        for (const [key, value] of Object.entries(obj)) {
          if (isJsonObjectOrArray(value)) {
            resolveSecrets(value);
          } else if (typeof value === 'string' && value.startsWith('ssm:')) {
            if (resolvedSecrets[key] == null) {
              throw new Error(
                `Secret for key ${key} not found in SSM at path ${value}`,
              );
            }
            obj[key] = resolvedSecrets[key];
          }
        }
      };

      resolveSecrets(config);
      cachedConfig[cacheKey] = config;
      return config;
    } catch (err) {
      logger.error(`Error loading config: ${err}`);
      throw err;
    }
  })();

  // register the actual promise immediately
  inflight[cacheKey] = loadPromise;

  // clean up when done (but don’t replace the stored promise)
  loadPromise.finally(() => {
    delete inflight[cacheKey];
  });

  return inflight[cacheKey]!;
}
