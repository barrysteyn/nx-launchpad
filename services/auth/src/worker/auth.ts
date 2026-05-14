import { betterAuth } from 'better-auth';
import { jwt, magicLink, admin, organization } from 'better-auth/plugins';
import { apiKey } from '@better-auth/api-key';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import { sendEmail } from './email';
import { pbkdf2Password } from './password-pbkdf2';
import { createAfterAddMember } from './org-hooks';
import { parseSecrets } from './secrets-parser';
import type { Bindings } from './types';

// Per-request factory. Cloudflare Workers' I/O isolation rule forbids reusing
// an I/O object across requests, and the better-auth instance holds a reference
// to the Drizzle adapter which holds a reference to the postgres.js client.
// So the entire auth instance must be rebuilt for every request. The env-string
// parsers below are still safe to cache at module scope because they hold no
// I/O — only static derived data.

const trustedOriginsCache = new Map<string, string[]>();

function parseTrustedOrigins(raw: string): string[] {
  const cached = trustedOriginsCache.get(raw);
  if (cached) return cached;
  const parsed = raw.split(',');
  trustedOriginsCache.set(raw, parsed);
  return parsed;
}

function activeOrgId(session: unknown): string | null {
  return (
    ((session as Record<string, unknown>).activeOrganizationId as
      | string
      | undefined) ?? null
  );
}

function userRole(user: unknown): string | null {
  return ((user as Record<string, unknown>).role as string | undefined) ?? null;
}

export function createAuth(
  env: Bindings,
  dbInstance: PostgresJsDatabase<typeof schema>,
): ReturnType<typeof betterAuth> {
  const isMultiTenant = env.MULTITENANCY_ENABLED === 'true';

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: parseTrustedOrigins(env.TRUSTED_ORIGINS),
    secrets: parseSecrets(env.BETTER_AUTH_SECRETS),

    database: drizzleAdapter(dbInstance, { provider: 'pg', schema }),

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      ...(env.ENVIRONMENT !== 'production' && { password: pbkdf2Password }),
      ...(env.AWS_SES_ACCESS_KEY && {
        sendResetPassword: async ({ user, url }) => {
          void sendEmail(
            { to: user.email, subject: 'Reset your password', url },
            env,
          );
        },
      }),
    },

    emailVerification: {
      ...(env.AWS_SES_ACCESS_KEY && {
        sendVerificationEmail: async ({ user, url }) => {
          void sendEmail(
            { to: user.email, subject: 'Verify your email address', url },
            env,
          );
        },
      }),
      sendOnSignUp: !!env.AWS_SES_ACCESS_KEY,
      autoSignInAfterVerification: true,
    },

    socialProviders: {},

    plugins: [
      ...(isMultiTenant
        ? [
            organization({
              organizationHooks: {
                afterAddMember: createAfterAddMember(dbInstance),
              },
            }),
          ]
        : [admin()]),
      jwt({
        jwt: {
          expirationTime: '1h',
          issuer: env.BETTER_AUTH_URL,
          audience: env.BETTER_AUTH_URL,
          definePayload: isMultiTenant
            ? ({ user, session }) => ({
                id: user.id,
                email: user.email,
                orgId: activeOrgId(session),
              })
            : ({ user }) => ({
                id: user.id,
                email: user.email,
                role: userRole(user),
              }),
        },
        jwks: {
          keyPairConfig: { alg: 'EdDSA' },
          jwksPath: '/.well-known/jwks.json',
        },
      }),
      ...(env.AWS_SES_ACCESS_KEY
        ? [
            magicLink({
              sendMagicLink: async ({ email, url }) => {
                void sendEmail(
                  { to: email, subject: 'Your magic link', url },
                  env,
                );
              },
            }),
          ]
        : []),
      apiKey(),
    ],

    advanced: {
      crossSubDomainCookies: { enabled: true },
    },
  }) as unknown as ReturnType<typeof betterAuth>;
}
