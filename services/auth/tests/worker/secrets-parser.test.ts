import { describe, expect, it } from 'vitest';
import { parseSecrets } from '../../src/worker/secrets-parser';

describe('parseSecrets', () => {
  it('returns undefined for missing input', () => {
    expect(parseSecrets(undefined)).toBeUndefined();
    expect(parseSecrets('')).toBeUndefined();
  });

  it('parses a single versioned secret', () => {
    expect(parseSecrets('1:abc')).toEqual([{ version: 1, value: 'abc' }]);
  });

  it('parses a comma-separated list', () => {
    expect(parseSecrets('2:newer,1:older')).toEqual([
      { version: 2, value: 'newer' },
      { version: 1, value: 'older' },
    ]);
  });

  it('trims whitespace around the value', () => {
    expect(parseSecrets('1: abc ')).toEqual([{ version: 1, value: 'abc' }]);
  });

  it('throws when an entry has no colon', () => {
    expect(() => parseSecrets('abc')).toThrow(/Expected "<version>:<secret>"/);
  });

  it('throws when the version is non-numeric', () => {
    expect(() => parseSecrets('abc:def')).toThrow(/non-negative integer/);
  });

  it('throws when the version is negative', () => {
    expect(() => parseSecrets('-1:abc')).toThrow(/non-negative integer/);
  });

  it('throws when the value is empty', () => {
    expect(() => parseSecrets('1:')).toThrow(/Empty secret value/);
  });

  it('returns the same array instance for the same raw input (cache)', () => {
    const a = parseSecrets('1:abc,2:def');
    const b = parseSecrets('1:abc,2:def');
    expect(a).toBe(b);
  });
});
