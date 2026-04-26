import path from 'path';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import Cloudflare from 'cloudflare';
import { logger } from '@nx-launchpad/utils-node';
import { resolveConfig } from './resolver';

async function getKvNamespaceId(cf: Cloudflare, accountId: string, title: string): Promise<string> {
  const namespaces = await cf.kv.namespaces.list({ account_id: accountId });
  const match = namespaces.result.find((ns) => ns.title === title);
  if (!match) {
    throw new Error(`Cloudflare KV namespace not found: "${title}". Has terraform apply been run?`);
  }
  return match.id;
}

async function writeToDynamoDB(tableName: string, data: string): Promise<void> {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  await client.send(new PutCommand({ TableName: tableName, Item: { pk: 'config', data } }));
  logger.info({ tableName }, 'Config written to DynamoDB');
}

async function writeToCloudflareKV(
  cf: Cloudflare,
  accountId: string,
  namespaceId: string,
  data: string,
): Promise<void> {
  await cf.kv.namespaces.values.update(namespaceId, 'config', {
    account_id: accountId,
    value: data,
    metadata: JSON.stringify({}),
  });
  logger.info({ namespaceId }, 'Config written to Cloudflare KV');
}

async function deploy(): Promise<void> {
  const environment = process.env['ENVIRONMENT'];
  const validEnvironments = ['staging', 'production'];
  if (!environment || !validEnvironments.includes(environment)) {
    throw new Error(`ENVIRONMENT must be one of: ${validEnvironments.join(', ')}. Got: "${environment ?? ''}"`);
  }

  const projectName = process.env['PROJECT_NAME'];
  if (!projectName) {
    throw new Error('PROJECT_NAME must be set');
  }

  const cfAccountId = process.env['CLOUDFLARE_ACCOUNT_ID'];
  if (!cfAccountId) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID must be set');
  }

  const cfApiToken = process.env['CLOUDFLARE_API_TOKEN'];
  if (!cfApiToken) {
    throw new Error('CLOUDFLARE_API_TOKEN must be set');
  }

  logger.info({ environment }, 'Resolving config');
  const config = await resolveConfig({
    environment,
    filesDir: path.resolve(__dirname, '../files'),
  });
  const blob = JSON.stringify(config);

  logger.info({ environment, keys: Object.keys(config).length }, 'Config resolved, deploying');

  const resourceName = `${projectName}-config-${environment}`;
  const cf = new Cloudflare({ apiToken: cfApiToken });
  const kvNamespaceId = await getKvNamespaceId(cf, cfAccountId, resourceName);

  await Promise.all([
    writeToDynamoDB(resourceName, blob),
    writeToCloudflareKV(cf, cfAccountId, kvNamespaceId, blob),
  ]);

  logger.info({ environment, keys: Object.keys(config).length }, 'Config deployed successfully');
}

deploy().catch((err) => {
  console.error(err);
  process.exit(1);
});
