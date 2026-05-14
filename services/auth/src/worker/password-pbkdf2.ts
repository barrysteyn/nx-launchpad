// Custom password hashing for non-production environments.
//
// Why: better-auth's default is scrypt, which exceeds CF Workers' Bundled plan
// CPU limits and times out signup/signin under any real load. PBKDF2 via
// Web Crypto is well-supported in workerd and finishes well within the
// per-request CPU budget. Remove this override once the auth worker moves
// to the Workers Unbound usage model (where scrypt is fine).
//
// Output format: `pbkdf2:<base64-salt>:<base64-derived-bits>`.

import { timingSafeEqual } from 'node:crypto';

const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;
const PREFIX = 'pbkdf2:';

const encoder = new TextEncoder();

const b64Encode = (buf: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(buf)));

const b64Decode = (s: string): Uint8Array =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveBits(
  password: string,
  salt: Uint8Array,
): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    HASH_BITS,
  );
}

export const pbkdf2Password = {
  hash: async (password: string): Promise<string> => {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const bits = await deriveBits(password, salt);
    return `${PREFIX}${b64Encode(salt.buffer)}:${b64Encode(bits)}`;
  },
  verify: async ({
    hash,
    password,
  }: {
    hash: string;
    password: string;
  }): Promise<boolean> => {
    // Refuse foreign hash formats (e.g. a scrypt hash left over from before
    // the migration) — destructuring would silently pull wrong segments and
    // produce a misleading false negative.
    if (!hash.startsWith(PREFIX)) return false;
    const parts = hash.slice(PREFIX.length).split(':');
    if (parts.length !== 2) return false;
    const [saltB64, hashB64] = parts;
    const stored = b64Decode(hashB64);
    const derived = new Uint8Array(await deriveBits(password, b64Decode(saltB64)));
    if (stored.length !== derived.length) return false;
    return timingSafeEqual(stored, derived);
  },
};
