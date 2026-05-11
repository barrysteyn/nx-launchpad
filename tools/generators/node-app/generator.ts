import { addProjectConfiguration, formatFiles, generateFiles, Tree } from '@nx/devkit';
import { execSync } from 'child_process';
import * as path from 'path';
import type { NodeAppGeneratorSchema } from './schema';

export async function nodeAppGenerator(tree: Tree, options: NodeAppGeneratorSchema) {
  const appName = options.name;
  const appDir = `apps/${appName}`;
  const description = options.description ?? `${appName} application`;
  const includeInfra = options.includeInfra ?? true;
  const includeApiGateway = options.includeApiGateway ?? true;

  addProjectConfiguration(tree, appName, {
    name: appName,
    projectType: 'application',
    root: appDir,
    sourceRoot: `${appDir}/src`,
    metadata: { ci: { profile: 'default' } },
    targets: {
      ...buildBaseTargets(),
      ...(includeInfra ? buildInfraTargets() : {}),
    },
  });

  const templateVars = {
    name: appName,
    description,
    includeApiGateway,
    tmpl: '',
  };

  generateFiles(tree, path.join(__dirname, 'files'), appDir, templateVars);

  if (includeInfra) {
    generateFiles(tree, path.join(__dirname, 'files-infra-lambda'), appDir, templateVars);
  }

  await formatFiles(tree);

  return () => {
    execSync('npm install --legacy-peer-deps', {
      cwd: process.cwd(),
      stdio: 'inherit',
    });
  };
}

function buildBaseTargets() {
  return {
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
      options: { command: 'npx tsc --noEmit', cwd: '{projectRoot}' },
    },
    test: {
      executor: 'nx:run-commands',
      options: { command: 'npx vitest run', cwd: '{projectRoot}' },
    },
    build: {
      executor: 'nx:run-commands',
      options: { command: 'npx esbuild src/main.ts --bundle --platform=node --target=node22 --outfile=dist/main.js --external:@aws-sdk/* --external:@smithy/*', cwd: '{projectRoot}' },
      configurations: {
        preview: { command: "echo 'No preview build for Node CLI apps'" },
      },
    },
    serve: {
      executor: 'nx:run-commands',
      dependsOn: ['build'],
      options: { command: 'node dist/main.js', cwd: '{projectRoot}' },
    },
  };
}

function buildInfraTargets() {
  return {
    'tf-fmt': {
      executor: 'nx:run-commands',
      options: { command: 'terraform fmt -recursive', cwd: '{projectRoot}/infra' },
    },
    'tf-init': {
      executor: 'nx:run-commands',
      configurations: {
        staging: {
          command:
            'terraform -chdir={projectRoot}/infra/environments/staging init -backend-config=../../../../../libs/infra/backend.hcl -backend-config=../../../../../libs/infra/backend.local.hcl',
        },
        production: {
          command:
            'terraform -chdir={projectRoot}/infra/environments/production init -backend-config=../../../../../libs/infra/backend.hcl -backend-config=../../../../../libs/infra/backend.local.hcl',
        },
      },
    },
    'tf-init-local': {
      executor: 'nx:run-commands',
      options: {
        commands: [
          'rm -rf {projectRoot}/infra/environments/staging/.terraform',
          'terraform -chdir={projectRoot}/infra/environments/staging init -backend=false',
          'rm -rf {projectRoot}/infra/environments/production/.terraform',
          'terraform -chdir={projectRoot}/infra/environments/production init -backend=false',
        ],
        parallel: false,
      },
    },
    'tf-validate': {
      executor: 'nx:run-commands',
      dependsOn: ['tf-init-local'],
      options: {
        commands: [
          'terraform -chdir={projectRoot}/infra/environments/staging validate',
          'terraform -chdir={projectRoot}/infra/environments/production validate',
        ],
        parallel: false,
      },
    },
    'tf-plan': {
      executor: 'nx:run-commands',
      dependsOn: ['build'],
      configurations: {
        staging: { command: 'TF_VAR_project_name=$PROJECT_NAME TF_VAR_environment=$ENVIRONMENT terraform plan', cwd: '{projectRoot}/infra/environments/staging' },
        production: { command: 'TF_VAR_project_name=$PROJECT_NAME TF_VAR_environment=$ENVIRONMENT terraform plan', cwd: '{projectRoot}/infra/environments/production' },
      },
    },
    'tf-apply': {
      executor: 'nx:run-commands',
      dependsOn: ['build'],
      configurations: {
        staging: { command: 'TF_VAR_project_name=$PROJECT_NAME TF_VAR_environment=$ENVIRONMENT terraform apply', cwd: '{projectRoot}/infra/environments/staging' },
        production: { command: 'TF_VAR_project_name=$PROJECT_NAME TF_VAR_environment=$ENVIRONMENT terraform apply', cwd: '{projectRoot}/infra/environments/production' },
      },
    },
    deploy: {
      executor: 'nx:run-commands',
      dependsOn: ['build'],
      configurations: {
        preview: { command: "echo 'No preview deploy for Node CLI apps'" },
        staging: {
          cwd: '{projectRoot}/infra/environments/staging',
          commands: [
            'terraform init -backend-config=../../../../../libs/infra/backend.hcl -backend-config=../../../../../libs/infra/backend.local.hcl',
            'TF_VAR_project_name=$PROJECT_NAME TF_VAR_environment=$ENVIRONMENT terraform plan',
            'TF_VAR_project_name=$PROJECT_NAME TF_VAR_environment=$ENVIRONMENT terraform apply -auto-approve',
          ],
          parallel: false,
        },
        production: {
          cwd: '{projectRoot}/infra/environments/production',
          commands: [
            'terraform init -backend-config=../../../../../libs/infra/backend.hcl -backend-config=../../../../../libs/infra/backend.local.hcl',
            'TF_VAR_project_name=$PROJECT_NAME TF_VAR_environment=$ENVIRONMENT terraform plan',
            'TF_VAR_project_name=$PROJECT_NAME TF_VAR_environment=$ENVIRONMENT terraform apply -auto-approve',
          ],
          parallel: false,
        },
      },
    },
  };
}

export default nodeAppGenerator;
