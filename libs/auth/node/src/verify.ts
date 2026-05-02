import { jwtVerify, createRemoteJWKSet } from 'jose';
import type { Context, MiddlewareHandler } from 'hono';

export interface AuthPayload {
  id: string;
  email: string;
  emailVerified?: boolean;
  name?: string;
  [key: string]: unknown;
}

export async function verifyToken(
  token: string,
  authBaseUrl: string,
): Promise<AuthPayload> {
  if (!token) throw new Error('Token is required');
  const JWKS = createRemoteJWKSet(
    new URL(`${authBaseUrl}/.well-known/jwks.json`),
  );
  const { payload } = await jwtVerify(token, JWKS, {
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
