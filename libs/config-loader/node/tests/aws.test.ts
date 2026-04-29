import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.fn();

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({})),
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: vi.fn(() => ({ send: mockSend })) },
  GetCommand: vi.fn((params: unknown) => params),
}));

import { loadAwsConfig } from '../src/aws';

describe('loadAwsConfig', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns parsed config from DynamoDB', async () => {
    mockSend.mockResolvedValue({ Item: { data: JSON.stringify({ KEY: 'value' }) } });
    const result = await loadAwsConfig('proj-staging-config');
    expect(result).toEqual({ KEY: 'value' });
  });

  it('throws if item not found in table', async () => {
    mockSend.mockResolvedValue({ Item: undefined });
    await expect(loadAwsConfig('proj-staging-config')).rejects.toThrow(
      'No config found in DynamoDB table: proj-staging-config',
    );
  });
});
