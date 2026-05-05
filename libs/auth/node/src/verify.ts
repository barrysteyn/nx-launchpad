import { jwtVerify, createRemoteJWKSet } from 'jose';
import type { Context, MiddlewareHandler } from 'hono';

export const ADMIN_ROLE = 'admin' as const;

export interface AuthPayload {
  id: string;
  email: string;
  // single-tenant mode (admin plugin)
  role?: string | null;
  // multi-tenant mode (organization plugin)
  orgId?: string | null;
  [key: string]: unknown;
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export async function verifyToken(
  token: string,
  authBaseUrl: string,
): Promise<AuthPayload> {
  let JWKS = jwksCache.get(authBaseUrl);
  if (!JWKS) {
    JWKS = createRemoteJWKSet(new URL(`${authBaseUrl}/api/auth/.well-known/jwks.json`));
    jwksCache.set(authBaseUrl, JWKS);
  }
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
