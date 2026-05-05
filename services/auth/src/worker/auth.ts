import { betterAuth } from 'better-auth';
import { jwt, magicLink, admin, organization } from 'better-auth/plugins';
import { apiKey } from '@better-auth/api-key';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { eq } from 'drizzle-orm';
import { db } from './db';
import * as schema from './schema';
import { sendSESEmail } from './email';
import type { Bindings } from './types';

let _auth: ReturnType<typeof betterAuth> | null = null;
let _cacheKey = '';

export function getAuth(env: Bindings): ReturnType<typeof betterAuth> {
  const isMultiTenant = env.MULTITENANCY_ENABLED === 'true';
  const cacheKey = `${env.BETTER_AUTH_URL}|${env.MULTITENANCY_ENABLED ?? ''}|${env.BETTER_AUTH_SECRETS ?? ''}`;
  if (_auth && _cacheKey === cacheKey) return _auth;

  _auth = betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: env.TRUSTED_ORIGINS.split(','),
    secrets: env.BETTER_AUTH_SECRETS
      ? env.BETTER_AUTH_SECRETS.split(',').map((entry) => {
          const colonIdx = entry.indexOf(':');
          return {
            version: parseInt(entry.slice(0, colonIdx), 10),
            value: entry.slice(colonIdx + 1).trim(),
          };
        })
      : undefined,

    database: drizzleAdapter(db(env), { provider: 'sqlite', schema }),

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      // PBKDF2 via Web Crypto avoids scrypt's CPU cost on CF Workers Bundled plan.
      // Remove this block once the worker is on the Unbound usage model.
      ...(env.ENVIRONMENT !== 'production' && {
        password: {
          hash: async (password) => {
            const enc = new TextEncoder();
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const key = await crypto.subtle.importKey(
              'raw',
              enc.encode(password),
              'PBKDF2',
              false,
              ['deriveBits'],
            );
            const bits = await crypto.subtle.deriveBits(
              { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
              key,
              256,
            );
            const b64 = (buf: ArrayBuffer) =>
              btoa(String.fromCharCode(...new Uint8Array(buf)));
            return `pbkdf2:${b64(salt.buffer)}:${b64(bits)}`;
          },
          verify: async ({ hash, password }) => {
            const [, saltB64, hashB64] = hash.split(':');
            const enc = new TextEncoder();
            const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
            const key = await crypto.subtle.importKey(
              'raw',
              enc.encode(password),
              'PBKDF2',
              false,
              ['deriveBits'],
            );
            const bits = await crypto.subtle.deriveBits(
              { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
              key,
              256,
            );
            const b64 = (buf: ArrayBuffer) =>
              btoa(String.fromCharCode(...new Uint8Array(buf)));
            return b64(bits) === hashB64;
          },
        },
      }),
      ...(env.AWS_SES_ACCESS_KEY && {
        sendResetPassword: async ({ user, url }) => {
          void sendSESEmail(
            { to: user.email, subject: 'Reset your password', url },
            env,
          );
        },
      }),
    },

    emailVerification: {
      ...(env.AWS_SES_ACCESS_KEY && {
        sendVerificationEmail: async ({ user, url }) => {
          void sendSESEmail(
            { to: user.email, subject: 'Verify your email address', url },
            env,
          );
        },
      }),
      sendOnSignUp: !!env.AWS_SES_ACCESS_KEY,
      autoSignInAfterVerification: true,
    },

    // ── social providers — add here when needed ──────────────────
    socialProviders: {},

    // ── plugins ──────────────────────────────────────────────────
    plugins: [
      ...(isMultiTenant
        ? [
            organization({
              organizationHooks: {
                afterAddMember: async ({ user, organization: org }) => {
                  await db(env)
                    .update(schema.session)
                    .set({ activeOrganizationId: org.id } as Record<string, unknown>)
                    .where(eq(schema.session.userId, user.id));
                },
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
                orgId:
                  (session as Record<string, unknown>)
                    .activeOrganizationId as string | null ?? null,
              })
            : ({ user }) => ({
                id: user.id,
                email: user.email,
                role:
                  (user as Record<string, unknown>).role as string | null ?? null,
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
                void sendSESEmail(
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

  // _auth is guaranteed to be set at this point
  _cacheKey = cacheKey;
  return _auth!;
}
