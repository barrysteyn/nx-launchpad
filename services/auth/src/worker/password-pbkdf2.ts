// Custom password hashing for non-production environments.
//
// Why: better-auth's default is scrypt, which exceeds CF Workers' Bundled plan
// CPU limits and times out signup/signin under any real load. PBKDF2 via
// Web Crypto is well-supported in workerd and finishes well within the
// per-request CPU budget. Remove this override once the auth worker moves
// to the Workers Unbound usage model (where scrypt is fine).
//
// Output format: `pbkdf2:<base64-salt>:<base64-derived-bits>`.

const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;

const b64 = (buf: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(buf)));

async function deriveBits(
  password: string,
  salt: Uint8Array,
): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
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
    return `pbkdf2:${b64(salt.buffer)}:${b64(bits)}`;
  },
  verify: async ({
    hash,
    password,
  }: {
    hash: string;
    password: string;
  }): Promise<boolean> => {
    const [, saltB64, hashB64] = hash.split(':');
    const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
    const bits = await deriveBits(password, salt);
    return b64(bits) === hashB64;
  },
};
