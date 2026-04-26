import fs from 'fs';
import path from 'path';
import { describe, expect, test } from 'vitest';
import YAML from 'yaml';

describe('Ensuring config YAMLs are correctly formed', () => {
  const filesDir = path.join(__dirname, '../files');
  const yamlFiles = fs.readdirSync(filesDir).filter((f) => f.endsWith('.yaml'));

  test.each(yamlFiles)('parses %s without errors', (filename) => {
    const filePath = path.join(filesDir, filename);
    expect(() => {
      const parsed = YAML.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(typeof parsed).toBe('object');
    }).not.toThrow();
  });
});
