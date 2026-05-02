import { jwtVerify, createLocalJWKSet, importJWK } from 'jose';
import type { Context, MiddlewareHandler } from 'hono';
import type { KeyLike } from 'jose';

export interface AuthPayload {
  id: string;
  email: string;
  emailVerified?: boolean;
  name?: string;
  [key: string]: unknown;
}

async function fetchJWKS(
  jwksUrl: string,
): Promise<ReturnType<typeof createLocalJWKSet>> {
  const response = await fetch(jwksUrl);
  if (!response.ok && response.status !== undefined && response.status !== 200) {
    throw new Error(`Failed to fetch JWKS: ${response.status}`);
  }
  const jwks = await response.json();
  // Import each key to get CryptoKey objects, then build a local JWKS
  const keys: KeyLike[] = await Promise.all(
    (jwks.keys as Record<string, unknown>[]).map((k) =>
      importJWK(k) as Promise<KeyLike>,
    ),
  );
  // Build a JWKS with proper key objects
  return createLocalJWKSet({ keys: jwks.keys as Parameters<typeof createLocalJWKSet>[0]['keys'] });
}

export async function verifyToken(
  token: string,
  authBaseUrl: string,
): Promise<AuthPayload> {
  if (!token) throw new Error('Token is required');
  const jwksUrl = `${authBaseUrl}/.well-known/jwks.json`;
  const response = await fetch(jwksUrl);
  if (!response.ok && response.status !== undefined && response.status !== 200) {
    throw new Error(`Failed to fetch JWKS: ${response.status}`);
  }
  const jwks = await response.json();
  const localJWKS = createLocalJWKSet(jwks as Parameters<typeof createLocalJWKSet>[0]);
  const { payload } = await jwtVerify(token, localJWKS, {
    issuer: authBaseUrl,
    audience: authBaseUrl,
  });
  return payload as AuthPayload;
}

export function jwtMiddleware(authBaseUrl: string): MiddlewareHandler {
  return async (c: Context, next) => {
    const header = c.req.header('Authorization');
    if (!header?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const token = header.slice(7);
    try {
      const user = await verifyToken(token, authBaseUrl);
      c.set('user', user);
      await next();
    } catch {
      return c.json({ error: 'Unauthorized' }, 401);
    }
  };
}
