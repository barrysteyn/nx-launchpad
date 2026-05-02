export type Bindings = {
  ENVIRONMENT: string;
  PROJECT_NAME: string;
  BETTER_AUTH_URL: string;
  TRUSTED_ORIGINS: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_SECRETS: string;
  AWS_SES_ACCESS_KEY: string;
  AWS_SES_SECRET_KEY: string;
  AWS_SES_REGION: string;
  FROM_EMAIL: string;
  DB: D1Database;
  JWKS_KV: KVNamespace;
};

export type Variables = {
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    image?: string | null;
  } | null;
  session: {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
  } | null;
};
