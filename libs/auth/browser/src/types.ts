export interface AuthPayload {
  id: string;
  email: string;
  emailVerified?: boolean;
  name?: string;
  [key: string]: unknown;
}
