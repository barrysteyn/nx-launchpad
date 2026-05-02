import { betterAuth } from 'better-auth';
import { jwt, magicLink } from 'better-auth/plugins';
import { apiKey } from '@better-auth/api-key';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { Redis } from '@upstash/redis';
import { db } from './db';
import { sendSESEmail } from './email';
import { jwksKvAdapter } from './jwks-adapter';
import type { Bindings } from './types';

let _auth: ReturnType<typeof betterAuth> | null = null;
let _cacheKey = '';

export function getAuth(env: Bindings): ReturnType<typeof betterAuth> {
  const cacheKey = `${env.BETTER_AUTH_URL}|${env.BETTER_AUTH_SECRETS ?? ''}`;
  if (_auth && _cacheKey === cacheKey) return _auth;

  const redis = new Redis({
    url: env.UPSTASH_REDIS_URL,
    token: env.UPSTASH_REDIS_TOKEN,
  });

  _auth = betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: env.TRUSTED_ORIGINS.split(','),
    secret: env.BETTER_AUTH_SECRET,
    secrets: env.BETTER_AUTH_SECRETS
      ? env.BETTER_AUTH_SECRETS.split(',').map((entry) => {
          const colonIdx = entry.indexOf(':');
          return {
            version: parseInt(entry.slice(0, colonIdx), 10),
            value: entry.slice(colonIdx + 1).trim(),
          };
        })
      : undefined,

    database: drizzleAdapter(db(env), { provider: 'sqlite' }),

    secondaryStorage: {
      get: async (key) => {
        const value = await redis.get<string>(key);
        return value ?? null;
      },
      set: async (key, value, ttl) => {
        if (ttl) await redis.set(key, value, { ex: ttl });
        else await redis.set(key, value);
      },
      delete: async (key) => {
        await redis.del(key);
      },
    },

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {
        void sendSESEmail(
          { to: user.email, subject: 'Reset your password', url },
          env,
        );
      },
    },

    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        void sendSESEmail(
          { to: user.email, subject: 'Verify your email address', url },
          env,
        );
      },
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
    },

    // ── social providers — add here when needed ──────────────────
    socialProviders: {},

    // ── plugins ──────────────────────────────────────────────────
    plugins: [
      jwt({
        jwt: {
          expirationTime: '1h',
          issuer: env.BETTER_AUTH_URL,
          audience: env.BETTER_AUTH_URL,
        },
        jwks: {
          keyPairConfig: { alg: 'EdDSA' },
          jwksPath: '/.well-known/jwks.json',
          adapter: jwksKvAdapter(env),
        },
      }),
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          void sendSESEmail(
            { to: email, subject: 'Your magic link', url },
            env,
          );
        },
      }),
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
