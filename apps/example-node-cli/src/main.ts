import { loadLocalConfig, loadAwsConfig } from '@nx-launchpad/config-loader-node';
import { flushLogger } from '@nx-launchpad/utils-node';

export async function handler(
  _event: Record<string, unknown>,
  _context: Record<string, unknown>,
): Promise<{ statusCode: number; body: string }> {
  try {
    return { statusCode: 200, body: 'Hello from example-node-cli!' };
  } finally {
    await flushLogger();
  }
}

export async function main(): Promise<void> {
  const environment = process.env['ENVIRONMENT'] ?? 'local';
  const projectName = process.env['PROJECT_NAME'] ?? '';
  const config =
    environment === 'local'
      ? await loadLocalConfig()
      : await loadAwsConfig(`${projectName}-${environment}-config`);
  console.log('TEST_KEY:', config['TEST_KEY']);
  console.log('TEST_SECRET_KEY:', config['TEST_SECRET_KEY']);
}

if (require.main === module) {
  main().catch(console.error);
}
