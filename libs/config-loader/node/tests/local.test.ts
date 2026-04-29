import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { resolve } from 'path';
import { loadLocalConfig } from '../src/local';

const TMP = resolve(__dirname, '.tmp');
const CONFIG_FILE = resolve(TMP, 'config.json');

describe('loadLocalConfig', () => {
  beforeAll(() => {
    mkdirSync(TMP, { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify({ KEY: 'value', COUNT: 42 }));
  });

  afterAll(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it('returns parsed config from the given file path', async () => {
    const result = await loadLocalConfig(CONFIG_FILE);
    expect(result).toEqual({ KEY: 'value', COUNT: 42 });
  });

  it('throws with a helpful message if file does not exist', async () => {
    await expect(loadLocalConfig('/nonexistent/path.json')).rejects.toThrow(
      'Local config file not found: /nonexistent/path.json',
    );
  });
});
