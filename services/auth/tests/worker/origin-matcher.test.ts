import { describe, expect, it } from 'vitest';
import { getOriginMatcher } from '../../src/worker/origin-matcher';

describe('getOriginMatcher', () => {
  it('matches an exact origin', () => {
    const match = getOriginMatcher('https://staging.example.com');
    expect(match('https://staging.example.com')).toBe(true);
    expect(match('https://other.example.com')).toBe(false);
  });

  it('matches a subdomain wildcard', () => {
    const match = getOriginMatcher('https://*.staging.example.com');
    expect(match('https://app.staging.example.com')).toBe(true);
    expect(match('https://x.y.staging.example.com')).toBe(true);
  });

  it('rejects the apex when the pattern requires a subdomain prefix', () => {
    const match = getOriginMatcher('https://*.staging.example.com');
    expect(match('https://staging.example.com')).toBe(false);
  });

  it('does not let a wildcard cross domain boundaries past the suffix', () => {
    const match = getOriginMatcher('https://*.staging.example.com');
    expect(match('https://staging.example.com.evil.com')).toBe(false);
  });

  it('does not let a wildcard span the authority/path boundary', () => {
    const match = getOriginMatcher('https://*.staging.example.com');
    expect(match('https://app.staging.example.com/admin')).toBe(false);
  });

  it('rejects an untrusted origin', () => {
    const match = getOriginMatcher('https://staging.example.com,https://*.staging.example.com');
    expect(match('https://attacker.example.org')).toBe(false);
  });

  it('handles a comma-separated list with mixed exact and wildcard entries', () => {
    const match = getOriginMatcher('http://localhost:5173,https://*.staging.example.com');
    expect(match('http://localhost:5173')).toBe(true);
    expect(match('https://app.staging.example.com')).toBe(true);
    expect(match('http://localhost:3000')).toBe(false);
  });

  it('returns the same function instance for the same raw input (cache)', () => {
    const a = getOriginMatcher('https://*.example.com');
    const b = getOriginMatcher('https://*.example.com');
    expect(a).toBe(b);
  });
});
