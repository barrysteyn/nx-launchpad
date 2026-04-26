import path from 'path';
import { writeFileSync } from 'fs';
import { resolveConfig } from './resolver';

async function main(): Promise<void> {
  const environment = process.argv[2];
  const outFile = process.argv[3] ?? 'resolved.config.json';

  if (!environment) {
    console.error('Usage: resolveToFile <environment> [output-file]');
    process.exit(1);
  }

  const config = await resolveConfig({
    environment,
    filesDir: path.resolve(__dirname, '../files'),
  });

  writeFileSync(outFile, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`Config for "${environment}" written to ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
