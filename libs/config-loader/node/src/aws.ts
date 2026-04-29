export async function loadAwsConfig(tableName: string): Promise<Record<string, unknown>> {
  const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, GetCommand } = await import('@aws-sdk/lib-dynamodb');

  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  const result = await client.send(new GetCommand({ TableName: tableName, Key: { pk: 'config' } }));
  if (!result.Item) throw new Error(`No config found in DynamoDB table: ${tableName}`);

  return JSON.parse(result.Item['data'] as string) as Record<string, unknown>;
}
