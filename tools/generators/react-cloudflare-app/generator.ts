import { addProjectConfiguration, formatFiles, generateFiles, logger, Tree } from '@nx/devkit';
import * as fs from 'fs';
import * as path from 'path';
import type { ReactCloudflareAppGeneratorSchema } from './schema';

function readUrlFromEnv(): string {
  const PLACEHOLDER = 'your-domain.com';
  const FALLBACK = 'example.com';
  try {
    const envContent = fs.readFileSync('.env', 'utf-8');
    const match = envContent.match(/^URL=(.+)$/m);
    const url = match?.[1]?.trim();
    if (url && url !== PLACEHOLDER) return url;
  } catch {
    // .env not found
  }
  logger.warn(
    `URL not set or still placeholder in root .env — using '${FALLBACK}' for wrangler.jsonc domains. Update wrangler.jsonc after generation.`,
  );
  return FALLBACK;
}

function readProjectNameFromEnv(): string {
  const PLACEHOLDER = 'your-project-name';
  let value: string | undefined;
  try {
    const envContent = fs.readFileSync('.env', 'utf-8');
    const match = envContent.match(/^PROJECT_NAME=(.+)$/m);
    value = match?.[1]?.trim();
  } catch {
    // .env not found
  }
  if (!value || value === PLACEHOLDER) {
    throw new Error(
      'PROJECT_NAME is required in root .env and must not be the placeholder. ' +
        'Run /onboard first, or set PROJECT_NAME=<kebab-case-name> in .env.',
    );
  }
  return value;
}

export async function reactCloudflareAppGenerator(
  tree: Tree,
  options: ReactCloudflareAppGeneratorSchema,
) {
  const appName = options.name;
  const appDir = `apps/${appName}`;
  const description = options.description ?? `${appName} application`;
  const url = readUrlFromEnv();
  const projectName = readProjectNameFromEnv();
  const stagingDomain = `staging.${url}`;
  const productionDomain = url;
  const title = appName
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  addProjectConfiguration(tree, appName, {
    name: appName,
    projectType: 'application',
    root: appDir,
    sourceRoot: `${appDir}/src`,
    metadata: { ci: { profile: 'default' } },
    targets: {
      lint: {
        executor: 'nx:run-commands',
        options: { command: 'npx eslint src', cwd: '{projectRoot}' },
      },
      format: {
        executor: 'nx:run-commands',
        options: { command: 'npx prettier --check src', cwd: '{projectRoot}' },
      },
      typecheck: {
        executor: 'nx:run-commands',
        options: {
          commands: [
            'npx tsc --noEmit -p tsconfig.app.json',
            'npx tsc --noEmit -p tsconfig.worker.json',
          ],
          parallel: false,
          cwd: '{projectRoot}',
        },
      },
      test: {
        executor: 'nx:run-commands',
        options: { command: 'npx vitest run', cwd: '{projectRoot}' },
      },
      build: {
        executor: 'nx:run-commands',
        options: { command: 'npx vite build --mode staging', cwd: '{projectRoot}' },
        configurations: {
          preview: { command: 'CLOUDFLARE_ENV=preview npx vite build --mode staging' },
          staging: { command: 'CLOUDFLARE_ENV=staging npx vite build --mode staging' },
          production: { command: 'CLOUDFLARE_ENV=production npx vite build --mode production' },
        },
      },
      serve: {
        executor: 'nx:run-commands',
        dependsOn: ['seed-local-kv'],
        options: { command: 'npx vite', cwd: '{projectRoot}' },
      },
      'seed-local-kv': {
        executor: 'nx:run-commands',
        options: {
          commands: [
            'npx nx run config:resolve --args="--environment=local --outFile=files/local.resolved.json"',
            'npx wrangler kv key put config --binding CONFIG_KV --local --path=../../config/files/local.resolved.json',
          ],
          parallel: false,
          cwd: '{projectRoot}',
        },
      },
      deploy: {
        executor: 'nx:run-commands',
        dependsOn: ['build'],
        options: { cwd: '{projectRoot}' },
        configurations: {
          preview: {
            command: [
              'WRANGLER_OUT=$(npx wrangler deploy -e preview --var PROJECT_NAME:$PROJECT_NAME 2>&1);',
              'VERSION_ID=$(echo "$WRANGLER_OUT" | grep -m1 \'Current Version ID\' | awk \'{print $NF}\');',
              '[ -n "$VERSION_ID" ] || { echo "$WRANGLER_OUT" >&2; echo \'Failed to extract Version ID\' >&2; exit 1; };',
              'SHORT_ID=$(echo "$VERSION_ID" | cut -d\'-\' -f1);',
              'BASE_DOMAIN=$(echo "$WRANGLER_OUT" | grep -oE \'https://[a-zA-Z0-9._-]+\\.workers\\.dev\' | head -1 | sed \'s|https://||\');',
              '[ -n "$BASE_DOMAIN" ] || { echo "$WRANGLER_OUT" >&2; echo \'Failed to extract base domain\' >&2; exit 1; };',
              'echo PREVIEW_URL=https://$SHORT_ID-$BASE_DOMAIN',
            ],
          },
          staging: { command: 'npx wrangler deploy -e staging --var PROJECT_NAME:$PROJECT_NAME' },
          production: { command: 'npx wrangler deploy -e production --var PROJECT_NAME:$PROJECT_NAME' },
        },
      },
    },
  });

  generateFiles(tree, path.join(__dirname, 'files'), appDir, {
    name: appName,
    title,
    description,
    projectName,
    stagingDomain,
    productionDomain,
    tmpl: '',
  });

  await formatFiles(tree);
}

export default reactCloudflareAppGenerator;
