import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { main } from '../src/main';

vi.mock('@nx-launchpad/config-loader-node', () => ({
  loadLocalConfig: vi.fn().mockResolvedValue({
    TEST_KEY: 'test-value',
    TEST_SECRET_KEY: 'test-secret',
  }),
  loadAwsConfig: vi.fn().mockResolvedValue({
    TEST_KEY: 'aws-value',
    TEST_SECRET_KEY: 'aws-secret',
  }),
}));

vi.mock('@nx-launchpad/utils-node', () => ({
  logger: { child: () => ({ info: vi.fn(), error: vi.fn() }) },
  flushLogger: vi.fn().mockResolvedValue(undefined),
}));

describe('main', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    delete process.env['ENVIRONMENT'];
    delete process.env['PROJECT_NAME'];
  });

  it('uses loadLocalConfig when ENVIRONMENT is local', async () => {
    process.env['ENVIRONMENT'] = 'local';
    await main();
    expect(console.log).toHaveBeenCalledWith('TEST_KEY:', 'test-value');
    expect(console.log).toHaveBeenCalledWith('TEST_SECRET_KEY:', 'test-secret');
  });

  it('uses loadAwsConfig with correct table name when ENVIRONMENT is staging', async () => {
    process.env['ENVIRONMENT'] = 'staging';
    process.env['PROJECT_NAME'] = 'myproject';
    const { loadAwsConfig } = await import('@nx-launchpad/config-loader-node');
    await main();
    expect(loadAwsConfig).toHaveBeenCalledWith('myproject-staging-config');
  });

  it('throws if PROJECT_NAME is not set for non-local environments', async () => {
    process.env['ENVIRONMENT'] = 'staging';
    await expect(main()).rejects.toThrow('PROJECT_NAME must be set');
  });
});
