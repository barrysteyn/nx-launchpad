import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { logger as rootLogger } from '@nx-launchpad/utils-node';

const logger = rootLogger.child({ service: 'config-loader' });

let cache: Record<string, unknown> | null = null;

function loadFromFile(): Record<string, unknown> {
  const filePath = path.resolve(process.cwd(), 'config', 'files', 'local.resolved.json');
  if (!existsSync(filePath)) {
    throw new Error(
      `Local config file not found: ${filePath}\nGenerate it with: npx nx run config:resolve --args="--environment=local --outFile=config/files/local.resolved.json"`,
    );
  }
  logger.info({ filePath }, 'Loading config from local file');
  return JSON.parse(readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
}

async function loadFromDynamoDB(environment: string): Promise<Record<string, unknown>> {
  const projectName = process.env['PROJECT_NAME'];
  if (!projectName) throw new Error('PROJECT_NAME must be set');

  const tableName = `${projectName}-config-${environment}`;
  logger.info({ tableName }, 'Loading config from DynamoDB');

  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  const result = await client.send(new GetCommand({ TableName: tableName, Key: { pk: 'config' } }));
  if (!result.Item) throw new Error(`No config found in DynamoDB table: ${tableName}`);

  return JSON.parse(result.Item['data'] as string) as Record<string, unknown>;
}


export async function loadConfig({
  environment = process.env['APP_ENV'] ?? 'local',
  forceReload = false,
}: {
  environment?: string;
  forceReload?: boolean;
} = {}): Promise<Record<string, unknown>> {
  if (!forceReload && cache) {
    logger.info({ environment }, 'Using cached config');
    return cache;
  }

  let config: Record<string, unknown>;

  if (environment === 'local') {
    config = loadFromFile();
  } else {
    config = await loadFromDynamoDB(environment);
  }

  cache = config;
  return config;
}
