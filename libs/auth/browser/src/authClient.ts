import { createAuthClient } from 'better-auth/react';
import { jwtClient, magicLinkClient } from 'better-auth/client/plugins';

export function createBrowserAuthClient(authUrl?: string) {
  return createAuthClient({
    baseURL: authUrl,
    plugins: [jwtClient(), magicLinkClient()],
  });
}
