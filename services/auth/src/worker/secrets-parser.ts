export type ParsedSecret = { version: number; value: string };

const cache = new Map<string, ParsedSecret[]>();

export function parseSecrets(raw: string | undefined): ParsedSecret[] | undefined {
  if (!raw) return undefined;
  const cached = cache.get(raw);
  if (cached) return cached;
  const parsed = raw.split(',').map(parseEntry);
  cache.set(raw, parsed);
  return parsed;
}

function parseEntry(entry: string): ParsedSecret {
  const trimmed = entry.trim();
  const colonIdx = trimmed.indexOf(':');
  if (colonIdx === -1) {
    throw new Error(
      `Invalid BETTER_AUTH_SECRETS entry: "${trimmed}". Expected "<version>:<secret>".`,
    );
  }
  const versionStr = trimmed.slice(0, colonIdx);
  const version = parseInt(versionStr, 10);
  if (!Number.isInteger(version) || version < 0) {
    throw new Error(
      `Invalid version in BETTER_AUTH_SECRETS: "${versionStr}". Must be a non-negative integer.`,
    );
  }
  const value = trimmed.slice(colonIdx + 1).trim();
  if (!value) {
    throw new Error(`Empty secret value for version ${version} in BETTER_AUTH_SECRETS.`);
  }
  return { version, value };
}
