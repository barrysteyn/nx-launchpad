import { createAuthClient } from 'better-auth/client';
import {
  jwtClient,
  magicLinkClient,
  adminClient,
} from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_AUTH_URL,
  plugins: [jwtClient(), magicLinkClient(), adminClient()],
});
