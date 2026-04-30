import { addProjectConfiguration, formatFiles, generateFiles, Tree } from '@nx/devkit';
import * as path from 'path';
import type { ReactCloudflareAppGeneratorSchema } from './schema';

export async function reactCloudflareAppGenerator(
  tree: Tree,
  options: ReactCloudflareAppGeneratorSchema,
) {
  const appName = options.name;
  const appDir = `apps/${appName}`;
  const description = options.description ?? `${appName} application`;
  const stagingDomain = options.stagingDomain ?? '';
  const productionDomain = options.productionDomain ?? '';
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
          preview: { command: 'npx vite build --mode staging' },
          staging: { command: 'npx vite build --mode staging' },
          production: { command: 'npx vite build --mode production' },
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
              'WRANGLER_OUT=$(npx wrangler deploy --env preview --var PROJECT_NAME:$PROJECT_NAME 2>&1);',
              'VERSION_ID=$(echo "$WRANGLER_OUT" | grep -m1 \'Current Version ID\' | awk \'{print $NF}\');',
              '[ -n "$VERSION_ID" ] || { echo \'Failed to extract Version ID\' >&2; exit 1; };',
              'SHORT_ID=$(echo "$VERSION_ID" | cut -d\'-\' -f1);',
              'BASE_DOMAIN=$(echo "$WRANGLER_OUT" | grep -oE \'https://[a-zA-Z0-9._-]+\\.workers\\.dev\' | head -1 | sed \'s|https://||\');',
              '[ -n "$BASE_DOMAIN" ] || { echo \'Failed to extract base domain\' >&2; exit 1; };',
              'echo PREVIEW_URL=https://$SHORT_ID-$BASE_DOMAIN',
            ],
          },
          staging: { command: 'npx wrangler deploy --env staging --var PROJECT_NAME:$PROJECT_NAME' },
          production: { command: 'npx wrangler deploy --env production --var PROJECT_NAME:$PROJECT_NAME' },
        },
      },
    },
  });

  generateFiles(tree, path.join(__dirname, 'files'), appDir, {
    name: appName,
    title,
    description,
    stagingDomain,
    productionDomain,
    tmpl: '',
  });

  await formatFiles(tree);
}

export default reactCloudflareAppGenerator;
