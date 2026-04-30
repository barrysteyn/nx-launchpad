import { describe, it, expect, vi } from 'vitest';
import { loadCloudflareConfig } from '../src/cloudflare';

function mockKV(value: string | null) {
  return { get: vi.fn().mockResolvedValue(value) };
}

describe('loadCloudflareConfig', () => {
  it('returns parsed config object from KV', async () => {
    const result = await loadCloudflareConfig(mockKV(JSON.stringify({ KEY: 'value', COUNT: 42 })));
    expect(result).toEqual({ KEY: 'value', COUNT: 42 });
  });

  it("throws with a helpful message when key 'config' is missing", async () => {
    await expect(loadCloudflareConfig(mockKV(null))).rejects.toThrow(
      "CONFIG_KV key 'config' not found. Seed the KV store before starting the worker.",
    );
  });

  it('throws when value is not valid JSON', async () => {
    await expect(loadCloudflareConfig(mockKV('not-json'))).rejects.toThrow();
  });
});
