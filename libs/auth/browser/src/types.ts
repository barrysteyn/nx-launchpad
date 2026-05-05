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
