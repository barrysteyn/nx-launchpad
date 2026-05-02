import { describe, expect, it, vi, beforeAll } from 'vitest';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { verifyToken, jwtMiddleware } from '../src/verify';

let privateKey: CryptoKey;
let publicKey: CryptoKey;
let publicJwk: Record<string, unknown>;
const ALG = 'EdDSA';
const BASE_URL = 'https://auth.example.com';

beforeAll(async () => {
  const keyPair = await generateKeyPair(ALG);
  privateKey = keyPair.privateKey;
  publicKey = keyPair.publicKey;
  publicJwk = await exportJWK(publicKey);
});

async function mintToken(payload: Record<string, unknown> = {}) {
  return new SignJWT({ id: 'user-1', email: 'test@test.com', ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuer(BASE_URL)
    .setAudience(BASE_URL)
    .setExpirationTime('1h')
    .sign(privateKey);
}

describe('verifyToken', () => {
  it('returns payload for a valid token', async () => {
    const token = await mintToken();
    const mockJwks = vi.fn().mockResolvedValue({ keys: [publicJwk] });
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({ json: mockJwks, ok: true } as Response),
    );

    const payload = await verifyToken(token, BASE_URL);
    expect(payload.id).toBe('user-1');
    expect(payload.email).toBe('test@test.com');
  });

  it('throws for an expired token', async () => {
    const token = await new SignJWT({ id: 'user-1' })
      .setProtectedHeader({ alg: ALG })
      .setIssuer(BASE_URL)
      .setAudience(BASE_URL)
      .setExpirationTime('-1s')
      .sign(privateKey);

    const mockJwks = vi.fn().mockResolvedValue({ keys: [publicJwk] });
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({ json: mockJwks, ok: true } as Response),
    );

    await expect(verifyToken(token, BASE_URL)).rejects.toThrow();
  });

  it('throws when token is missing', async () => {
    await expect(verifyToken('', BASE_URL)).rejects.toThrow();
  });
});
