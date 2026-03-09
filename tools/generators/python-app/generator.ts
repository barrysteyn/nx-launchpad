import { addProjectConfiguration, formatFiles, generateFiles, Tree } from '@nx/devkit';
import { execSync } from 'child_process';
import * as path from 'path';
import type { PythonAppGeneratorSchema } from './schema';

export async function pythonAppGenerator(tree: Tree, options: PythonAppGeneratorSchema) {
  const appName = options.name;
  const moduleName = appName.replace(/-/g, '_');
  const appDir = `apps/${appName}`;
  const pythonVersion = options.pythonVersion ?? '3.12.3';
  const pythonMajorMinor = pythonVersion.split('.').slice(0, 2).join('.');
  const pythonRuntime = `python${pythonMajorMinor}`;
  const description = options.description ?? `${appName} application`;
  const includeInfra = options.includeInfra ?? true;
  const infrastructureType = options.infrastructureType ?? 'lambda';
  const includeApiGateway = options.includeApiGateway ?? true;

  addProjectConfiguration(tree, appName, {
    name: appName,
    projectType: 'application',
    root: appDir,
    sourceRoot: `${appDir}/src`,
    metadata: { ci: { profile: 'python-uv' } },
    targets: {
      ...buildBaseTargets(appName),
      ...(includeInfra ? buildInfraTargets() : {}),
    },
  });

  const templateVars = {
    name: appName,
    moduleName,
    description,
    pythonVersion,
    pythonMajorMinor,
    pythonRuntime,
    includeApiGateway,
    tmpl: '',
  };

  generateFiles(tree, path.join(__dirname, 'files'), appDir, templateVars);

  if (includeInfra && infrastructureType === 'lambda') {
    generateFiles(tree, path.join(__dirname, 'files-infra-lambda'), appDir, templateVars);
  }

  await formatFiles(tree);

  return () => {
    execSync('uv sync', {
      cwd: path.join(process.cwd(), appDir),
      stdio: 'inherit',
    });
  };
}

function buildBaseTargets(appName: string) {
  return {
    lint: {
      executor: 'nx:run-commands',
      options: { command: 'uv run ruff check .', cwd: '{projectRoot}' },
    },
    format: {
      executor: 'nx:run-commands',
      options: { command: 'uv run ruff format --check .', cwd: '{projectRoot}' },
    },
    test: {
      executor: 'nx:run-commands',
      options: { command: 'uv run pytest', cwd: '{projectRoot}' },
    },
    build: {
      executor: 'nx:run-commands',
      options: {
        command: 'uv export --no-dev --no-hashes --no-emit-project -o requirements.txt',
        cwd: '{projectRoot}',
      },
    },
    serve: {
      executor: 'nx:run-commands',
      options: { command: `uv run ${appName}`, cwd: '{projectRoot}' },
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
            'terraform -chdir={projectRoot}/infra/environments/staging init -backend-config=../../../../../libs/infra/backend.hcl',
        },
        production: {
          command:
            'terraform -chdir={projectRoot}/infra/environments/production init -backend-config=../../../../../libs/infra/backend.hcl',
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
        staging: { command: 'terraform plan', cwd: '{projectRoot}/infra/environments/staging' },
        production: { command: 'terraform plan', cwd: '{projectRoot}/infra/environments/production' },
      },
    },
    'tf-apply': {
      executor: 'nx:run-commands',
      dependsOn: ['build'],
      configurations: {
        staging: { command: 'terraform apply', cwd: '{projectRoot}/infra/environments/staging' },
        production: { command: 'terraform apply', cwd: '{projectRoot}/infra/environments/production' },
      },
    },
    deploy: {
      executor: 'nx:run-commands',
      dependsOn: ['build'],
      configurations: {
        staging: {
          cwd: '{projectRoot}/infra/environments/staging',
          commands: [
            'terraform init -backend-config=../../../../../libs/infra/backend.hcl',
            'terraform plan',
            'terraform apply',
          ],
          parallel: false,
        },
        production: {
          cwd: '{projectRoot}/infra/environments/production',
          commands: [
            'terraform init -backend-config=../../../../../libs/infra/backend.hcl',
            'terraform plan',
            'terraform apply',
          ],
          parallel: false,
        },
      },
    },
  };
}

export default pythonAppGenerator;
