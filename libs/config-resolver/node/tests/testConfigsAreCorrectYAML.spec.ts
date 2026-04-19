import fs from 'fs';
import path from 'path';
import { describe, expect, test } from 'vitest';
import YAML from 'yaml';

describe('Ensuring config YAMLs are correctly formed', () => {
  // config/ lives at the workspace root — 4 levels above this test file
  const configDir = path.join(__dirname, '../../../../config');

  const yamlFiles = fs.readdirSync(configDir).filter((f) => f.endsWith('.yaml'));

  test.each(yamlFiles)('parses %s without errors', (filename) => {
    const filePath = path.join(configDir, filename);
    expect(() => {
      const parsed = YAML.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(typeof parsed).toBe('object');
    }).not.toThrow();
  });
});
