import { describe, it, expect, vi, beforeEach } from 'vitest';
import { main } from '../src/main';

vi.mock('@nx-launchpad/config-loader-node', () => ({
  loadLocalConfig: vi.fn().mockResolvedValue({
    TEST_KEY: 'test-value',
    TEST_SECRET_KEY: 'test-secret',
  }),
  loadAwsConfig: vi.fn().mockResolvedValue({}),
}));

vi.mock('@nx-launchpad/utils-node', () => ({
  logger: { child: () => ({ info: vi.fn(), error: vi.fn() }) },
  flushLogger: vi.fn().mockResolvedValue(undefined),
}));

describe('main', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    process.env['ENVIRONMENT'] = 'local';
  });

  it('logs config values', async () => {
    await main();
    expect(console.log).toHaveBeenCalledWith('TEST_KEY:', 'test-value');
    expect(console.log).toHaveBeenCalledWith('TEST_SECRET_KEY:', 'test-secret');
  });
});
