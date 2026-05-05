export const ADMIN_ROLE = 'admin' as const;

export interface AuthPayload {
  id: string;
  email: string;
  role?: string | null;
  emailVerified?: boolean;
  name?: string;
  [key: string]: unknown;
}
