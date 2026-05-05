import { createBrowserAuthClient } from '@nx-launchpad/auth-browser';

export const AUTH_URL = import.meta.env.VITE_AUTH_URL as string | undefined;
export const authClient = createBrowserAuthClient(AUTH_URL);
