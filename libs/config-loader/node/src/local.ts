export async function loadLocalConfig(filePath?: string): Promise<Record<string, unknown>> {
  const { existsSync, readFileSync } = await import('fs');
  const { resolve } = await import('path');
  const resolvedPath = filePath ?? resolve(process.cwd(), 'config', 'files', 'local.resolved.json');
  if (!existsSync(resolvedPath)) {
    throw new Error(
      `Local config file not found: ${resolvedPath}\nGenerate it with: npx nx run config:resolve --args="--environment=local --outFile=config/files/local.resolved.json"`,
    );
  }
  return JSON.parse(readFileSync(resolvedPath, 'utf-8')) as Record<string, unknown>;
}
