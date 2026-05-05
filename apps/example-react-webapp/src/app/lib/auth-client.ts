import { createBrowserAuthClient } from '@nx-launchpad/auth-browser';

export const authClient = createBrowserAuthClient(import.meta.env.VITE_AUTH_URL);
